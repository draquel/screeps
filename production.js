/* eslint-disable no-undef */
// Empire production planner (Phase 2): turns stockpile goals into lab
// assignments, and keeps a booster lab stocked with the best available
// upgrade compound so pure upgraders double their GCL per energy.
//
// Every runInterval ticks:
//   1. Empire stock is summed (storage + terminal + labs of owned rooms).
//   2. Goals (default: 10k XGH2O) are expanded down the reaction tree, using
//      existing stock of each intermediate first, into "amount still to make"
//      per compound.
//   3. A compound whose two ingredients are both in stock is a candidate.
//      Candidates are assigned to reactor rooms, highest tier first (convert
//      what's closest to the goal), preferring the room already holding the
//      most ingredients. A running job is kept until its compound is no
//      longer needed or an ingredient is exhausted empire-wide (hysteresis:
//      starting needs minBatch of each ingredient, continuing needs any).
//   4. Lab memory (role/resource/amount) is written for each managed room.
//      Everything downstream already exists: logistics.js turns input/booster
//      lab assignments into needs and ships ingredients in, rooms.runLabs
//      runs the reactions, and the mineralTransporter fills/drains the labs.
//
// Lab layout per room: the input pair with the most labs in range 2 of both;
// those labs are outputs. Rooms with >= 6 labs react and keep one booster
// lab; smaller clusters (RCL 6, 3 labs) only boost. Override per room with
// Memory.production.rooms[name].mode = 'off' | 'react' | 'boost' | 'both'.

const UPGRADE_BOOSTS = [RESOURCE_CATALYZED_GHODIUM_ACID, RESOURCE_GHODIUM_ACID, RESOURCE_GHODIUM_HYDRIDE];

const DEFAULTS = {
    runInterval: 50,
    goals: { [RESOURCE_CATALYZED_GHODIUM_ACID]: 10000 },
    minBatch: 500,          // ingredients needed (empire-wide) to start a reaction
    minJobTicks: 1500,      // a job runs at least this long before a higher-tier one can preempt it
    inputAmount: 2000,      // input lab fill target
    outputCap: 3000,        // output lab cap (drained to storage from 1500)
    boost: {
        enabled: true,
        compounds: UPGRADE_BOOSTS, // preference order
        minStock: 1000,     // empire stock to switch the booster to a compound
        keepStock: 300,     // ...and to stay on it
        labAmount: 1500,    // booster lab fill target
        minTicksToLive: 1200, // only fresh upgraders detour to the booster
        maxRcl: 8,          // boost up to this RCL. At RCL 8 the 15/tick cap limits
                            // energy spent, not progress: boosts still apply (engine
                            // upgradeController.js), so 15 XGH2O WORK = 30 GCL/tick.
    },
    transporterLevel: 4,    // mineralTransporter auto-queued for managed labs
};

let RECIPES = null; // product -> [a, b]
function recipes(){
    if(RECIPES) return RECIPES;
    RECIPES = {};
    for(let a of Object.keys(REACTIONS)){
        for(let b of Object.keys(REACTIONS[a])){
            RECIPES[REACTIONS[a][b]] = [a, b];
        }
    }
    return RECIPES;
}

let TIERS = {};
function tier(r){
    if(TIERS[r] !== undefined) return TIERS[r];
    let rec = recipes()[r];
    TIERS[r] = rec ? 1 + Math.max(tier(rec[0]), tier(rec[1])) : 0;
    return TIERS[r];
}

function deepMerge(base, over){
    if(!over || typeof over !== "object") return base;
    let out = Object.assign({}, base);
    for(let k of Object.keys(over)){
        let b = base ? base[k] : undefined;
        out[k] = (b && typeof b === "object" && !Array.isArray(b) && typeof over[k] === "object" && !Array.isArray(over[k]))
            ? deepMerge(b, over[k]) : over[k];
    }
    return out;
}

