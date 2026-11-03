/* eslint-disable no-undef */
// Empire logistics: demand-driven resource sharing between owned rooms.
//
// Each pass (every RUN_INTERVAL ticks) builds a ledger for every owned room
// with a terminal:
//   need[r]    — how much of r the room is short for what it actually consumes
//                (lab inputs/boosters, factory recipe, nuker G, power spawn,
//                manual wants, energy below its low band)
//   surplus[r] — how much of r it holds beyond its own demand (energy: above
//                its donor floor; weak 1-source rooms never donate energy)
// The broker then fills needs in priority order from the cheapest donor
// (shortest terminal distance). Mining rooms never choose destinations; they
// just advertise surplus. Anything still over the empire-wide cap afterwards
// is sold.
//
// Terminal sends land next tick, so the next pass sees real stock; within a
// pass, ledgers are adjusted as sends are scheduled so two donors never fill
// the same need. Each terminal acts at most once per pass (10-tick cooldown).
//
// Tunables live in DEFAULTS and can be overridden at runtime via
// Memory.logistics.config (empire) and Memory.logistics.rooms[name] (per room).
// Per-room settings live under Memory.logistics (not room.memory) so all
// logistics tuning is in one place.

const BASE_MINERALS = [RESOURCE_HYDROGEN, RESOURCE_OXYGEN, RESOURCE_UTRIUM, RESOURCE_LEMERGIUM,
    RESOURCE_KEANIUM, RESOURCE_ZYNTHIUM, RESOURCE_CATALYST];

const DEFAULTS = {
    runInterval: 10,
    minSend: 1000,          // smallest non-energy send worth a terminal cooldown
    maxSend: 10000,         // largest single non-energy send
    terminalStock: 10000,   // how much exportable surplus to keep staged in the terminal
    terminalEnergyReserve: 10000, // terminal energy a send must leave behind
    labBuffer: 3000,        // extra held per reaction input so labs never starve
    boosterBuffer: 1000,    // extra held per booster lab compound
    nukerGhodium: false,    // count nuker G capacity as demand
    factoryBatches: 10,     // factory component demand = recipe amount x batches
    energy: {
        // Effective energy = storage + terminal energy above the terminal's
        // working level (transporters keep the terminal near 50k as send fuel,
        // and drain anything above 55k into storage).
        terminalWorkingLevel: 50000,
        strong: { low: 40000, target: 60000, donorFloor: 120000 },
        weak:   { low: 80000, target: 100000, donorFloor: Infinity },
        emergency: 20000,   // below this the need jumps to top priority
        // RCL 8 rooms can only spend 15 energy/tick upgrading, so their
        // surplus is worth more in uncapped RCL < 8 rooms. Sink needs are the
        // lowest priority and are only filled by RCL 8 donors.
        rcl8: { donorFloor: 100000 },
        upgradeSink: { enabled: true, target: 150000 },
        minSend: 5000,
        maxSend: 20000,
    },
    // Empire-wide totals above which a resource is sold. Resources not listed
    // are never auto-sold. Base minerals are kept generously for reactions.
    sellCap: BASE_MINERALS.reduce((o, r) => { o[r] = 100000; return o; }, {}),
    sellBatch: 5000,
    maxSellsPerPass: 1,     // market sales queued per pass, empire-wide
    minPrice: {},           // optional { resource: credits } floor for auto-sells
    historySize: 30,
};

const PRIORITY = { emergency: 0, boost: 1, reaction: 2, factory: 3, energy: 4, structure: 5, manual: 6, sink: 7 };

function deepMerge(base, over){
    if(!over || typeof over !== "object") return base;
    let out = Array.isArray(base) ? base.slice() : Object.assign({}, base);
    for(let k of Object.keys(over)){
        let b = base ? base[k] : undefined;
        out[k] = (b && typeof b === "object" && !Array.isArray(b) && typeof over[k] === "object")
            ? deepMerge(b, over[k]) : over[k];
    }
    return out;
}

