/* eslint-disable no-undef */
// Power mining: finds power banks in highway rooms, sends attacker/healer
// pairs from the nearest RCL 8 room, times haulers to arrive as the bank
// breaks, and cleans up. Power is brought home and processed in power
// spawns (rooms.runPowerSpawn) — GPL, using surplus RCL 8 energy.
//
// No new roles — existing ones run in a power mode:
//   attack    memory.mode = 'powerBank' -> runAttacker (attack only the bank,
//             only with the healer adjacent; hold the last hits until a
//             hauler is in the room so the drop isn't left lying around)
//   healer    memory.target = attacker name (combatHeal follows + heals)
//   harvester memory.mode = 'power', targetResource = power (shared pile,
//             ruins, waits by the bank via haulerIdle)
// Bodies come from memory.body (util.getCreepBuild).
//
// Bank mechanics: 2M hits, decays in 5000 ticks, reflects 50% of melee
// damage. 20 ATTACK = 600 dmg/tick and 300 back, matched by 25 HEAL
// (12 each). One pair needs ~3300 ticks, so 2-3 pairs run at once and pairs
// are replaced while the bank still needs them.
//
// Vision: intel.update records banks in any visible highway room; RCL 8
// rooms with an observer additionally scan highway rooms within range in
// rotation (an observed room is visible on the next tick).

const DEFAULTS = {
    runInterval: 10,
    maxRange: 5,            // linear rooms from the home RCL 8 room
    maxOps: 1,              // concurrent operations
    minPower: 1000,         // ignore smaller banks
    maxPairs: 3,
    minPairs: 2,
    ticksPerRoom: 50,       // travel estimate
    spawnTicks: 150,        // 50-part creep spawn time
    haulMargin: 300,        // decay slack left for hauling
    holdHits: 60000,        // stop short of breaking until a hauler is in the room
    haulerCarry: 25,        // CARRY parts per hauler (50 each)
    maxHaulers: 6,
    timeout: 8000,          // abandon an operation after this many ticks
    seenWithin: 1500,       // only launch on banks observed this recently
    homeEnergyFloor: 150000, // a home must keep this much effective energy
                            // (storage + spare terminal) after paying for the crew
};

const ATTACKER_BODY = { MOVE: 20, ATTACK: 20 };
const HEALER_BODY = { MOVE: 25, HEAL: 25 };
const PAIR_DPS = 20 * ATTACK_POWER;

function roomXY(name){
    let m = /^([WE])(\d+)([NS])(\d+)$/.exec(name);
    if(!m) return null;
    return { x: m[1] === "E" ? +m[2] : -m[2] - 1, y: m[3] === "S" ? +m[4] : -m[4] - 1 };
}
function roomName(x, y){
    return (x >= 0 ? "E" + x : "W" + (-x - 1)) + (y >= 0 ? "S" + y : "N" + (-y - 1));
}

