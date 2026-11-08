/* eslint-disable no-undef */
// Power creeps (operators).
//
// Each operator lives in one home room (Memory.powerCreeps[name].home, picked
// automatically: an RCL 8 room with a power spawn and no other operator) and
// every tick:
//   1. Spawns at the home power spawn if it isn't alive (respecting the
//      engine's spawn cooldown).
//   2. Renews at the power spawn when ticksToLive drops below renewAt — an
//      operator that runs out goes on a long respawn cooldown.
//   3. Enables the home controller for powers (one time).
//   4. Uses the first useful power it has, in priority order:
//        Operate Tower      hostiles in the room, tower not yet boosted
//        Operate Extension  extensions below extensionFill, energy in storage
//        Regen Source       a source without the effect
//        Operate Spawn      spawn queue backed up (>= spawnQueueMin)
//        Operate Lab        an output lab of a running reaction, not boosted
//        Generate Ops       whenever it's off cooldown and there's room
//      Powers that cost ops are skipped until the ops are carried; ops in the
//      terminal/storage are withdrawn for them. Generate Ops is also used
//      while walking to another power's target.
//   5. Idle: carries at most opsKeep ops (the rest goes to the terminal or
//      storage) and waits near storage.
// Creating operators and spending GPL points is manual (cmd.createOperator,
// cmd.upgradePowerCreep). Powers not listed in config.powers are never used —
// notably Operate Factory, which permanently sets the factory's level.

const util = require("./util");

const DEFAULTS = {
    renewAt: 500,             // ticksToLive below which the operator goes to renew
    opsKeep: 300,             // ops carried; the excess is stored
    extensionFill: 0.5,       // Operate Extension below this fraction of energy capacity
    extensionMinStorage: 20000, // ...when storage has at least this much energy
    spawnQueueMin: 2,         // Operate Spawn when this many creeps are queued
    powers: {                 // enabled powers (true) — anything else is never used
        [PWR_GENERATE_OPS]: true,
        [PWR_OPERATE_TOWER]: true,
        [PWR_OPERATE_EXTENSION]: true,
        [PWR_REGEN_SOURCE]: true,
        [PWR_OPERATE_SPAWN]: true,
        [PWR_OPERATE_LAB]: true,
    },
};

function deepMerge(base, over){
    if(!over || typeof over !== "object") return base;
    let out = Object.assign({}, base);
    for(let k of Object.keys(over)){
        let b = base ? base[k] : undefined;
        out[k] = (b && typeof b === "object" && typeof over[k] === "object") ? deepMerge(b, over[k]) : over[k];
    }
    return out;
}

