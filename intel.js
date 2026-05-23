/* eslint-disable no-undef */

// Tier 3 room intelligence.
//
// Passive per-tick observation of every room we currently have vision in.
// Records owner / reservation / hostility / SK status into Memory.intel.rooms[name].
// Exports a routeCallback(roomName) suitable for Traveler.travelTo, which:
//   - Forbids rooms marked avoid: true (user override).
//   - Forbids rooms recently observed hostile (within Memory.intel.hostileTTL).
//   - Discourages Source Keeper rooms with a 2.5x cost.
//   - Returns undefined otherwise so Traveler's built-in heuristics apply.

const DEFAULT_HOSTILE_TTL = 5000;
const DEFAULT_INTEL_AGE = 20000;
const SK_ROOM_COST = 2.5;

function ensure() {
    if (!Memory.intel) Memory.intel = {};
    if (!Memory.intel.rooms) Memory.intel.rooms = {};
    if (Memory.intel.hostileTTL === undefined) Memory.intel.hostileTTL = DEFAULT_HOSTILE_TTL;
    if (Memory.intel.intelMaxAge === undefined) Memory.intel.intelMaxAge = DEFAULT_INTEL_AGE;
    if (!Memory.intel.username) {
        for (const name in Game.spawns) { Memory.intel.username = Game.spawns[name].owner.username; break; }
    }
    return Memory.intel;
}

function isSourceKeeperByName(roomName) {
    const parsed = /^[WE](\d+)[NS](\d+)$/.exec(roomName);
    if (!parsed) return false;
    const fMod = parsed[1] % 10, sMod = parsed[2] % 10;
    return !(fMod === 5 && sMod === 5)
        && (fMod >= 4 && fMod <= 6)
        && (sMod >= 4 && sMod <= 6);
}

function update() {
    const intel = ensure();
    const me = intel.username;
    for (const name in Game.rooms) {
        const room = Game.rooms[name];
        const r = intel.rooms[name] || (intel.rooms[name] = {});
        r.lastScouted = Game.time;

        const c = room.controller;
        r.owner      = (c && c.owner)       ? c.owner.username       : null;
        r.reservedBy = (c && c.reservation) ? c.reservation.username : null;

        if (r.sourceKeeper === undefined) {
            // Once true this never flips back, so we only check on first observation.
            const lairs = room.find(FIND_STRUCTURES, {
                filter: s => s.structureType === STRUCTURE_KEEPER_LAIR,
            });
            r.sourceKeeper = lairs.length > 0;
        }

        const hostileCreeps = room.find(FIND_HOSTILE_CREEPS);
        const hostileStructs = room.find(FIND_HOSTILE_STRUCTURES, {
            filter: s => s.structureType !== STRUCTURE_CONTROLLER,
        });
        const ownerHostile = r.owner && r.owner !== me;

        if (hostileCreeps.length || hostileStructs.length || ownerHostile) {
            r.hostile = true;
            r.hostileSeen = Game.time;
        } else if (r.hostile && (Game.time - (r.hostileSeen || 0)) > intel.hostileTTL) {
            r.hostile = false;
        }
    }
}

function routeCallback(roomName) {
    const r = Memory.intel && Memory.intel.rooms ? Memory.intel.rooms[roomName] : null;
    if (r) {
        if (r.avoid) return Number.POSITIVE_INFINITY;
        if (r.hostile && (Game.time - (r.hostileSeen || 0)) < (Memory.intel.hostileTTL || DEFAULT_HOSTILE_TTL)) {
            return Number.POSITIVE_INFINITY;
        }
        if (r.sourceKeeper) return SK_ROOM_COST;
    } else if (isSourceKeeperByName(roomName)) {
        return SK_ROOM_COST;
    }
    return undefined;
}

function cleanup() {
    if (!Memory.intel || !Memory.intel.rooms) return;
    const maxAge = Memory.intel.intelMaxAge || DEFAULT_INTEL_AGE;
    for (const name in Memory.intel.rooms) {
        const r = Memory.intel.rooms[name];
        if (Game.time - (r.lastScouted || 0) > maxAge) {
            delete Memory.intel.rooms[name];
        }
    }
}

module.exports = { update, routeCallback, cleanup };
