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
| `rooms.js` | Room management (towers, links, spawning, mining) |
| `market.js` | In-game market order management |
| `util.js` | Utility functions (spawning, memory, movement, builds) |
| `screeps.prototype.js` | Prototype loader (aggregates all prototype modules) |
| `creep.prototype.js` | Creep prototype extensions |
| `room.prototype.js` | Room prototype extensions |
| `misc.prototype.js` | Misc prototype extensions (Source, Tower, Lab, Factory) |
| `Gruntfile.js` | Grunt deployment configuration |

---

## Module Details

### main.js

The game loop entry point. Each tick it:

1. Loads utility functions onto `Game.util`
2. Loads console API onto `Game.cmd`
3. Applies all prototype extensions via `screeps.prototype.load()`
3. Cleans up stale memory (dead creeps, abandoned rooms)
4. Runs room operations for each owned room
5. Runs creep operations for each owned creep

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

**Queries:**

| Function | Description |
|----------|-------------|
| `creeps(room, role)` | List all creeps of a role in a room (includes spawning/queued) |
| `counts(room)` | Get a Map of role counts for a room |

**Spawn Queue:**

| Function | Description |
|----------|-------------|
| `spawn(room, role, count, opts)` | Add creeps to a room's spawn queue |
| `clearQueue(room)` | Clear a room's spawn queue |

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
| `scout` | Moves to a target room then collects from sources |
| `harvester` | Harvests energy from sources/drops/tombs and delivers to base structures; falls back to upgrading the controller |
| `builder` | Builds construction sites; falls back to upgrading the controller |
| `maintenance` | Refills base energy, repairs non-wall/rampart structures, repairs walls/ramparts up to 100k hits; falls back to upgrading |
| `d-maintenance` | Defense maintenance - repairs ramparts and walls at progressively higher thresholds (25%, 50%, 75%, 100%) |
| `transporter` | Moves resources between structures (containers, links, terminals, factories, storages) |
| `miner` | Dedicated harvester assigned to a single source or mineral; deposits into nearby links or containers |
| `claimer` | Moves to a target room and claims/reserves/attacks the controller |
| `healer` | Follows a target creep and heals them |
| `defend` | Finds and attacks hostile creeps/structures in the current room |
| `attack` | Moves to a target room and attacks hostile creeps/structures |

**Room Navigation Helpers:**

- `inTargetRoom(creep)` - checks if creep is in its assigned target room
- `inHomeRoom(creep)` - checks if creep is in its home room
- `moveToRoom(creep, room)` - handles cross-room navigation with edge-avoidance logic
- `moveToHome(creep)` - navigates creep back to its home room
- `getTargetResource(creep)` - returns the creep's target resource type (defaults to energy)

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

- `moveToTarget(creep, options, target)` - Wrapper around `creep.moveTo()` with configurable path visualization (color, opacity, line style) and path reuse settings

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

Predefined body builds for each role at various levels (energy cost):

| Role | Levels | Energy Range |
|------|--------|-------------|
| scout | 1-2 | 250-400 |
| harvester | 1-7 | 300-2100 |
| builder | 1-7 | 300-2100 |
| maintenance | 1-4 | 300-1200 |
| d-maintenance | 1-4 | 300-1050 |
| transporter | 1-5 | 300-1500 |
| miner | 1-5 | 250-1050 |
| defender | 1-5 | 310-870 |
| healer | 1-5 | 300-970 |
| attack | 1-5 | 300-870 |
| ranged | 1-4 | 360-780 |
| claimer | 1-3 | 800-2000 |

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

## Dependencies

- **lodash** (`^4.17.21`) - Used in `misc.prototype.js` for type checking
- **grunt** (`^1.5.3`) - Task runner for deployment
- **grunt-screeps** (`^1.5.0`) - Grunt plugin for deploying code to Screeps servers

## Deployment

```bash
grunt screeps
```

Deploys all `.js` files in the project root to the configured Screeps account and branch.
