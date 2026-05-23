# Screeps World - Project Documentation

A bot for the online MMO [Screeps World](https://www.screeps.com/). Code is deployed to the game via `grunt screeps`.

## Project Structure

| File | Description |
|------|-------------|
| `main.js` | Entry point / game loop |
| `cmd.js` | Console API for managing creeps and spawning |
| `creeps.js` | Creep role dispatcher and role logic |
| `creeps.work.js` | Worker action functions (harvest, build, repair, etc.) |
| `creeps.combat.js` | Combat action functions (attack, heal, claim, etc.) |
| `rooms.js` | Room management (towers, links, spawning, mining, labs, factory, terminal) |
| `market.js` | In-game market order management |
| `util.js` | Utility functions (spawning, memory, movement facade, builds) |
| `traffic.js` | Tier 2 traffic manager — captures move intents and shoves idle blockers |
| `intel.js` | Tier 3 room intelligence — passive observation and `routeCallback` for Traveler |
| `Traveler.js` | Vendored `bonzaiferroni/Traveler` (locally patched, see Movement Architecture) |
| `screeps.prototype.js` | Prototype loader (aggregates all prototype modules) |
| `creep.prototype.js` | Creep prototype extensions |
| `room.prototype.js` | Room prototype extensions |
| `misc.prototype.js` | Misc prototype extensions (Source, Tower, Lab, Factory) |
| `Gruntfile.js` | Grunt deployment configuration |
| `Documentation.md` | This file — module reference and architecture |
| `CLAUDE.md` | Per-developer context for the Claude Code assistant (gitignored) |

---

## Module Details

### main.js

The game loop entry point. Each tick it:

1. Loads utility functions onto `Game.util` and console API onto `Game.cmd`
2. Applies all prototype extensions via `screeps.prototype.load()`
3. Calls `traffic.install()` to (re)wrap `Creep.prototype.move` for intent capture
4. Cleans up stale memory (dead creeps, abandoned rooms); every 1000 ticks also runs `intel.cleanup()`
5. Calls `intel.update()` to refresh `Memory.intel.rooms` for visible rooms (powers the route filter)
6. Runs room operations for each owned room
7. Runs creep operations for each owned creep
8. Calls `traffic.resolve()` to issue queued moves with idle-blocker shoves

The ordering matters: `traffic.install` must run after `proto.load` each tick (the prototype loader can reset the wrapper), `intel.update` must run before role logic so `intel.routeCallback` has fresh data, and `traffic.resolve` must run last so it sees every intent captured during the role passes.

### cmd.js

Console API exposed as `Game.cmd`. Provides shorthand functions for managing creeps and spawning from the in-game console.

**Single Creep Setters:**

| Function | Description |
|----------|-------------|
| `set(name, prop, value)` | Set any memory property on a creep by name |
| `setRole(name, role)` | Change a creep's role |
| `setTarget(name, id)` | Set a creep's target by object ID |
| `setTargetRoom(name, room)` | Set a creep's target room |
| `setResource(name, resource)` | Set a creep's target resource type |
| `setRespawn(name, val)` | Enable/disable auto-respawn for a creep |
| `setLevel(name, level)` | Set a creep's body level |

**Bulk Operations:**

| Function | Description |
|----------|-------------|
| `setRoleProp(room, role, prop, value)` | Set a memory property on all creeps of a role in a room |
| `getRoleProp(room, role, prop)` | Log the value of a memory property for all creeps of a role in a room |

**Queries:**

| Function | Description |
|----------|-------------|
| `creeps(room, role)` | List all creeps of a role in a room (includes spawning/queued) |
| `counts(room)` | Get a Map of role counts for a room |

**Spawn Queue:**

| Function | Description |
|----------|-------------|
| `spawn(room, role, count, opts, expedite)` | Add creeps to a room's spawn queue; `expedite=true` jumps the queue |
| `clearQueue(room)` | Clear a room's spawn queue |
| `unstuckQueue(room)` | Force progress on a wedged spawn queue |

**Miscellaneous:**

| Function | Description |
|----------|-------------|
| `sellResources(room, resource, amount)` | Sell from terminal; defaults to the room's native mineral if `resource` is null |
| `runTest(creep)` | Diagnostic dump for a creep (currently focused on mineralTransporter logic) |

**Console Examples:**

```js
// Change a single creep
Game.cmd.setRole('Jebson', 'builder')
Game.cmd.setTarget('Jebson', '5f...')
Game.cmd.setTargetRoom('Jebson', 'W2N1')
Game.cmd.setResource('Jebson', RESOURCE_HYDROGEN)
Game.cmd.setRespawn('Jebson', false)
Game.cmd.setLevel('Jebson', 3)

// Bulk update all miners in a room
Game.cmd.setRoleProp('W1N1', 'miner', 'level', 4)

// Query creeps
Game.cmd.creeps('W1N1', 'builder')
Game.cmd.counts('W1N1')

// Spawn queue management
Game.cmd.spawn('W1N1', 'builder', 2, {level: 3})
Game.cmd.clearQueue('W1N1')
```

### creeps.js

The creep role dispatcher. Routes each creep to its role handler based on `creep.memory.role`.

**Supported Roles:**

| Role | Description |
|------|-------------|
| `scout` | Moves to a target room then patrols sources and controller |
| `harvester` | Harvests energy from sources/drops/tombs and delivers to base structures |
| `worker` | Refills base energy, repairs structures and ramparts, builds construction sites; falls back to upgrading the controller. Eligibility flags in `memory.eligibility` (`base`, `repair`, `ramparts`, `build`) gate which subtasks the creep will pick up |
| `transporter` | Moves resources between structures (containers, links, terminals, factories, storages, labs) |
| `transporter2` | Variant transporter that prioritizes resources currently in its store |
| `mineralTransporter` | Specialized hauler for lab/factory feeds and terminal top-ups (drain/fill/share priorities; see `runMineralTransporter` in `creeps.js`) |
| `miner` | Dedicated harvester assigned to a single source; deposits into nearby links or containers. Sets `memory.noShove` while parked on its work tile |
| `mineralMiner` | Same dispatcher as `miner` but with mineral-tuned body via `getRoleBuild` |
| `claimer` | Moves to a target room and claims/reserves/attacks the controller |
| `healer` | Follows a target creep and heals them |
| `defender` | Finds and attacks hostile creeps/structures in the current room |
| `attack` | Moves to a target room and attacks hostile creeps/structures |
| `ranged` | Ranged-attack variant |

**Room Navigation Helpers:**

- `inTargetRoom(creep)` — true if creep is in its assigned target room
- `inHomeRoom(creep)` — true if creep is in its home (spawn) room
- `moveToRoom(creep, room)` — thin shim that calls `util.moveToTarget` with `(25, 25, room)` and `range: 22`. Traveler handles exit selection, border crossing, and hostile-room avoidance via `intel.routeCallback`
- `moveToHome(creep)` — `moveToRoom(creep, creep.memory.room)`
- `getTargetResource(creep)` — returns `creep.memory.targetResource` or `RESOURCE_ENERGY`

### creeps.work.js

Low-level worker action functions used by creep roles.

**Work Actions:**

| Function | Description |
|----------|-------------|
| `workerHarvest(creep, target)` | Harvest a source/mineral; moves to target if not in range |
| `workerRepair(creep, target)` | Repair a structure; moves to target if not in range |
| `workerBuild(creep, target)` | Build a construction site; moves to target if not in range |
| `workerWidthdraw(creep, target, resource)` | Withdraw resource from a structure; moves to target if not in range |
| `workerTransfer(creep, target, resource)` | Transfer resource to a structure; moves to target if not in range |
| `workerPickup(creep, target)` | Pick up a dropped resource; moves to target if not in range |
| `workerUpgrade(creep)` | Upgrade the room controller (only if controller level < 8) |
| `getBuildTarget(creep)` | Find the closest construction site for the creep |

**Resource Collection:**

| Function | Description |
|----------|-------------|
| `getCollectTarget(creep, options, resource)` | Find the best collection target based on options (storages, drops, tombs, containers, links, labs, deposits, sources). Respects "taken" targets to avoid duplication. |
| `collectTargetResource(creep, target, resource)` | Dispatches to the correct action (withdraw, pickup, harvest) based on target type |
| `collectResource(creep, options, resource)` | High-level collect: uses cached target or finds a new one |

**Resource Deposit:**

| Function | Description |
|----------|-------------|
| `getDepositTarget(creep, options, resource)` | Find a deposit target. Energy prioritizes: spawns/extensions > towers > labs > links/terminals/factories/storages/containers. Non-energy goes to terminal/factory/storage/containers/labs. |
| `depositResources(creep, options, resource)` | High-level deposit: uses cached target or finds a new one |
| `refillBaseEnergy(creep, options)` | Wrapper around `depositResources` for refilling base energy |

**Structure Maintenance:**

| Function | Description |
|----------|-------------|
| `maintainBaseStructures(creep)` | Finds and repairs damaged non-wall/rampart structures, avoiding targets already assigned to other maintenance creeps |
| `maintainBaseDefenses(creep)` | Repairs ramparts first, then walls at increasing hit thresholds (25% > 50% > 75% > 100%) |

### creeps.combat.js

Combat action functions.

| Function | Description |
|----------|-------------|
| `combatAttack(creep, target)` | Melee attack a target; moves to if not in range |
| `combatHeal(creep, target)` | Heal a target creep (skips if at full health); moves to if not in range |
| `combatRanged(creep, target)` | Ranged attack a target; moves to if not in range |
| `combatClaim(creep)` | Attempts to claim a room controller. Falls back to reserving if GCL is too low, or attacking the controller if it's owned by another player. |
| `combatReserve(creep)` | Reserve a room controller; falls back to attacking if owned |
| `combatAttackController(creep)` | Attack a hostile controller to reduce its level |
| `getAttackTarget(creep)` | Target priority: hostile creeps with ATTACK parts > any hostile creep > hostile structures (excluding walls/controllers) |

### rooms.js

Room management module. Handles per-room operations each tick.

**Core Loop (`run`):**

1. Initializes room memory with defaults
2. Runs mineral mining crew check every 100 ticks
3. Processes the spawn queue
4. Runs tower logic
5. Runs link logic

**Room Memory (`initMem`):**

| Property | Default | Description |
|----------|---------|-------------|
| `terminalResources` | `[RESOURCE_ENERGY]` | Resources managed by the terminal |
| `reusePath` | `4` | Path reuse setting for movement |
| `showPath` | `false` | Whether to visualize creep paths |
| `targetLink` | `null` | ID of the receiving link for energy transfers |
| `spawning` | `[]` | Currently spawning creeps |
| `spawnQueue` | `[]` | Queued creeps waiting to spawn |

**Structures:**

- `runTowers(room)` - Towers auto-target: hostile creeps > damaged friendly creeps > damaged structures (< 75% health)
- `runLinks(room)` - Full links transfer energy to the designated `targetLink`
- `runFactory(room)` - Placeholder (not yet implemented)

**Mining:**

- `runMiningCrew(room)` - Every 100 ticks at RCL 6+, checks for extractable minerals and auto-spawns a miner and transporter if needed
- `queMiningCrew(room)` - Manually queue a mineral mining crew
- `queEnergyCrew(room, level)` - Queue miners and transporters for each energy source
- `queEnergyMiners(room, level, count)` - Queue energy miners
- `queEnergyTransporters(room, level, count)` - Queue energy transporters

**Spawning:**

- `processSpawnQueue(room)` - Dequeues creeps from `spawnQueue` and spawns them on available spawns
- `queCreep(room, role, count, options)` - Add a creep to the spawn queue with role, level, and memory options
- `initRole(room, memory)` - Role-specific memory initialization (currently only `miner` has special init to assign a container)
- `getAvailableSpawns(room)` - Returns spawns that are not currently spawning
- `updateSpawning(room)` - Removes completed spawns from the `spawning` list

**Colony Management:**

- `queColony(room, targetRoom, level)` - Queues a claimer, 2 builders, and an attacker for colonizing a new room
- `queBuilders(room, level, count)` / `queHarvesters(room, level, count)` - Convenience functions

**Utilities:**

- `sellResources(room, amount)` - Sells minerals from the room's terminal on the market
- `getSources(room)` / `getMineral(room)` / `getExtractor(room)` / `getMineralContainer(room)` - Room structure lookups
- `buildSquareBaseRoads(room, spawn)` - Builds an 8-space square road pattern around a spawn
- `availableExtensions(room)` - Calculates how many more extensions can be built at the current RCL
- `clearQue(room)` / `getQueueCount(room)` / `getSpawningCount(room)` / `getRespawnCount(room)` - Queue management utilities

### market.js

In-game market order management.

| Function | Description |
|----------|-------------|
| `getOrders(type, resource, amount)` | Get all market orders of a type for a resource, sorted by price |
| `getTopOrders(type, resource, limit)` | Get and log the top N orders |
| `getOrdersForAmount(type, resource, amount)` | Get enough orders to fill a desired amount |
| `getBuyOrdersFor(resource, amount)` | Shortcut for buy orders |
| `getSellOrdersFor(resource, amount)` | Shortcut for sell orders |
| `createSellOrder(resource, price, amount, room)` | Create a sell order from a room's terminal |
| `logOrderDetails(order)` | Log order info to console |

### util.js

Shared utility functions used across all modules.

**Memory Management:**

- `cleanupMemory()` - Removes stale memory for dead creeps and abandoned rooms. Dead creeps with `respawn: true` are automatically re-queued to the spawn queue.

**Movement:**

- `moveToTarget(creep, options, target)` — the only entry point role code should use for movement. Delegates to `Traveler.travelTo` with `intel.routeCallback` injected and per-role `repath` defaults from `util.REPATH_BY_ROLE`. See the [Movement Architecture](#movement-architecture) section for the full pipeline.

**Creep Queries:**

| Function | Description |
|----------|-------------|
| `getAllCreepsByRole(role)` | Get all creeps globally with a given role |
| `getCreepsByRole(room, role)` | Get all creeps in a room with a given role (includes spawning and queued) |
| `getCreepProp(creeps, property)` | Extract a memory property from a list of creeps |
| `setCreepProp(creeps, property, value)` | Set a memory property on a list of creeps |
| `getCreepPropsByRole(room, role, property)` | Get a memory property for all creeps of a role in a room |
| `setCreepPropsByRole(room, role, property, value)` | Set a memory property for all creeps of a role in a room |

**Spawning:**

- `spawnCreep(spawn, name, memory)` - Spawns a creep with the body build for its role and level
- `nameGenerator()` - Generates unique random names from prefix/suffix combinations (with a 5% chance of using a preset name list)
- `getRoleBuild(role, level)` - Returns the body part array for a role at a given level from the build library
- `calcCreepBuildEnergy(build)` - Calculates the energy cost of a body part array
- `computeBuild(role, level)` - Experimental dynamic build computation using part ratios

**Build Library (`getRoleBuild`):**

Predefined body builds for each role at various levels. See `util.js` for exact part counts; energy cost grows with level.

| Role | Levels |
|------|--------|
| scout | 1–2 |
| harvester | 1–8 |
| worker | 1–8 |
| transporter | 1–8 |
| mineralTransporter | 1–8 |
| miner | 1–8 (WORK capped at 6 — a single source is 10 E/tick) |
| mineralMiner | 1–8 (WORK scales further — extractor throughput, not capped) |
| claimer | 1–5 |
| attack | 1–8 |
| defender | 1–8 |
| healer | 1–8 |
| ranged | 1–8 |

Body part order convention: combat roles list TOUGH → functional → MOVE so damage parts survive longer than mobility (retreat-capable).

**Spatial Utilities:**

- `openSpacesNearPos(pos, range, array)` - Counts or lists open spaces near a position (non-wall terrain)
- `creepsNearPos(pos)` - Counts friendly creeps near a position
- `getCountMap(array)` - Returns a Map of element counts

### screeps.prototype.js

Aggregator module that loads all prototype extensions. Called once per tick from `main.js`.

Loads:
- `misc.prototype.js`
- `room.prototype.js`
- `creep.prototype.js`

### misc.prototype.js

Adds `memory` properties (backed by `Memory.*`) to game objects that don't natively have them:

- **`Source.prototype.memory`** - Persistent memory for sources (stored in `Memory.sources`)
- **`Source.prototype.openSpaces`** - Cached count of non-wall tiles adjacent to a source
- **`StructureTower.prototype.memory`** - Persistent memory for towers (stored in `Memory.towers`)
- **`StructureLab.prototype.memory`** - Persistent memory for labs (stored in `Memory.labs`)
- **`StructureFactory.prototype.memory`** - Persistent memory for factories (stored in `Memory.factories`)

### room.prototype.js

Adds cached properties to `Room.prototype`:

- **`Room.prototype.sources`** - Cached array of room sources (IDs stored in `room.memory.sourceIds`)
- **`Room.prototype.mineral`** - Cached mineral object for the room
- **`Room.prototype.deposit`** - Placeholder (getter not implemented)

### creep.prototype.js

Adds properties to `Creep.prototype`:

- **`Creep.prototype.isFull`** - Whether the creep's store is full
- **`Creep.prototype.work`** - Lazy-loaded reference to the `creeps.work` module

---

## Movement Architecture

All creep movement goes through `util.moveToTarget(creep, options, target)`. Role code must not call `creep.moveTo`, `creep.move`, or `Traveler.travelTo` directly — the wrapper is what applies route filtering, traffic resolution, and per-role repath defaults.

The pipeline is three layers, each in its own file:

### `Traveler.js` — pathfinding

Vendored from [bonzaiferroni/Traveler](https://github.com/bonzaiferroni/Traveler). Computes multi-room `PathFinder` paths gated by `Game.map.findRoute`, serializes them onto `creep.memory._trav`, and owns stuck detection.

**Local patches** (re-apply if the vendored copy is refreshed from upstream):

1. A `visualize` option gates the three visualization sites in `travelTo` (fatigue circle, stuck circle, path draw) and the start-circle/line draws in `serializePath`. Without it, `room.memory.showPath` is ignored.
2. After `travelData.path = travelData.path.substr(1)` in `travelTo`, return `OK` when the path is now empty. Upstream falls through to `parseInt("")` → `NaN` → `creep.move(NaN)` → `ERR_INVALID_ARGS` on the final tick of every journey, which spams "moveToTarget: Invalid Arguments".

### `intel.js` — room observation and route filtering

Each tick, `intel.update()` does a passive pass over every room in `Game.rooms` and writes:

```js
Memory.intel.rooms[name] = {
    owner,         // controller owner username, or null
    reservedBy,    // controller reservation username, or null
    hostile,       // hostile creeps/structures or non-self owner
    hostileSeen,   // tick we last observed hostility
    sourceKeeper,  // SK lair present (set once, never flips)
    avoid,         // user-set permanent override
    lastScouted,   // last tick we had vision
}
```

Configuration lives at the top of `Memory.intel`:

- `Memory.intel.hostileTTL` (default `5000`) — ticks after which `hostile` ages out
- `Memory.intel.intelMaxAge` (default `20000`) — ticks after which an unvisited room is dropped from intel
- `Memory.intel.username` — auto-populated from any owned spawn on first run

`intel.routeCallback(roomName)` is passed to `Traveler.travelTo` and returns:

- `Infinity` — if `avoid` is set, or `hostile` was observed within `hostileTTL`
- `2.5` — for Source Keeper rooms (observed via `sourceKeeper:true` or inferred from room-name regex)
- `undefined` — otherwise, so Traveler's built-in heuristics apply

`intel.cleanup()` runs every 1000 ticks from `main.js` to evict stale rooms.

### `traffic.js` — intent capture and shove resolution

`traffic.install()` wraps `Creep.prototype.move`. Instead of executing immediately, the wrapper captures `(creep, dir)` into `Game._trafficIntents` (per-tick, on `Game` not `Memory`). Pulling (`move(otherCreep)`) and fatigued creeps short-circuit unwrapped. Directions outside 1..8 are passed through to the original move without being captured.

After all roles have run, `traffic.resolve()` runs:

1. **Idle blocker shove**: for each captured intent, if the destination tile holds a friendly creep with no intent of its own and no `noShove` flag, queue a one-tile shove for that blocker. Shove direction prefers non-road tiles and tiles still in range of the blocker's `memory.target` so the shove doesn't waste useful work.
2. **Issue moves**: for every intent (original + shoves), call the saved `originalMove`. Native Screeps resolves swaps and conga lines atomically when both creeps have intents this tick, so we don't need explicit swap logic.

### Stationary roles must opt out

A creep that intentionally stands still — miner on container, upgrader on link, etc. — should set `creep.memory.noShove = true` once it reaches its work tile and `delete` it while traveling. Currently wired in `runMiner` (covers both `miner` and `mineralMiner` since both dispatch through it). Add the same pattern to any future stationary role.

### Options recognized by `util.moveToTarget`

| Option | Default | Notes |
|--------|---------|-------|
| `showPath` | `creep.room.memory.showPath` | Toggles all Traveler visuals via the `visualize` patch |
| `pathColor` | `"#ffffff"` | Currently unused — Traveler hardcodes orange/red. Kept for API stability |
| `range` | Traveler default (1) | Pass `22` for "anywhere in the room" (`moveToRoom`) |
| `ignoreCreeps` | `true` | Stops cached paths from detouring around blockers that have walked away |
| `repath` | from `util.REPATH_BY_ROLE` (combat=1, others=0) | Chance per tick of recomputing the path |
| `allowHostile`, `stuckValue`, `maxOps` | forwarded to Traveler |

### Main loop ordering (must remain in this order)

```
proto.load()
traffic.install()      // must run after proto.load every tick
util.cleanupMemory()
intel.cleanup()        // throttled to every 1000 ticks
intel.update()         // before role logic so routeCallback has fresh data
rooms.run(...)
creeps.run(...)
traffic.resolve()      // must be last
```

---

## Dependencies

- **lodash** (`^4.17.21`) - Used in `misc.prototype.js` for type checking
- **grunt** (`^1.5.3`) - Task runner for deployment
- **grunt-screeps** (`^1.5.0`) - Grunt plugin for deploying code to Screeps servers

## Deployment

```bash
grunt screeps
```

Deploys all `.js` files in the project root to the configured Screeps account and branch.