module.exports = {
    DEFAULTS,
    BASE_MINERALS,

    mem(){
        if(!Memory.logistics) Memory.logistics = {};
        if(!Memory.logistics.config) Memory.logistics.config = {};
        if(!Memory.logistics.rooms) Memory.logistics.rooms = {};
        if(!Memory.logistics.history) Memory.logistics.history = [];
        return Memory.logistics;
    },

    config(){
        if(this._cfgTick !== Game.time){
            this._cfg = deepMerge(DEFAULTS, this.mem().config);
            this._cfgTick = Game.time;
        }
        return this._cfg;
    },

    roomConfig(roomName){
        return this.mem().rooms[roomName] || {};
    },

    myRooms(){
        return Object.values(Game.rooms).filter(r => r.controller && r.controller.my);
    },

    // A room is "weak" when it has fewer than 2 energy sources. Can be forced
    // either way with Memory.logistics.rooms[name].weak = true/false.
    isWeak(room){
        let rc = this.roomConfig(room.name);
        if(rc.weak !== undefined) return !!rc.weak;
        return room.find(FIND_SOURCES).length < 2;
    },

    energyBands(room){
        let cfg = this.config();
        let bands = Object.assign({}, this.isWeak(room) ? cfg.energy.weak : cfg.energy.strong);
        if(room.controller && room.controller.level === 8) Object.assign(bands, cfg.energy.rcl8);
        return Object.assign(bands, this.roomConfig(room.name).energy || {});
    },

    effectiveEnergy(room){
        let cfg = this.config();
        let stored = room.storage ? room.storage.store[RESOURCE_ENERGY] : 0;
        let term = room.terminal ? room.terminal.store[RESOURCE_ENERGY] : 0;
        return stored + Math.max(0, term - cfg.energy.terminalWorkingLevel);
    },

    // Demand per resource for what the room actually consumes, plus what's
    // already in place at the consumer (labs / factory) so it isn't counted
    // as either a need or a surplus. Cached per tick.
    demand(room){
        this._demand = this._demand && this._demand.tick === Game.time ? this._demand : { tick: Game.time };
        if(this._demand[room.name]) return this._demand[room.name];

        let cfg = this.config();
        let want = {};      // resource -> { amount, priority }
        let inPlace = {};   // resource -> amount sitting in consumers
        let add = (r, amount, priority) => {
            if(!r || r === RESOURCE_ENERGY || !(amount > 0)) return;
            if(!want[r]) want[r] = { amount: 0, priority };
            want[r].amount += amount;
            want[r].priority = Math.min(want[r].priority, priority);
        };
        let place = (r, amount) => { if(amount > 0) inPlace[r] = (inPlace[r] || 0) + amount; };

        let labs = room.find(FIND_MY_STRUCTURES, { filter: s => s.structureType === STRUCTURE_LAB });
        let labResources = {};
        for(let lab of labs){
            let role = lab.memory.role;
            let r = lab.memory.resource;
            if(!r || role === "output" || role === "idle") continue;
            add(r, lab.memory.amount || 2000, role === "booster" ? PRIORITY.boost : PRIORITY.reaction);
            place(r, lab.store[r] || 0);
            labResources[r] = Math.max(labResources[r] || 0, role === "booster" ? cfg.boosterBuffer : cfg.labBuffer);
        }
        for(let r of Object.keys(labResources)){
            add(r, labResources[r], want[r].priority);
        }

        let factory = room.factory;
        if(factory && factory.memory.enabled !== false && factory.memory.target && COMMODITIES[factory.memory.target]){
            let comps = COMMODITIES[factory.memory.target].components;
            for(let c of Object.keys(comps)){
                add(c, comps[c] * cfg.factoryBatches, PRIORITY.factory);
                place(c, factory.store[c] || 0);
            }
        }

        // Off by default: nothing loads the nuker yet, so the G would sit in
        // storage reserved, away from the GH reaction (GCL focus).
        let nuker = cfg.nukerGhodium && room.find(FIND_MY_STRUCTURES, { filter: s => s.structureType === STRUCTURE_NUKER })[0];
        if(nuker){
            let free = nuker.store.getFreeCapacity(RESOURCE_GHODIUM) || 0;
            if(free > 0) add(RESOURCE_GHODIUM, free, PRIORITY.structure);
        }
        let ps = room.find(FIND_MY_STRUCTURES, { filter: s => s.structureType === STRUCTURE_POWER_SPAWN })[0];
        if(ps){
            add(RESOURCE_POWER, 1000, PRIORITY.structure);
            place(RESOURCE_POWER, ps.store[RESOURCE_POWER] || 0);
        }

        let wants = this.roomConfig(room.name).wants || {};
        for(let r of Object.keys(wants)) add(r, wants[r], PRIORITY.manual);

        let res = { want, inPlace };
        this._demand[room.name] = res;
        return res;
    },

    held(room, r){
        return (room.storage ? room.storage.store[r] || 0 : 0) + (room.terminal ? room.terminal.store[r] || 0 : 0);
    },

    // How much of r this room can give away (non-energy).
    surplusOf(room, r){
        if(r === RESOURCE_ENERGY){
            let bands = this.energyBands(room);
            if(!isFinite(bands.donorFloor)) return 0;
            return Math.max(0, this.effectiveEnergy(room) - bands.donorFloor);
        }
        if(this.roomConfig(room.name).export === false) return 0;
        let d = this.demand(room);
        let keep = d.want[r] ? Math.max(0, d.want[r].amount - (d.inPlace[r] || 0)) : 0;
        return Math.max(0, this.held(room, r) - keep);
    },

    // How much of a (non-energy) resource the room wants sitting in its
    // terminal: its exportable surplus, staged up to terminalStock. Used by
    // the transporters to balance storage <-> terminal. Imports the room
    // needs itself have a target of 0 here but are left in the terminal
    // unless it's over target by a margin (labs/factory pull from either).
    terminalTarget(room, r){
        if(r === RESOURCE_ENERGY) return this.config().energy.terminalWorkingLevel;
        return Math.min(this.surplusOf(room, r), this.config().terminalStock);
    },

    buildLedger(room){
        let cfg = this.config();
        let needs = [];
        let d = this.demand(room);
        for(let r of Object.keys(d.want)){
            let have = this.held(room, r) + (d.inPlace[r] || 0);
            let short = d.want[r].amount - have;
            if(short >= cfg.minSend) needs.push({ room: room.name, resource: r, amount: short, priority: d.want[r].priority });
        }
        let bands = this.energyBands(room);
        let e = this.effectiveEnergy(room);
        if(e < bands.low){
            let amount = bands.target - e;
            needs.push({
                room: room.name, resource: RESOURCE_ENERGY, amount,
                priority: e < cfg.energy.emergency ? PRIORITY.emergency : PRIORITY.energy,
            });
        }else if(this.isUpgradeSink(room) && e < cfg.energy.upgradeSink.target){
            needs.push({ room: room.name, resource: RESOURCE_ENERGY, amount: cfg.energy.upgradeSink.target - e,
                priority: PRIORITY.sink, sink: true });
        }
        return needs;
    },

    isUpgradeSink(room){
        let sink = this.config().energy.upgradeSink;
        let rc = this.roomConfig(room.name);
        if(rc.upgradeSink !== undefined) return !!rc.upgradeSink;
        return sink.enabled && room.controller.level < 8;
    },

    record(entry){
        let m = this.mem();
        m.history.push(Object.assign({ tick: Game.time }, entry));
        let max = this.config().historySize;
        if(m.history.length > max) m.history.splice(0, m.history.length - max);
    },

    run(){
        let cfg = this.config();
        if(Game.time % cfg.runInterval !== 0) return;

        let rooms = this.myRooms().filter(r => r.terminal && r.terminal.my && r.controller.level >= 6);
        if(rooms.length === 0) return;

        // Terminals still working through queued market deals are busy.
        let used = new Set(rooms.filter(r => r.terminal.cooldown > 0
            || (r.terminal.memory.deals && r.terminal.memory.deals.length)).map(r => r.name));

        // Scheduled adjustments within this pass: [room][resource] -> delta
        let pending = {};
        let adj = (room, r, delta) => {
            pending[room] = pending[room] || {};
            pending[room][r] = (pending[room][r] || 0) + delta;
        };
        let pend = (room, r) => (pending[room] && pending[room][r]) || 0;

        let needs = [];
        for(let room of rooms) needs.push(...this.buildLedger(room));
        needs.sort((a, b) => a.priority - b.priority || b.amount - a.amount);

        for(let need of needs){
            let dst = Game.rooms[need.room];
            let isEnergy = need.resource === RESOURCE_ENERGY;
            let minSend = isEnergy ? cfg.energy.minSend : cfg.minSend;
            let maxSend = isEnergy ? cfg.energy.maxSend : cfg.maxSend;
            let remaining = need.amount + pend(need.room, need.resource);
            if(remaining < minSend) continue;
            if(dst.terminal.store.getFreeCapacity() < minSend) continue;

            let best = null;
            for(let src of rooms){
                if(src.name === dst.name || used.has(src.name)) continue;
                if(need.sink && src.controller.level < 8) continue;
                let surplus = this.surplusOf(src, need.resource) + pend(src.name, need.resource);
                let inTerminal = src.terminal.store[need.resource] || 0;
                let termEnergy = src.terminal.store[RESOURCE_ENERGY] || 0;
                if(isEnergy) inTerminal = Math.max(0, inTerminal - cfg.terminalEnergyReserve);
                let amount = Math.min(remaining, surplus, inTerminal, maxSend, dst.terminal.store.getFreeCapacity());
                if(amount < minSend) continue;
                let cost = Game.market.calcTransactionCost(amount, src.name, dst.name);
                let energyNeeded = cost + (isEnergy ? amount : 0) + cfg.terminalEnergyReserve;
                if(termEnergy < energyNeeded) continue;
                let distance = Game.map.getRoomLinearDistance(src.name, dst.name, true);
                if(!best || distance < best.distance || (distance === best.distance && amount > best.amount)){
                    best = { src, amount, cost, distance };
                }
            }
            if(!best) continue;

            let result = best.src.terminal.send(need.resource, best.amount, dst.name, "logistics");
            used.add(best.src.name);
            if(result === OK){
                adj(need.room, need.resource, -best.amount);
                adj(best.src.name, need.resource, -best.amount);
                console.log("[Logistics] "+best.src.name+" -> "+dst.name+": "+best.amount+" "+need.resource
                    +" (need "+need.amount+", p"+need.priority+", cost "+best.cost+"e)");
                this.record({ type: "send", from: best.src.name, to: dst.name, resource: need.resource,
                    amount: best.amount, cost: best.cost, priority: need.priority });
            }else{
                console.log("[Logistics] send "+best.src.name+" -> "+dst.name+" "+best.amount+" "+need.resource+" failed: "+result);
            }
        }

        this.sellOverflow(rooms, used, pend);
    },

    // Sell whatever is over the empire-wide cap, from the room holding the
    // most of it in its terminal. One sale per terminal per pass.
    sellOverflow(rooms, used, pend){
        let cfg = this.config();
        let sells = 0;
        for(let r of Object.keys(cfg.sellCap)){
            if(sells >= cfg.maxSellsPerPass) break;
            let cap = cfg.sellCap[r];
            let total = 0;
            for(let room of rooms) total += this.held(room, r) + pend(room.name, r);
            let excess = total - cap;
            if(excess < cfg.minSend) continue;

            let candidates = rooms.filter(room => !used.has(room.name)
                && this.surplusOf(room, r) > 0 && (room.terminal.store[r] || 0) >= cfg.minSend)
                .sort((a, b) => (b.terminal.store[r] || 0) - (a.terminal.store[r] || 0));
            if(!candidates.length) continue;
            let room = candidates[0];
            let amount = Math.min(excess, cfg.sellBatch, room.terminal.store[r], this.surplusOf(room, r));
            if(amount < cfg.minSend) continue;

            let queued = require("./rooms").sellForeignResources(room, r, amount, cfg.minPrice[r]);
            used.add(room.name);
            if(queued){
                sells++;
                this.record({ type: "sell", from: room.name, resource: r, amount, empireTotal: total, cap });
            }
        }
    },

    // Console report: per-room energy state, needs and surpluses.
    report(){
        let cfg = this.config();
        let rooms = this.myRooms().sort((a, b) => a.name.localeCompare(b.name));
        let lines = ["=== Logistics (run every "+cfg.runInterval+" ticks) ==="];
        for(let room of rooms){
            let tag = room.name+" RCL"+room.controller.level+(this.isWeak(room) ? " [weak]" : "");
            if(!room.terminal){ lines.push(tag+": no terminal — not in the network"); continue; }
            let b = this.energyBands(room);
            let e = this.effectiveEnergy(room);
            let state = e < b.low ? "NEED" : (isFinite(b.donorFloor) && e > b.donorFloor ? "donor"
                : (this.isUpgradeSink(room) && e < cfg.energy.upgradeSink.target ? "upgrade sink" : "ok"));
            lines.push(tag+": energy "+Math.round(e/1000)+"k ["+state+"; low "+b.low/1000+"k, target "+b.target/1000
                +"k, donor "+(isFinite(b.donorFloor) ? b.donorFloor/1000+"k" : "never")+"]");
            let needs = this.buildLedger(room).filter(n => n.resource !== RESOURCE_ENERGY);
            if(needs.length) lines.push("    needs:   "+needs.map(n => n.resource+" "+n.amount+" (p"+n.priority+")").join(", "));
            let res = new Set([...Object.keys(room.storage ? room.storage.store : {}), ...Object.keys(room.terminal.store)]);
            let surplus = [...res].filter(r => r !== RESOURCE_ENERGY).map(r => [r, this.surplusOf(room, r)]).filter(x => x[1] > 0);
            if(surplus.length) lines.push("    surplus: "+surplus.map(x => x[0]+" "+x[1]).join(", "));
        }
        let totals = {};
        for(let room of rooms){
            if(!room.terminal) continue;
            for(let r of Object.keys(cfg.sellCap)) totals[r] = (totals[r] || 0) + this.held(room, r);
        }
        lines.push("Empire totals vs sell cap: "+Object.keys(totals).map(r => r+" "+Math.round(totals[r]/1000)+"k/"+Math.round(cfg.sellCap[r]/1000)+"k").join(", "));
        let hist = this.mem().history.slice(-10);
        if(hist.length){
            lines.push("Recent:");
            for(let h of hist){
                lines.push("    "+h.tick+" "+h.type+" "+(h.type === "send" ? h.from+" -> "+h.to : h.from)+" "+h.amount+" "+h.resource);
            }
        }
        console.log(lines.join("\n"));
        return OK;
    },
};