module.exports = {
    DEFAULTS,

    mem(){
        if(!Memory.power) Memory.power = {};
        if(!Memory.power.config) Memory.power.config = {};
        if(!Memory.power.ops) Memory.power.ops = {};
        return Memory.power;
    },

    config(){
        if(this._cfgTick !== Game.time){
            this._cfg = Object.assign({}, DEFAULTS, this.mem().config);
            this._cfgTick = Game.time;
        }
        return this._cfg;
    },

    homes(){
        return Object.values(Game.rooms).filter(r => r.controller && r.controller.my && r.controller.level === 8);
    },

    // ---- vision ----

    highwaysNear(name, range){
        let c = roomXY(name);
        let out = [];
        for(let dx = -range; dx <= range; dx++){
            for(let dy = -range; dy <= range; dy++){
                let x = c.x + dx, y = c.y + dy;
                let n = roomName(x, y);
                if(require("./intel").isHighwayByName(n)) out.push(n);
            }
        }
        return out;
    },

    scan(){
        let range = Math.min(this.config().maxRange, OBSERVER_RANGE);
        let homes = this.homes();
        for(let i = 0; i < homes.length; i++){
            let room = homes[i];
            let obs = room.find(FIND_MY_STRUCTURES, { filter: s => s.structureType === STRUCTURE_OBSERVER })[0];
            if(!obs) continue;
            this._hw = this._hw || {};
            if(!this._hw[room.name]) this._hw[room.name] = this.highwaysNear(room.name, range);
            let list = this._hw[room.name];
            if(list.length) obs.observeRoom(list[(Game.time + i * 7) % list.length]);
        }
    },

    // ---- operations ----

    run(){
        this.scan();
        if(Game.time % this.config().runInterval !== 0) return;
        let ops = this.mem().ops;
        for(let id of Object.keys(ops)) this.updateOp(ops[id]);
        this.cleanupCreeps();
        this.maybeLaunch();
        this.ensurePowerHaulers();
    },

    crewOf(op, role){
        return Object.values(Game.creeps).filter(c => c.memory.op === op.id && c.memory.role === role);
    },

    queued(op){
        let home = Game.rooms[op.home];
        if(!home) return [];
        return [...(home.memory.spawnQueue || []), ...(home.memory.spawning || [])]
            .filter(e => e.memory && e.memory.op === op.id);
    },

    queue(op, memory){
        let rooms = require("./rooms");
        let creeps = require("./creeps");
        let util = require("./util");
        let home = Game.rooms[op.home];
        let name = util.nameGenerator();
        memory = Object.assign({ level: 8, respawn: false, op: op.id, targetRoom: op.room }, memory);
        rooms.pushSpawnQueue(home, { name, memory: creeps.initRole(home, memory) });
        return name;
    },

    queuePair(op){
        let attacker = require("./util").nameGenerator();
        let healer = this.queue(op, { role: "healer", target: attacker, body: HEALER_BODY });
        // attacker sits just before its healer in the queue, so the healer's
        // target exists by the time the healer spawns
        let home = Game.rooms[op.home];
        let memory = { level: 8, respawn: false, op: op.id, targetRoom: op.room,
            role: "attack", mode: "powerBank", healer, body: ATTACKER_BODY };
        let q = home.memory.spawnQueue;
        let hi = q.findIndex(e => e.name === healer);
        q.splice(hi, 0, { name: attacker, memory });
        console.log("[Power] "+op.home+": queued pair "+attacker+" + "+healer+" for "+op.room);
        op.pairsQueued = (op.pairsQueued || 0) + 1;
    },

    updateOp(op){
        let cfg = this.config();
        let room = Game.rooms[op.room];
        let bank = room ? Game.getObjectById(op.id) : null;
        if(bank){ op.hits = bank.hits; op.power = bank.power; }

        if(Game.time - op.created > cfg.timeout){ return this.endOp(op, "timed out"); }

        if(room && !bank && op.status === "active"){
            op.status = "collecting";
            console.log("[Power] "+op.room+": bank broken, collecting "+op.power+" power");
        }
        if(op.status === "active" && !room && Game.time > op.decayAt){
            return this.endOp(op, "decayed");
        }

        let travel = op.travel;
        let attackers = this.crewOf(op, "attack");
        let haulers = this.crewOf(op, "harvester");

        if(op.status === "active"){
            // Keep op.pairs pairs alive (or coming) while the bank still needs them.
            let atBank = attackers.filter(c => !c.spawning && c.room.name === op.room);
            let dps = Math.max(1, atBank.length) * PAIR_DPS;
            let needTicks = (op.hits || POWER_BANK_HITS) / dps;
            // A pair needs replacing only if it dies before the bank does, and
            // only once a replacement queued now would arrive as it dies.
            let lead = travel + cfg.spawnTicks + 50;
            let effective = attackers.filter(c => c.spawning || c.ticksToLive > lead || c.ticksToLive > needTicks).length
                + this.queued(op).filter(e => e.memory.role === "attack").length;
            let decayLeft = op.decayAt - Game.time;
            if(effective < op.pairs && decayLeft > travel + cfg.spawnTicks + needTicks / 2){
                this.queuePair(op);
            }
            // Haulers: arrive as the bank breaks.
            let eta = travel + cfg.spawnTicks + 50;
            if(!op.haulersQueued && atBank.length && (op.hits || POWER_BANK_HITS) <= atBank.length * PAIR_DPS * eta){
                this.queueHaulers(op);
            }
        }else if(op.status === "collecting"){
            if(!op.haulersQueued) this.queueHaulers(op);
            if(room){
                let left = room.find(FIND_DROPPED_RESOURCES, { filter: d => d.resourceType === RESOURCE_POWER }).length
                    + room.find(FIND_RUINS, { filter: r => (r.store[RESOURCE_POWER] || 0) > 0 }).length;
                let carrying = haulers.some(c => c.room.name === op.room && (c.store[RESOURCE_POWER] || 0) > 0);
                if(!left && !carrying) return this.endOp(op, "collected");
            }else if(!haulers.length && !this.queued(op).length){
                return this.endOp(op, "no haulers left");
            }
        }
    },

    queueHaulers(op){
        let cfg = this.config();
        let n = Math.min(cfg.maxHaulers, Math.max(1, Math.ceil((op.power || 0) / (cfg.haulerCarry * CARRY_CAPACITY))));
        for(let i = 0; i < n; i++){
            this.queue(op, { role: "harvester", mode: "power", targetResource: RESOURCE_POWER,
                body: { MOVE: cfg.haulerCarry, CARRY: cfg.haulerCarry }, eligibility: { repair: false } });
        }
        op.haulersQueued = n;
        console.log("[Power] "+op.home+": queued "+n+" haulers for "+op.power+" power in "+op.room);
    },

    endOp(op, why){
        console.log("[Power] "+op.room+": operation ended ("+why+")");
        let home = Game.rooms[op.home];
        if(home && home.memory.spawnQueue){
            home.memory.spawnQueue = home.memory.spawnQueue.filter(e => !(e.memory && e.memory.op === op.id));
        }
        let ir = Memory.intel && Memory.intel.rooms && Memory.intel.rooms[op.room];
        if(ir && ir.ignoreHostile === "power") delete ir.ignoreHostile;
        // Never relaunch on this bank, even from a stale intel record.
        if(ir && ir.powerBank && ir.powerBank.id === op.id) delete ir.powerBank;
        let done = this.mem().done || (this.mem().done = {});
        done[op.id] = op.decayAt;
        for(let id of Object.keys(done)) if(done[id] < Game.time) delete done[id];
        let hist = this.mem().history || (this.mem().history = []);
        hist.push({ tick: Game.time, room: op.room, home: op.home, power: op.power, result: why, pairs: op.pairsQueued });
        if(hist.length > 20) hist.shift();
        delete this.mem().ops[op.id];
    },

    // Crew whose operation is over: fighters retire, haulers deliver first.
    cleanupCreeps(){
        let ops = this.mem().ops;
        for(let c of Object.values(Game.creeps)){
            if(!c.memory.op || c.spawning) continue;
            let op = ops[c.memory.op];
            if(c.memory.role === "harvester"){
                if(!op && c.store.getUsedCapacity() === 0) c.suicide();
            }else if(c.memory.role === "healer"){
                if(!op || !Game.creeps[c.memory.target]) c.suicide();
            }
        }
    },

    maybeLaunch(){
        let cfg = this.config();
        let ops = this.mem().ops;
        if(Object.keys(ops).length >= cfg.maxOps) return;
        let intelRooms = (Memory.intel && Memory.intel.rooms) || {};
        let healerCost = HEALER_BODY.MOVE * BODYPART_COST[MOVE] + HEALER_BODY.HEAL * BODYPART_COST[HEAL];
        let homes = this.homes().filter(r => r.energyCapacityAvailable >= healerCost);
        if(!homes.length) return;

        let logistics = require("./logistics");
        let bodyCost = (body) => Object.keys(body).reduce((s, p) => s + body[p] * BODYPART_COST[p.toLowerCase()], 0);
        let pairCost = bodyCost(ATTACKER_BODY) + bodyCost(HEALER_BODY);
        let haulerCost = bodyCost({ MOVE: cfg.haulerCarry, CARRY: cfg.haulerCarry });
        let energy = {};
        for(let h of homes) energy[h.name] = logistics.effectiveEnergy(h);

        let best = null;
        for(let name of Object.keys(intelRooms)){
            let r = intelRooms[name];
            let b = r.powerBank;
            if(!b || ops[b.id] || (this.mem().done && this.mem().done[b.id])) continue;
            if(Game.time - b.seen > cfg.seenWithin) continue;
            if(b.power < cfg.minPower || b.open < cfg.minPairs) continue;
            if(r.avoid) continue;
            if(require("./intel").isHighwayByName(name)){
                // Highway rooms have no controller, so "hostile" there is just
                // other players' creeps passing through — constant on busy
                // highways, and the 5000-tick TTL would outlast the bank. What
                // matters is whether someone else is already on this bank.
                if(b.hits < POWER_BANK_HITS) continue;
            }else if(r.hostile && !r.ignoreHostile && Game.time - (r.hostileSeen || 0) < (Memory.intel.hostileTTL || 5000)){
                continue;
            }
            let pairs = Math.max(cfg.minPairs, Math.min(cfg.maxPairs, b.open));
            let haulers = Math.min(cfg.maxHaulers, Math.max(1, Math.ceil(b.power / (cfg.haulerCarry * CARRY_CAPACITY))));
            let cost = pairs * pairCost + haulers * haulerCost;
            // Nearest home that can pay for the crew and stay above the floor
            // (ties: the richer one) — a crew drains ~40k energy and the
            // spawn queue, so a room already short on energy can't host it.
            let home = homes.map(h => ({ h, d: Game.map.getRoomLinearDistance(h.name, name) }))
                .filter(x => x.d <= cfg.maxRange && energy[x.h.name] >= cfg.homeEnergyFloor + cost)
                .sort((x, y) => x.d - y.d || energy[y.h.name] - energy[x.h.name])[0];
            if(!home) continue;
            let travel = (home.d + 1) * cfg.ticksPerRoom;
            let killTicks = b.hits / (pairs * PAIR_DPS);
            let decayLeft = b.decayAt - Game.time;
            if(decayLeft < cfg.spawnTicks + travel + killTicks + cfg.haulMargin) continue;
            let score = b.power / (home.d + 1);
            if(!best || score > best.score) best = { score, name, b, home: home.h.name, travel, pairs };
        }
        if(!best) return;

        let op = { id: best.b.id, room: best.name, home: best.home, x: best.b.x, y: best.b.y,
            power: best.b.power, hits: best.b.hits, decayAt: best.b.decayAt, pairs: best.pairs,
            travel: best.travel, status: "active", created: Game.time, haulersQueued: 0 };
        ops[op.id] = op;
        // Other players' miners in the room would mark it hostile and block
        // routing for our replacements/haulers; ignore that for the op.
        let ir = intelRooms[best.name];
        if(!ir.ignoreHostile) ir.ignoreHostile = "power";
        console.log("[Power] launching on "+best.name+" ("+best.b.power+" power, "+best.b.open+" open, decays in "
            +(best.b.decayAt - Game.time)+") from "+best.home+" with "+best.pairs+" pairs");
        for(let i = 0; i < best.pairs; i++) this.queuePair(op);
    },

    // Rooms holding power for their power spawn, or with a nuker to load,
    // need a mineralTransporter (it does both).
    ensurePowerHaulers(){
        if(Game.time % 100 !== 0) return;
        let util = require("./util");
        let creeps = require("./creeps");
        for(let room of this.homes()){
            let ps = room.find(FIND_MY_STRUCTURES, { filter: s => s.structureType === STRUCTURE_POWER_SPAWN })[0];
            let held = (room.storage ? room.storage.store[RESOURCE_POWER] || 0 : 0) + (room.terminal ? room.terminal.store[RESOURCE_POWER] || 0 : 0);
            let why = ps && held >= 100 ? "feed the power spawn" : (creeps.getNukerNeed(room) ? "load the nuker" : null);
            if(!why) continue;
            if(!util.getCreepsByRole(room, "mineralTransporter").length){
                console.log("[Power] "+room.name+": queuing mineralTransporter to "+why);
                require("./rooms").queCreep(room, "mineralTransporter", 1, { level: 4, respawn: true });
            }
        }
    },

    // ---- role hooks ----

    runAttacker(creep){
        let op = this.mem().ops[creep.memory.op];
        if(!op){ creep.suicide(); return; }
        let util = require("./util");
        let pos = new RoomPosition(op.x, op.y, op.room);
        if(creep.room.name !== op.room){
            delete creep.memory.noShove;
            util.moveToTarget(creep, { range: 1 }, pos);
            return;
        }
        let bank = Game.getObjectById(op.id);
        if(!bank){ creep.suicide(); return; }
        if(!creep.pos.isNearTo(bank)){
            delete creep.memory.noShove;
            util.moveToTarget(creep, { range: 1 }, bank);
            return;
        }
        creep.memory.noShove = true;
        let healer = Game.creeps[creep.memory.healer];
        if(!healer || healer.spawning || !healer.pos.isNearTo(creep)) return;
        if(creep.hits < creep.hitsMax * 0.5) return;
        if(bank.hits <= this.config().holdHits){
            let hauler = creep.room.find(FIND_MY_CREEPS, { filter: c => c.memory.op === op.id && c.memory.role === "harvester" })[0];
            if(!hauler) return;
        }
        creep.attack(bank);
    },

    // Power hauler found nothing to pick up: head home if carrying, else
    // wait near the bank (out of the attackers' way).
    haulerIdle(creep){
        if(creep.store.getUsedCapacity() > 0){
            creep.memory.working = false;
            return;
        }
        let op = this.mem().ops[creep.memory.op];
        if(!op){ creep.suicide(); return; }
        let pos = new RoomPosition(op.x, op.y, op.room);
        if(!creep.pos.inRangeTo(pos, 3)){
            require("./util").moveToTarget(creep, { range: 3 }, pos);
        }
    },

    report(){
        let cfg = this.config();
        let lines = ["=== Power ==="];
        let homes = this.homes();
        lines.push("RCL 8 homes: "+homes.map(h => h.name+(h.find(FIND_MY_STRUCTURES, { filter: s => s.structureType === STRUCTURE_OBSERVER }).length ? " [observer]" : "")).join(", "));
        let intelRooms = (Memory.intel && Memory.intel.rooms) || {};
        let banks = Object.keys(intelRooms).filter(n => intelRooms[n].powerBank);
        lines.push("Known banks: "+(banks.length ? banks.map(n => { let b = intelRooms[n].powerBank;
            return n+" "+b.power+"p "+Math.round(b.hits/1000)+"k hits, "+b.open+" open, decays in "+(b.decayAt - Game.time)+" (seen "+(Game.time - b.seen)+" ago)"; }).join("; ") : "none"));
        for(let op of Object.values(this.mem().ops)){
            let a = this.crewOf(op, "attack").length, h = this.crewOf(op, "healer").length, c = this.crewOf(op, "harvester").length;
            lines.push("Op "+op.room+" from "+op.home+": "+op.status+", "+op.power+" power, "+Math.round((op.hits || 0)/1000)+"k hits, "
                +a+" attackers / "+h+" healers / "+c+" haulers alive, "+this.queued(op).length+" queued, pairs "+op.pairs);
        }
        let hist = (this.mem().history || []).slice(-5);
        if(hist.length) lines.push("Recent: "+hist.map(x => x.room+" "+x.power+"p "+x.result).join("; "));
        lines.push("Limits: range "+cfg.maxRange+", minPower "+cfg.minPower+", maxOps "+cfg.maxOps);
        console.log(lines.join("\n"));
        return OK;
    },
};
