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

const DIR_OFFSETS = {
    [TOP]:          [ 0,-1], [TOP_RIGHT]:    [ 1,-1],
    [RIGHT]:        [ 1, 0], [BOTTOM_RIGHT]: [ 1, 1],
    [BOTTOM]:       [ 0, 1], [BOTTOM_LEFT]:  [-1, 1],
    [LEFT]:         [-1, 0], [TOP_LEFT]:     [-1,-1],
};
const ALL_DIRS = [TOP,TOP_RIGHT,RIGHT,BOTTOM_RIGHT,BOTTOM,BOTTOM_LEFT,LEFT,TOP_LEFT];

let originalMove = null;

function offsetPos(pos, dir) {
    const [dx, dy] = DIR_OFFSETS[dir];
    const x = pos.x + dx, y = pos.y + dy;
    // Crossing a room border: no in-room conflict resolution possible.
    if (x < 0 || x > 49 || y < 0 || y > 49) return null;
    return new RoomPosition(x, y, pos.roomName);
}

function passable(pos, ignoreName) {
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
    for (const c of pos.lookFor(LOOK_CREEPS)) {
        if (c.name !== ignoreName) return false;
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
        if (!passable(next, blocker.name)) continue;
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

function install() {
    if (Creep.prototype.move._trafficWrapped) return;
    originalMove = Creep.prototype.move;
    const wrapped = function(direction) {
        // Pulling passes a Creep, not a direction – let it through unwrapped.
        if (typeof direction !== 'number') {
            return originalMove.call(this, direction);
        }
        if (this.fatigue > 0) return ERR_TIRED;
        Game._trafficIntents = Game._trafficIntents || {};
        Game._trafficIntents[this.name] = { creep: this, dir: direction };
        return OK;
    };
    wrapped._trafficWrapped = true;
    Creep.prototype.move = wrapped;
}

function resolve() {
    const intents = Game._trafficIntents || {};

    // Pass 1: for every intent, if the destination is held by an idle friendly
    // creep, give that creep a shove. Creeps that already have an intent will
    // vacate naturally this tick (Screeps resolves the move chain atomically).
    const initialNames = Object.keys(intents);
    for (const name of initialNames) {
        const { creep, dir } = intents[name];
        const target = offsetPos(creep.pos, dir);
        if (!target) continue;
        const blocker = target.lookFor(LOOK_CREEPS).find(c => c.name !== creep.name);
        if (!blocker || !blocker.my) continue;
        if (intents[blocker.name]) continue;               // already moving
        if (blocker.memory && blocker.memory.noShove) continue;
        const shoveDir = findShoveDir(blocker, creep);
        if (shoveDir != null) {
            intents[blocker.name] = { creep: blocker, dir: shoveDir, shoved: true };
        }
    }

    // Pass 2: issue real moves.
    for (const name in intents) {
        originalMove.call(intents[name].creep, intents[name].dir);
    }
}

module.exports = { install, resolve };
