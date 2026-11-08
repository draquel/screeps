/* eslint-disable no-undef */

// Tier 2 traffic manager.
//
// Replaces direct creep.move() execution with an "intent + resolve" phase so we
// can detect cases the engine cannot resolve on its own:
//   * Idle friendly blocker: a creep with no move intent is sitting on the tile
//     an active mover wants. Give the blocker a one-tile shove so the mover can
//     pass; cleared next tick when the blocker re-runs its role.
//
// Native Screeps already resolves swaps and conga lines atomically when both
// creeps call move() this tick, so we do NOT need explicit swap detection.
//
// Opt-out: a creep with memory.noShove = true is never shoved. Stationary roles
// (miner on container, upgrader on link) should set this on arrival so they
// aren't bumped off their work tile.
//
// Power creeps take part too: their move() is wrapped the same way, they count
// as blockers, and an idle one can be shoved. Intents are keyed by object id
// because a power creep may share a name with a creep.

const DIR_OFFSETS = {
    [TOP]:          [ 0,-1], [TOP_RIGHT]:    [ 1,-1],
    [RIGHT]:        [ 1, 0], [BOTTOM_RIGHT]: [ 1, 1],
    [BOTTOM]:       [ 0, 1], [BOTTOM_LEFT]:  [-1, 1],
    [LEFT]:         [-1, 0], [TOP_LEFT]:     [-1,-1],
};
const ALL_DIRS = [TOP,TOP_RIGHT,RIGHT,BOTTOM_RIGHT,BOTTOM,BOTTOM_LEFT,LEFT,TOP_LEFT];

let originalMove = null;
let originalPcMove = null;

function creepsAt(pos) {
    return pos.lookFor(LOOK_CREEPS).concat(pos.lookFor(LOOK_POWER_CREEPS));
}

function offsetPos(pos, dir) {
    const offset = DIR_OFFSETS[dir];
    if (!offset) return null;                 // not a valid direction constant
    const [dx, dy] = offset;
    const x = pos.x + dx, y = pos.y + dy;
    // Crossing a room border: no in-room conflict resolution possible.
    if (x < 0 || x > 49 || y < 0 || y > 49) return null;
    return new RoomPosition(x, y, pos.roomName);
}

function passable(pos, ignoreId) {
    const terrain = Game.map.getRoomTerrain(pos.roomName).get(pos.x, pos.y);
    if (terrain === TERRAIN_MASK_WALL) return false;
    const structs = pos.lookFor(LOOK_STRUCTURES);
    for (const s of structs) {
        if (s.structureType === STRUCTURE_ROAD) continue;
        if (s.structureType === STRUCTURE_CONTAINER) continue;
        if (s.structureType === STRUCTURE_RAMPART && (s.my || s.isPublic)) continue;
        if (OBSTACLE_OBJECT_TYPES.indexOf(s.structureType) >= 0) return false;
    }
    const sites = pos.lookFor(LOOK_CONSTRUCTION_SITES);
    for (const cs of sites) {
        if (cs.my && OBSTACLE_OBJECT_TYPES.indexOf(cs.structureType) >= 0) return false;
    }
    for (const c of creepsAt(pos)) {
        if (c.id !== ignoreId) return false;
    }
    return true;
}

// Pick a shove direction for an idle blocker. Prefer non-road tiles so we don't
// trade one blocker for another, and stay in working range of memory.target
// if it's nearby so the shove doesn't waste a tick of useful work.
function findShoveDir(blocker, requester) {
    let best = null, bestScore = -Infinity;
    for (const dir of ALL_DIRS) {
        const next = offsetPos(blocker.pos, dir);
        if (!next) continue;
        if (next.isEqualTo(requester.pos)) continue;       // never push into the mover
        if (!passable(next, blocker.id)) continue;
        let score = 1;
        const onRoad = next.lookFor(LOOK_STRUCTURES)
            .some(s => s.structureType === STRUCTURE_ROAD);
        if (!onRoad) score += 2;
        if (blocker.memory && blocker.memory.target) {
            const t = Game.getObjectById(blocker.memory.target);
            if (t && t.pos && next.getRangeTo(t) <= 1) score += 2;
        }
        if (score > bestScore) { best = dir; bestScore = score; }
    }
    return best;
}

function wrapMove(orig) {
    const wrapped = function(direction) {
        // Pulling passes a Creep, not a direction – let it through unwrapped.
        if (typeof direction !== 'number') {
            return orig.call(this, direction);
        }
        // Reject anything outside 1..8 (NaN, 0, fractional, etc.) so we never
        // capture an intent the resolver or engine can't act on.
        if (!Number.isInteger(direction) || direction < 1 || direction > 8) {
            return orig.call(this, direction);
        }
        if (this.fatigue > 0) return ERR_TIRED;
        Game._trafficIntents = Game._trafficIntents || {};
        Game._trafficIntents[this.id] = { creep: this, dir: direction };
        return OK;
    };
    wrapped._trafficWrapped = true;
    return wrapped;
}

function install() {
    if (!Creep.prototype.move._trafficWrapped) {
        originalMove = Creep.prototype.move;
        Creep.prototype.move = wrapMove(originalMove);
    }
    if (typeof PowerCreep !== 'undefined' && !PowerCreep.prototype.move._trafficWrapped) {
        originalPcMove = PowerCreep.prototype.move;
        PowerCreep.prototype.move = wrapMove(originalPcMove);
    }
}

function resolve() {
    const intents = Game._trafficIntents || {};

    // Pass 1: for every intent, if the destination is held by an idle friendly
    // creep, give that creep a shove. Creeps that already have an intent will
    // vacate naturally this tick (Screeps resolves the move chain atomically).
    const initialIds = Object.keys(intents);
    for (const id of initialIds) {
        const { creep, dir } = intents[id];
        const target = offsetPos(creep.pos, dir);
        if (!target) continue;
        const blocker = creepsAt(target).find(c => c.id !== creep.id);
        if (!blocker || !blocker.my) continue;
        if (intents[blocker.id]) continue;                 // already moving
        if (blocker.memory && blocker.memory.noShove) continue;
        const shoveDir = findShoveDir(blocker, creep);
        if (shoveDir != null) {
            intents[blocker.id] = { creep: blocker, dir: shoveDir, shoved: true };
        }
    }

    // Pass 2: issue real moves.
    for (const id in intents) {
        const { creep, dir } = intents[id];
        const isPc = typeof PowerCreep !== 'undefined' && creep instanceof PowerCreep;
        (isPc ? originalPcMove : originalMove).call(creep, dir);
    }
}

module.exports = { install, resolve };