module.exports = {
    DEFAULTS,

    config(){
        if(this._cfgTick !== Game.time){
            if(!Memory.powerCreepConfig) Memory.powerCreepConfig = {};
            this._cfg = deepMerge(DEFAULTS, Memory.powerCreepConfig);
            this._cfgTick = Game.time;
        }
        return this._cfg;
    },

    mem(name){
        if(!Memory.powerCreeps) Memory.powerCreeps = {};
        if(!Memory.powerCreeps[name]) Memory.powerCreeps[name] = {};
        return Memory.powerCreeps[name];
    },

    powerSpawn(room){
        return room ? room.find(FIND_MY_STRUCTURES, { filter: s => s.structureType === STRUCTURE_POWER_SPAWN })[0] : null;
    },

    // Home room name; assigned on first use to an RCL 8 room with a power
    // spawn that no other operator calls home.
    home(pc){
        let m = this.mem(pc.name);
        if(m.home) return m.home;
        let taken = new Set(Object.keys(Game.powerCreeps).map(n => this.mem(n).home).filter(Boolean));
        let room = Object.values(Game.rooms).find(r => r.controller && r.controller.my && r.controller.level === 8
            && !taken.has(r.name) && this.powerSpawn(r));
        if(room){
            m.home = room.name;
            console.log("[PowerCreep] "+pc.name+": home set to "+room.name);
        }
        return m.home || null;
    },

    hasEffect(obj, power){
        return (obj.effects || []).some(e => (e.effect === power || e.power === power) && e.ticksRemaining > 1);
    },

    opsCost(pc, power){
        let o = POWER_INFO[power].ops || 0;
        return Array.isArray(o) ? o[pc.powers[power].level - 1] : o;
    },

    ready(pc, power){
        let p = pc.powers[power];
        return !!p && !p.cooldown && this.config().powers[power] === true;
    },

    opsHeld(pc){
        return pc.store[RESOURCE_OPS] || 0;
    },

    opsStore(room){
        return [room.terminal, room.storage].find(s => s && (s.store[RESOURCE_OPS] || 0) > 0) || null;
    },

    run(){
        if(!Game.powerCreeps) return;
        for(let name in Game.powerCreeps){
            try{
                this.runOne(Game.powerCreeps[name]);
            }catch(e){
                console.log("[PowerCreep] "+name+": "+(e && e.stack ? e.stack : e));
            }
        }
    },

    runOne(pc){
        if(pc.className !== POWER_CLASS.OPERATOR) return;
        let home = this.home(pc);
        if(!home) return;
        if(!pc.ticksToLive){ this.trySpawn(pc, home); return; }
        if(pc.shard && pc.shard !== Game.shard.name) return;
        let room = Game.rooms[home];
        if(!room) return;

        if(pc.ticksToLive < this.config().renewAt && this.renew(pc, room)) return;
        if(pc.room.name !== home){
            util.moveToTarget(pc, { range: 20 }, new RoomPosition(25, 25, home));
            return;
        }
        if(!room.controller.isPowerEnabled){
            if(pc.pos.isNearTo(room.controller)) pc.enableRoom(room.controller);
            else util.moveToTarget(pc, { range: 1 }, room.controller);
            return;
        }

        let job = this.pickJob(pc, room);
        if(job) this.doJob(pc, job);
        else this.idle(pc, room);
    },

    trySpawn(pc, home){
        if(pc.spawnCooldownTime && pc.spawnCooldownTime > Date.now()) return;
        let ps = this.powerSpawn(Game.rooms[home]);
        if(!ps) return;
        let r = pc.spawn(ps);
        if(r === OK) console.log("[PowerCreep] "+pc.name+": spawned in "+home);
        else if(r !== ERR_BUSY) console.log("[PowerCreep] "+pc.name+": spawn in "+home+" failed ("+r+")");
    },

    renew(pc, room){
        let ps = this.powerSpawn(room);
        if(!ps) return false;
        if(pc.pos.isNearTo(ps)){
            if(pc.renew(ps) === OK) console.log("[PowerCreep] "+pc.name+": renewed");
        }else{
            util.moveToTarget(pc, { range: 1 }, ps);
        }
        return true;
    },

    // The highest-priority power worth using now: { power, target } or a
    // { withdraw } job to fetch the ops it needs. null when nothing to do.
    pickJob(pc, room){
        let cfg = this.config();
        let cands = [];
        let my = (type) => room.find(FIND_MY_STRUCTURES, { filter: s => s.structureType === type });

        if(room.find(FIND_HOSTILE_CREEPS).length){
            let tower = my(STRUCTURE_TOWER).find(t => !this.hasEffect(t, PWR_OPERATE_TOWER));
            if(tower) cands.push({ power: PWR_OPERATE_TOWER, target: tower });
        }
        let source = room.storage && (room.storage.store[RESOURCE_ENERGY] || 0) >= cfg.extensionMinStorage ? room.storage
            : room.terminal && (room.terminal.store[RESOURCE_ENERGY] || 0) >= cfg.extensionMinStorage ? room.terminal : null;
        if(source && room.energyAvailable < room.energyCapacityAvailable * cfg.extensionFill){
            cands.push({ power: PWR_OPERATE_EXTENSION, target: source });
        }
        let regen = room.find(FIND_SOURCES).find(s => !this.hasEffect(s, PWR_REGEN_SOURCE));
        if(regen) cands.push({ power: PWR_REGEN_SOURCE, target: regen });
        if((room.memory.spawnQueue || []).length >= cfg.spawnQueueMin){
            let spawn = my(STRUCTURE_SPAWN).find(s => !this.hasEffect(s, PWR_OPERATE_SPAWN));
            if(spawn) cands.push({ power: PWR_OPERATE_SPAWN, target: spawn });
        }
        let production = require("./production");
        if(production.roomMem(room.name).job){
            let lab = production.roles(room).outputs.map(id => Game.getObjectById(id))
                .find(l => l && !this.hasEffect(l, PWR_OPERATE_LAB));
            if(lab) cands.push({ power: PWR_OPERATE_LAB, target: lab });
        }
        if(pc.store.getFreeCapacity() > 0) cands.push({ power: PWR_GENERATE_OPS });

        for(let c of cands){
            if(!this.ready(pc, c.power)) continue;
            let need = this.opsCost(pc, c.power);
            if(this.opsHeld(pc) >= need) return c;
            let store = this.opsStore(room);
            if(store && this.opsHeld(pc) + (store.store[RESOURCE_OPS] || 0) >= need){
                let amount = Math.min(store.store[RESOURCE_OPS], pc.store.getFreeCapacity(), Math.max(need, cfg.opsKeep) - this.opsHeld(pc));
                return { withdraw: store, amount };
            }
        }
        return null;
    },

    doJob(pc, job){
        if(job.withdraw){
            if(pc.pos.isNearTo(job.withdraw)) pc.withdraw(job.withdraw, RESOURCE_OPS, job.amount);
            else this.walk(pc, job.withdraw, 1);
            return;
        }
        let range = POWER_INFO[job.power].range;
        if(job.target && range !== undefined && !pc.pos.inRangeTo(job.target, range)){
            this.walk(pc, job.target, range);
            return;
        }
        let r = pc.usePower(job.power, job.target);
        if(r !== OK) console.log("[PowerCreep] "+pc.name+": usePower "+job.power+" failed ("+r+")");
    },

    // Move, generating ops on the way when that's free to do.
    walk(pc, target, range){
        util.moveToTarget(pc, { range }, target);
        if(this.ready(pc, PWR_GENERATE_OPS) && pc.store.getFreeCapacity() > 0) pc.usePower(PWR_GENERATE_OPS);
    },

    idle(pc, room){
        let cfg = this.config();
        let held = this.opsHeld(pc);
        let dump = [room.terminal, room.storage].find(s => s && s.store.getFreeCapacity() > 0);
        if(dump && held > cfg.opsKeep){
            if(pc.pos.isNearTo(dump)) pc.transfer(dump, RESOURCE_OPS, held - cfg.opsKeep);
            else util.moveToTarget(pc, { range: 1 }, dump);
            return;
        }
        // wait near storage (where Operate Extension is used) on an off-road tile,
        // so haulers and workers aren't blocked by a parked operator
        let spot = this.parkSpot(pc, room);
        if(spot && !pc.pos.isEqualTo(spot)) util.moveToTarget(pc, { range: 0 }, spot);
        else if(!spot && room.storage && !pc.pos.inRangeTo(room.storage, 3)) util.moveToTarget(pc, { range: 3 }, room.storage);
    },

    // A free tile 2-3 from storage with no road or other structure on it.
    // Cached in memory; re-picked when it becomes built on or occupied.
    parkSpot(pc, room){
        if(!room.storage) return null;
        let m = this.mem(pc.name);
        let free = (x, y) => {
            if(x < 1 || x > 48 || y < 1 || y > 48) return false;
            if(room.getTerrain().get(x, y) === TERRAIN_MASK_WALL) return false;
            let pos = new RoomPosition(x, y, room.name);
            if(pos.lookFor(LOOK_STRUCTURES).length || pos.lookFor(LOOK_CONSTRUCTION_SITES).length) return false;
            if(pos.lookFor(LOOK_CREEPS).length) return false;
            if(pos.lookFor(LOOK_POWER_CREEPS).some(c => c.id !== pc.id)) return false;
            return true;
        };
        if(m.park && m.park.room === room.name && free(m.park.x, m.park.y)) return new RoomPosition(m.park.x, m.park.y, room.name);
        let s = room.storage.pos, best = null, bestRange = Infinity;
        for(let dx = -3; dx <= 3; dx++) for(let dy = -3; dy <= 3; dy++){
            let r = Math.max(Math.abs(dx), Math.abs(dy));
            if(r < 2 || !free(s.x + dx, s.y + dy)) continue;
            let d = pc.pos.roomName === room.name ? pc.pos.getRangeTo(s.x + dx, s.y + dy) : 0;
            if(d < bestRange){ best = { x: s.x + dx, y: s.y + dy, room: room.name }; bestRange = d; }
        }
        m.park = best;
        return best ? new RoomPosition(best.x, best.y, room.name) : null;
    },

    // GPL points not yet spent: each operator costs 1 to create plus 1 per level.
    freeGpl(){
        let used = Object.values(Game.powerCreeps).reduce((s, pc) => s + pc.level + 1, 0);
        return Game.gpl.level - used;
    },

    report(){
        let lines = ["=== Power creeps ==="];
        lines.push("GPL "+Game.gpl.level+" ("+Game.gpl.progress+"/"+Game.gpl.progressTotal+"), unspent points: "+this.freeGpl());
        let pcs = Object.values(Game.powerCreeps);
        if(!pcs.length) lines.push("none — Game.cmd.createOperator(name, room) once a GPL point is free");
        for(let pc of pcs){
            let powers = Object.keys(pc.powers).map(p => {
                let name = Object.keys(global).find(k => k.startsWith("PWR_") && global[k] === +p) || p;
                return name.replace("PWR_", "")+" L"+pc.powers[p].level+(pc.powers[p].cooldown ? " (cd "+pc.powers[p].cooldown+")" : "");
            });
            let state = pc.ticksToLive ? "alive in "+pc.room.name+", ttl "+pc.ticksToLive+", ops "+this.opsHeld(pc)
                : "not spawned"+(pc.spawnCooldownTime && pc.spawnCooldownTime > Date.now() ? " (cooldown until "+new Date(pc.spawnCooldownTime).toISOString()+")" : "");
            lines.push(pc.name+" "+pc.className+" L"+pc.level+", home "+(this.mem(pc.name).home || "unassigned")+": "+state);
            lines.push("    powers: "+(powers.length ? powers.join(", ") : "none — Game.cmd.upgradePowerCreep(name, PWR_GENERATE_OPS)"));
        }
        console.log(lines.join("\n"));
        return OK;
    },
};