module.exports = {
    DEFAULTS,
    UPGRADE_BOOSTS,
    recipes,
    tier,

    mem(){
        if(!Memory.production) Memory.production = {};
        if(!Memory.production.config) Memory.production.config = {};
        if(!Memory.production.rooms) Memory.production.rooms = {};
        return Memory.production;
    },

    config(){
        if(this._cfgTick !== Game.time){
            this._cfg = deepMerge(DEFAULTS, this.mem().config);
            // goals replace rather than merge, so a goal can be removed
            if(this.mem().config.goals) this._cfg.goals = this.mem().config.goals;
            this._cfgTick = Game.time;
        }
        return this._cfg;
    },

    roomMem(name){
        let rooms = this.mem().rooms;
        if(!rooms[name]) rooms[name] = {};
        return rooms[name];
    },

    myRooms(){
        return Object.values(Game.rooms).filter(r => r.controller && r.controller.my);
    },

    labs(room){
        if(!room._labs) room._labs = room.find(FIND_MY_STRUCTURES, { filter: s => s.structureType === STRUCTURE_LAB });
        return room._labs;
    },

    // Empire stock per resource: storage + terminal + labs. Cached per tick.
    stock(){
        if(this._stockTick === Game.time) return this._stock;
        let s = {};
        let add = (store) => {
            if(!store) return;
            for(let r of Object.keys(store)){
                if(r !== RESOURCE_ENERGY && store[r] > 0) s[r] = (s[r] || 0) + store[r];
            }
        };
        for(let room of this.myRooms()){
            add(room.storage && room.storage.store);
            add(room.terminal && room.terminal.store);
            for(let lab of this.labs(room)) add(lab.store);
        }
        this._stock = s;
        this._stockTick = Game.time;
        return s;
    },

    // Amount still to make per compound to satisfy all goals, using existing
    // stock of the goal and every intermediate before making more.
    requirements(){
        let stock = this.stock();
        let avail = Object.assign({}, stock);
        let req = {};
        let rec = recipes();
        let need = (r, amount) => {
            if(amount <= 0) return;
            let use = Math.min(avail[r] || 0, amount);
            avail[r] = (avail[r] || 0) - use;
            let make = amount - use;
            if(make <= 0 || !rec[r]) return;
            req[r] = (req[r] || 0) + make;
            need(rec[r][0], make);
            need(rec[r][1], make);
        };
        let goals = this.config().goals;
        for(let r of Object.keys(goals)) need(r, goals[r]);
        return req;
    },

    // Picks the input pair covering the most labs (range 2 of both inputs).
    // Cached until the room's lab set changes.
    layout(room){
        let labs = this.labs(room);
        let rm = this.roomMem(room.name);
        let key = labs.map(l => l.id).sort().join(",");
        if(rm.layout && rm.layout.key === key) return rm.layout;

        let best = null;
        for(let i = 0; i < labs.length; i++){
            for(let j = i + 1; j < labs.length; j++){
                let outs = labs.filter((l, k) => k !== i && k !== j
                    && l.pos.inRangeTo(labs[i], 2) && l.pos.inRangeTo(labs[j], 2));
                if(!best || outs.length > best.outputs.length){
                    best = { in1: labs[i].id, in2: labs[j].id, outputs: outs.map(l => l.id) };
                }
            }
        }
        let layout = { key, in1: null, in2: null, outputs: [], extra: labs.map(l => l.id) };
        if(best && best.outputs.length){
            let used = new Set([best.in1, best.in2, ...best.outputs]);
            layout = { key, in1: best.in1, in2: best.in2, outputs: best.outputs,
                extra: labs.map(l => l.id).filter(id => !used.has(id)) };
        }
        rm.layout = layout;
        return layout;
    },

    // What a room's labs are used for: 'react', 'boost', 'both' or 'off'.
    mode(room){
        let rm = this.roomMem(room.name);
        if(rm.mode && rm.mode !== "auto") return rm.mode;
        if(!room.storage) return "off";
        let n = this.labs(room).length;
        if(n >= 6) return "both";
        if(n >= 1) return this.boostAllowed(room) ? "boost" : (n >= 3 ? "react" : "off");
        return "off";
    },

    boostAllowed(room){
        let b = this.config().boost;
        return b.enabled && room.controller.level <= b.maxRcl;
    },

    // Resolves which lab ids play which part for this room's mode.
    roles(room){
        let mode = this.mode(room);
        let layout = this.layout(room);
        let roles = { in1: null, in2: null, outputs: [], booster: null, idle: [] };
        if(mode === "off") return roles;
        let all = this.labs(room).map(l => l.id);
        let react = (mode === "react" || mode === "both") && layout.in1 && layout.outputs.length;
        let boost = (mode === "boost" || mode === "both") && this.boostAllowed(room);
        if(react){
            roles.in1 = layout.in1;
            roles.in2 = layout.in2;
            roles.outputs = layout.outputs.slice();
            if(boost){
                // Prefer a lab outside the reaction cluster; otherwise give up
                // one output (only if at least one remains).
                if(layout.extra.length) roles.booster = layout.extra[0];
                else if(roles.outputs.length > 1) roles.booster = roles.outputs.pop();
            }
        }else if(boost && all.length){
            roles.booster = all[0];
        }
        let used = new Set([roles.in1, roles.in2, roles.booster, ...roles.outputs].filter(Boolean));
        roles.idle = all.filter(id => !used.has(id));
        return roles;
    },

    // Best upgrade compound for booster labs, with hysteresis.
    boostCompound(){
        let b = this.config().boost;
        let stock = this.stock();
        let m = this.mem();
        let cur = m.boostCompound;
        let best = b.compounds.find(c => (stock[c] || 0) >= b.minStock) || null;
        if(cur && (stock[cur] || 0) >= b.keepStock){
            // upgrade to a better compound once it's properly stocked
            if(best && b.compounds.indexOf(best) < b.compounds.indexOf(cur)) cur = best;
        }else{
            cur = best;
        }
        m.boostCompound = cur;
        return cur;
    },

    candidates(req, continuing){
        let stock = this.stock();
        let rec = recipes();
        let min = this.config().minBatch;
        let out = [];
        for(let r of Object.keys(req)){
            let [a, b] = rec[r];
            let ok = continuing.has(r)
                ? (stock[a] || 0) >= LAB_REACTION_AMOUNT && (stock[b] || 0) >= LAB_REACTION_AMOUNT
                : (stock[a] || 0) >= min && (stock[b] || 0) >= min;
            if(ok) out.push({ product: r, a, b, amount: req[r], tier: tier(r) });
        }
        out.sort((x, y) => y.tier - x.tier || y.amount - x.amount);
        return out;
    },

    // Assigns jobs to reactor rooms. Keeps running jobs that are still valid.
    plan(rooms){
        let req = this.requirements();
        let reactors = rooms.filter(r => this.roles(r).in1);
        let running = new Set(reactors.map(r => this.roomMem(r.name).job).filter(Boolean).map(j => j.product));
        let cands = this.candidates(req, running);
        let byProduct = {};
        for(let c of cands) byProduct[c.product] = c;

        let taken = new Set();
        let free = [];
        for(let room of reactors){
            let rm = this.roomMem(room.name);
            if(rm.job && byProduct[rm.job.product] && !taken.has(rm.job.product)){
                taken.add(rm.job.product);
            }else{
                if(rm.job) console.log("[Production] "+room.name+": finished "+rm.job.product);
                rm.job = null;
                free.push(room);
            }
        }
        for(let c of cands){
            if(!free.length) break;
            if(taken.has(c.product)) continue;
            // the room holding the most of both ingredients saves transfers
            let held = (room, r) => (room.storage ? room.storage.store[r] || 0 : 0) + (room.terminal ? room.terminal.store[r] || 0 : 0);
            free.sort((x, y) => (held(y, c.a) + held(y, c.b)) - (held(x, c.a) + held(x, c.b)));
            let room = free.shift();
            this.startJob(room, c);
            taken.add(c.product);
        }
        // No free reactor but a higher-tier reaction is ready: preempt the
        // lowest-tier job that has had its minimum run (one per pass), so
        // long low-tier runs (e.g. 10k OH) can't starve the chain's top.
        let waiting = cands.find(c => !taken.has(c.product));
        if(waiting){
            let victim = reactors
                .filter(r => { let j = this.roomMem(r.name).job; return j && Game.time - j.since >= this.config().minJobTicks && tier(j.product) < waiting.tier; })
                .sort((x, y) => tier(this.roomMem(x.name).job.product) - tier(this.roomMem(y.name).job.product))[0];
            if(victim){
                console.log("[Production] "+victim.name+": pausing "+this.roomMem(victim.name).job.product+" for higher-tier "+waiting.product);
                this.startJob(victim, waiting);
            }
        }
        return req;
    },

    startJob(room, c){
        this.roomMem(room.name).job = { product: c.product, a: c.a, b: c.b, since: Game.time };
        console.log("[Production] "+room.name+": start "+c.a+" + "+c.b+" -> "+c.product+" (need "+c.amount+")");
    },

    setLab(id, role, resource, amount){
        let lab = Game.getObjectById(id);
        if(!lab) return;
        let m = lab.memory;
        m.role = role;
        m.resource = resource;
        if(amount) m.amount = amount; else delete m.amount;
    },

    apply(room){
        if(this.mode(room) === "off") return;
        let cfg = this.config();
        let roles = this.roles(room);
        let job = this.roomMem(room.name).job;
        if(roles.in1){
            this.setLab(roles.in1, "input1", job ? job.a : null, cfg.inputAmount);
            this.setLab(roles.in2, "input2", job ? job.b : null, cfg.inputAmount);
            for(let id of roles.outputs) this.setLab(id, "output", job ? job.product : null, cfg.outputCap);
        }
        if(roles.booster){
            this.setLab(roles.booster, "booster", this.boostCompound(), cfg.boost.labAmount);
        }
        for(let id of roles.idle) this.setLab(id, "idle", null, null);

        // The mineralTransporter is what fills and drains labs.
        let active = (roles.in1 && job) || (roles.booster && this.boostCompound());
        if(active){
            let util = require("./util");
            if(!util.getCreepsByRole(room, "mineralTransporter").length){
                console.log("[Production] "+room.name+": queuing mineralTransporter for managed labs");
                require("./rooms").queCreep(room, "mineralTransporter", 1, { level: cfg.transporterLevel, respawn: true });
            }
        }
    },

    run(){
        let cfg = this.config();
        if(Game.time % cfg.runInterval !== 0) return;
        let rooms = this.myRooms().filter(r => this.labs(r).length > 0);
        if(!rooms.length) return;
        this.boostCompound();
        this.plan(rooms);
        for(let room of rooms) this.apply(room);
    },

    // ---- Upgrader boosting (called from runWorker) ----

    // A pure upgrader: memory.upgrader, or a worker with every other duty off.
    isUpgrader(creep){
        if(creep.memory.role !== "worker") return false;
        if(creep.memory.upgrader) return true;
        let e = creep.memory.eligibility;
        return !!e && !e.base && !e.repair && !e.ramparts && !e.build;
    },

    boosterLab(room){
        let roles = this.roles(room);
        return roles.booster ? Game.getObjectById(roles.booster) : null;
    },

    // Upgrade-boosted WORK parts on the room's pure upgraders (this creep included).
    roomBoostedWork(room){
        return room.find(FIND_MY_CREEPS, { filter: c => this.isUpgrader(c) })
            .reduce((n, c) => n + c.body.filter(p => p.type === WORK && p.boost && UPGRADE_BOOSTS.includes(p.boost)).length, 0);
    },

    // Returns true when the creep spent its tick going to / getting a boost.
    seekBoost(creep){
        if(creep.memory.noBoost || !this.isUpgrader(creep)) return false;
        let room = creep.room;
        if(!room.controller || !room.controller.my || !this.boostAllowed(room)) return false;
        let b = this.config().boost;
        if(creep.ticksToLive !== undefined && creep.ticksToLive < b.minTicksToLive) return false;
        let unboosted = creep.body.filter(p => p.type === WORK && !p.boost).length;
        if(room.controller.level === 8){
            // Only CONTROLLER_MAX_UPGRADE_PER_TICK (15) WORK parts per room can
            // count each tick, room-wide; boosting more wastes compound.
            unboosted = Math.min(unboosted, Math.max(0, CONTROLLER_MAX_UPGRADE_PER_TICK - this.roomBoostedWork(room)));
        }
        if(!unboosted) return false;
        let lab = this.boosterLab(room);
        if(!lab || !lab.mineralType || !UPGRADE_BOOSTS.includes(lab.mineralType)) return false;
        if(lab.store[lab.mineralType] < unboosted * LAB_BOOST_MINERAL
            || lab.store[RESOURCE_ENERGY] < unboosted * LAB_BOOST_ENERGY) return false;
        if(creep.pos.isNearTo(lab)){
            let r = lab.boostCreep(creep, unboosted);
            if(r === OK){
                console.log("["+room.name+"] Production: boosted "+creep.name+" ("+unboosted+" WORK) with "+lab.mineralType);
            }
            return true;
        }
        require("./util").moveToTarget(creep, { range: 1, pathColor: "#c0f" }, lab);
        return true;
    },

    report(){
        let cfg = this.config();
        let stock = this.stock();
        let req = this.requirements();
        let lines = ["=== Production (every "+cfg.runInterval+" ticks) ==="];
        lines.push("Goals: "+Object.keys(cfg.goals).map(r => r+" "+(stock[r] || 0)+"/"+cfg.goals[r]).join(", "));
        let reqList = Object.keys(req).sort((a, b) => tier(b) - tier(a));
        lines.push("Still to make: "+(reqList.length ? reqList.map(r => r+" "+req[r]).join(", ") : "nothing"));
        let base = ["H", "O", "U", "L", "K", "Z", "X"];
        lines.push("Base stock: "+base.map(r => r+" "+Math.round((stock[r] || 0)/1000)+"k").join(", "));
        lines.push("Booster compound: "+(this.mem().boostCompound || "none (no upgrade compound in stock)"));
        for(let room of this.myRooms().sort((a, b) => a.name.localeCompare(b.name))){
            let labs = this.labs(room);
            if(!labs.length){ lines.push(room.name+": no labs"); continue; }
            let roles = this.roles(room);
            let job = this.roomMem(room.name).job;
            let parts = [room.name+" ("+labs.length+" labs, "+this.mode(room)+")"];
            if(roles.in1) parts.push(job ? "reacting "+job.a+"+"+job.b+"->"+job.product+" x"+roles.outputs.length : "reactor idle");
            if(roles.booster){
                let lab = Game.getObjectById(roles.booster);
                parts.push("booster "+(lab && lab.mineralType ? lab.mineralType+" "+lab.store[lab.mineralType] : "empty"));
            }
            let ups = room.find(FIND_MY_CREEPS, { filter: c => this.isUpgrader(c) });
            if(ups.length){
                let boosted = ups.filter(c => c.body.some(p => p.type === WORK && p.boost)).length;
                parts.push("upgraders "+boosted+"/"+ups.length+" boosted");
            }
            if(!require("./util").getCreepsByRole(room, "mineralTransporter").length) parts.push("NO mineralTransporter");
            lines.push(parts.join(" | "));
        }
        console.log(lines.join("\n"));
        return OK;
    },
};
