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
| `power.js` | Power mining — observer scanning, power bank operations (attacker/healer pairs, haulers), crew cleanup |
| `production.js` | Production planner — stockpile goals → lab reaction jobs, booster labs, upgrader boosting |
| `logistics.js` | Empire resource sharing — per-room needs/surplus ledger, terminal broker, overflow selling |
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
7. Calls `power.run()` — observer scan every tick; power operations every 10 ticks
8. Calls `production.run()` — every 50 ticks, assigns lab reaction jobs and booster compounds (before logistics so new lab assignments become needs the same tick)
9. Calls `logistics.run()` — every 10 ticks, matches room needs to surplus and sends via terminals (after room ops so queued deals are already executing)
10. Runs creep operations for each owned creep
11. Calls `traffic.resolve()` to issue queued moves with idle-blocker shoves

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
| `mem(name)` | Pretty-print and return a single creep's memory by name |

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
| `sendEnergy(from, to, amount)` | Send energy between two owned rooms' terminals. Validates terminals/cooldown/destination space and checks `amount` + transfer cost against the source terminal; `amount = null` sends the max affordable. Logs the outcome and returns the result code |
| `runTest(creep)` | Diagnostic dump for a creep (currently focused on mineralTransporter logic) |
| `logistics()` | Print the logistics report: each room's energy band state, needs, surplus, empire totals vs sell caps, recent sends/sells |
| `production()` | Print the production report: goals vs stock, amounts still to make, base mineral stock, per-room lab mode/job/booster, upgraders boosted, missing mineralTransporters |
| `power()` | Print the power report: RCL 8 homes (observer flag), known banks, active operation crew counts, recent results |
| `abortPower(bankId)` | End a power operation now (queued crew removed, fighters retire, haulers finish delivering) |
| `goal(resource, amount)` | Set an empire stockpile goal (`Memory.production.config.goals`); `amount` 0/null removes it |
| `labMode(room, mode)` | Lab usage for a room: `auto` (default), `off` (planner leaves the labs alone), `react`, `boost`, `both` |
| `spawnUpgraders(room, count, level)` | Queue dedicated upgraders (`worker` with `upgrader: true`, every other duty off, respawning) — these are the creeps that get upgrade boosts |
| `upgrader(name, on)` | Turn a live worker into a dedicated upgrader (or back with `on = false`) |
| `want(room, resource, amount)` | Set a manual standing demand (`Memory.logistics.rooms[room].wants`); `amount` 0/null removes it |

**Intel (`Memory.intel.rooms`):**

| Function | Description |
|----------|-------------|
| `avoidRoom(name)` | Set `avoid: true` — permanent block (never auto-cleared by `intel.update`) |
| `unavoidRoom(name)` | Clear the `avoid` flag |
| `markHostile(name)` | Set `hostile: true, hostileSeen: Game.time`. Will age out after `Memory.intel.hostileTTL` ticks. Only meaningful for rooms you don't have vision in — otherwise `intel.update` recomputes it next tick |
| `ignoreHostile(name)` | Set `ignoreHostile: true` — `intel.update` still records hostility (you keep visibility) but `routeCallback` treats the room as safe. Use when you must route through a hostile room |
| `unignoreHostile(name)` | Clear the `ignoreHostile` flag |
| `setRoomOwner(name, owner)` | Set the `owner` field manually (overwritten by `intel.update` if you have vision) |
| `clearRoom(name)` | Delete the entry entirely |
| `intel(name)` | Log and return the current entry |
| `listFlagged()` | List every room with `avoid` or `hostile` set |

Example:

```js
Game.cmd.avoidRoom('E18S60')                   // permanent block of a corridor
Game.cmd.markHostile('E17S60')                 // temporary block (TTL applies)
Game.cmd.setRoomOwner('E17S60', 'RivalName')   // record a controller owner you saw
Game.cmd.listFlagged()                         // audit everything you've flagged
```

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
| `harvester` | `memory.mode = 'power'` makes it a power hauler: collects `RESOURCE_POWER` from the shared drop pile (`shareDrops`) and ruins, waits near the bank via `power.haulerIdle`, and heads home with a partial load once the pile is gone. Otherwise: harvests energy from sources/drops/tombs and delivers to base structures. Energy harvesters working a remote `targetRoom` spend the top 25% of their load on local construction/repair before heading home, keeping a 75% reserve so they always carry energy back (the reserve prevents a maintain→empty→harvest cycle that would trap them in the remote room). A `memory.eligibility.repair` flag (default `true`, opt-out) gates both the home-room and remote-room repair passes so a harvester can skip repairs and avoid diverting energy from the room's flow — queue with `eligibility:{repair:false}` in the spawn memory, or flip a live creep's `memory.eligibility.repair`. Harvesters missing the flag entirely (spawned before it existed) are treated as eligible; only an explicit `false` opts out. Home-room deposit: if a base refiller is in the room (a `worker` with `eligibility.base`, or a `transporter`/`transporter2` hauling energy), the harvester uses pooled mode (`getDepositTarget` with `pool:true`) and unloads at the closest of spawns/extensions/towers/links/storage/terminal(<50k)/factory(<10k); otherwise it uses the tiered order (spawns/extensions > towers > labs > terminal/factory > links/storage) |
| `worker` | Refills base energy, repairs structures and ramparts, builds construction sites; falls back to upgrading the controller. Eligibility flags in `memory.eligibility` (`base`, `repair`, `ramparts`, `build`) gate which subtasks the creep will pick up. `memory.upgrader: true` (set at spawn) turns every duty off. Pure upgraders (that flag, or all four eligibility flags off) first visit the room's booster lab while they have ≥1200 ticks to live (`production.seekBoost`) |
| `transporter` | Moves resources between structures (containers, links, terminals, factories, storages, labs). Energy collection order: the room's `targetLink` first whenever it holds ≥ 400 (or a full load), so link income never backs up; storage only when `getDepositTarget` (the same check delivery uses — claimed extensions/towers excluded, factory ignored) finds a destination other than storage, which prevents storage → storage loops. Energy transporters also drain terminal energy above 55k (surplus from inter-room sends; above the 50k top-up level so the two never fight); a load taken from the terminal is never delivered back to it (`memory.collectedFrom`) |
| `transporter2` | Variant transporter that prioritizes resources currently in its store |
| `mineralTransporter` | Specialized hauler for lab/factory/power spawn feeds and storage↔terminal balancing. Collect priorities: drain wrong lab contents > fill input/booster labs > drain output labs > feed factory > drain factory > feed power spawn (power below 50, or energy below 2500 when there's power and storage is above `powerEnergyFloor`; withdraws just what fits and delivers immediately) > drain miner containers > balance terminal toward `logistics.terminalTarget` (`getTerminalBalanceJob`: move storage→terminal when >1000 under target, terminal→storage when >5000 over) > loose minerals. See `runMineralTransporter` in `creeps.js` |
| `miner` | Dedicated harvester assigned to a single source; deposits into nearby links or containers. Sets `memory.noShove` while parked on its work tile |
| `mineralMiner` | Same dispatcher as `miner` but with mineral-tuned body via `getRoleBuild` |
| `claimer` | Moves to a target room and claims/reserves/attacks the controller |
| `healer` | Follows a target creep (`memory.target` = creep name) at range 1 and heals it when damaged, itself otherwise (`combatHeal` now always follows — it used to stay put while the target was at full HP) |
| `defender` | Finds and attacks hostile creeps/structures in the current room |
| `attack` | Moves to a target room and attacks hostile creeps/structures. `memory.mode = 'powerBank'` hands it to `power.runAttacker`: attack only the op's bank, only with its healer adjacent and above half HP, and hold below `holdHits` until a hauler is in the room |
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
| `workerTransfer(creep, target, resource)` | Transfer resource to a structure; moves to target if not in range. Clears `memory.targetDeposit` on a successful transfer (or when the target is full/invalid) so the next deposit re-picks |
| `workerPickup(creep, target)` | Pick up a dropped resource; moves to target if not in range |
| `workerUpgrade(creep)` | Upgrade the room controller. At RCL 8, general workers only upgrade when `ticksToDowngrade` < 75k; dedicated upgraders (`production.isUpgrader`) always upgrade (15 energy/tick room cap, 30 GCL/tick when XGH2O-boosted) |
| `getBuildTarget(creep)` | Find the closest construction site for the creep |

**Resource Collection:**

| Function | Description |
|----------|-------------|
| `getCollectTarget(creep, options, resource)` | Find the best collection target based on options (storages, drops, tombs, containers, links, labs, terminals, deposits, sources). Terminal energy is collected above `options.terminalEnergyFloor` (default 11000). Respects "taken" targets to avoid duplication. |
| `collectTargetResource(creep, target, resource)` | Dispatches to the correct action (withdraw, pickup, harvest) based on target type |
| `collectResource(creep, options, resource)` | High-level collect: uses cached target or finds a new one |

**Resource Deposit:**

| Function | Description |
|----------|-------------|
| `getDepositTarget(creep, options, resource)` | Find a deposit target. Energy prioritizes: spawns/extensions > towers > labs > links/terminals/factories/storages/containers. Towers qualify below 75% energy and unclaimed by another creep; the emptiest is chosen, range breaks ties. With `options.pool`, the tiers are dropped and spawns/extensions/towers plus the enabled sinks are pooled into one closest-by-path pick. Returns the structure; `depositResources` records it in `memory.targetDeposit` and does the transfer. Non-energy goes to terminal/factory/storage/containers/labs. |
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

**Room Memory (`initMem`):** fills in missing defaults in place each tick; other keys are preserved (including the Room prototype caches `sourceIds`, `mineral`, `factoryId` — a cached `null` factory is rechecked every 100 ticks). A one-time migration (`_memV: 2`) removes keys from the old terminal push model.

| Property | Default | Description |
|----------|---------|-------------|
| `terminalResources` | `[RESOURCE_ENERGY]` | Resources managed by the terminal |
| `reusePath` | `1` | Path reuse setting for movement |
| `showPath` | `false` | Whether to visualize creep paths |
| `targetLink` | `null` | ID of the receiving link for energy transfers |
| `spawning` | `[]` | Currently spawning creeps |
| `spawnQueue` | `[]` | Queued creeps waiting to spawn |
| `defenseMin` | `20000` | Towers repair walls/ramparts below this |
| `reservations` | `[]` | Controller ids this room keeps reserved |
| `allowMining` | `true` | Enables the automatic mineral mining crew |

**Structures:**

- `runTowers(room)` - Towers auto-target: hostile creeps > damaged friendly creeps > damaged structures (< 75% health)
- `runLinks(room)` - Sender links at >=90% of `LINK_CAPACITY` (off cooldown) transfer to the designated `targetLink`, capped to its free space; sends under 100 are skipped
- `runFactory(room)` - Produces `factory.memory.target` when components are present, up to `outputCap`
- `runPowerSpawn(room)` - RCL 8: `processPower()` (1 power + 50 energy/tick → GPL) only while effective energy is above `Memory.power.config.powerEnergyFloor` (150k, above the 100k RCL 8 logistics donor floor, so upgrade-sink sharing to RCL 7 rooms gets spare energy first)
- `runTerminal(room)` - Executes queued market deals (`terminal.memory.deals`), one per tick. All inter-room sending and selling decisions live in `logistics.js`

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
- `sellForeignResources(room, resource, amount, minPrice)` - Queues buy-order deals within the terminal's energy budget, skipping orders below `minPrice`; returns `true` if anything was queued
- `getSources(room)` / `getMineral(room)` / `getExtractor(room)` / `getMineralContainer(room)` - Room structure lookups
- `buildSquareBaseRoads(room, spawn)` - Builds an 8-space square road pattern around a spawn
- `availableExtensions(room)` - Calculates how many more extensions can be built at the current RCL
- `clearQue(room)` / `getQueueCount(room)` / `getSpawningCount(room)` / `getRespawnCount(room)` - Queue management utilities

### power.js

Power mining from highway rooms, built from existing roles (`attack` in `powerBank` mode, `healer`, `harvester` in `power` mode) with purpose-built bodies via `memory.body` (`util.getCreepBuild`). Power is brought home and processed in power spawns (GPL).

**Bank numbers:** 2M hits, decays after 5000 ticks, reflects 50% of melee damage. Attacker `{MOVE:20, ATTACK:20}` deals 600/tick and takes 300 back; healer `{MOVE:25, HEAL:25}` heals exactly 300. One pair needs ~3300 ticks, so operations run 2–3 pairs (capped by open tiles around the bank). Healers cost 7500 energy, so only RCL 8 rooms are homes. Hauler `{MOVE:25, CARRY:25}` carries 1250.

**Vision:** `intel.update` records `powerBank` (id, pos, power, hits, `decayAt`, open adjacent tiles, `seen`) on any visible highway room. RCL 8 rooms with an observer additionally observe highway rooms within `maxRange` in rotation, one per tick.

**Launch** (every 10 ticks, at most `maxOps` 1 at a time): banks seen within 1500 ticks with ≥ `minPower` (1000) and ≥ 2 open tiles, in a room not flagged hostile, within `maxRange` (5) linear rooms of an RCL 8 home that can afford a healer, where decay leaves time for spawn (150) + travel (50/room) + kill time + hauling margin (300). Best = power ÷ (distance + 1). The op sets `ignoreHostile: 'power'` on the room so other players' miners can't block routing for our replacements/haulers (removed when the op ends).

**Running:** pairs are queued attacker-then-healer (healer `target` = attacker name). A pair is replaced only if it would die before the bank, once a replacement queued now would arrive as it dies. Haulers (`ceil(power/1250)`, max 6) are queued when the bank's remaining hits would last about as long as their spawn + travel; attackers hold below 60k hits until a hauler is in the room. When the bank is gone the op switches to collecting, and ends once no power drops/ruins remain and no hauler in the room carries power (or on timeout 8000 ticks / decay / `cmd.abortPower`). Ending removes queued crew, records the bank in `Memory.power.done` (never relaunched), and fighters retire; haulers deliver and then retire.

**Config:** `Memory.power.config` overrides `DEFAULTS` (`maxRange`, `maxOps`, `minPower`, `maxPairs`, `holdHits`, `maxHaulers`, …) plus `powerEnergyFloor` for processing. Ops live in `Memory.power.ops`, last 20 results in `Memory.power.history`.

### production.js

Phase 2 of the resource plan: goal-driven lab production, focused on GCL. Upgrade boosts (GH +50%, GH2O +80%, XGH2O +100% `upgradeController` effectiveness) multiply GCL per energy without costing more energy per tick, so the default goal is **10k XGH2O** and pure upgraders are boosted with the best compound in stock. Acts every `runInterval` (50) ticks; all tunables in `DEFAULTS`, overridable via `Memory.production.config` (`goals` replaces rather than merges).

**Planning:**

1. **Empire stock** = storage + terminal + labs of every owned room.
2. **Requirements** — each goal is expanded down the reaction tree (`REACTIONS` reversed), using existing stock of the goal and every intermediate first, giving "still to make" per compound.
3. **Candidates** — compounds still to make whose two ingredients each have ≥ `minBatch` (500) in empire stock (a running job continues while any remains). Sorted highest tier first (XGH2O 5 > GH2O 4 > GH 3 > G 2 > OH/ZK/UL 1) so stock closest to the goal is converted first.
4. **Assignment** — one reactor room per compound first; spare reactors then double up on ready reactions (up to `roomsPerProduct` 2 rooms each) when the empire holds ≥ 2 × `minBatch` of both ingredients. Running jobs are kept while still valid; free reactors take the next candidate, preferring the room already holding the most of both ingredients. If no reactor is free, a higher-tier candidate preempts the lowest-tier job that has run ≥ `minJobTicks` (1500), one per pass.

**Lab layout and roles** (`Memory.production.rooms[name].layout`, recomputed when the room's lab set changes): the input pair with the most labs within range 2 of both; those labs are outputs. Mode `auto`: rooms with ≥ 6 labs are `both` (reactor + one booster lab — a lab outside the cluster if any, else one output); 3–5 labs `react` until an upgrade compound is in stock, then `boost`; 1–2 labs `boost`; no storage → `off`. The planner writes `lab.memory` each pass: `input1`/`input2` (`resource`, `amount` 2000), `output` (product, cap 3000), `booster` (upgrade compound, 1500), `idle` (no resource; contents drained). Rooms in `off` mode are never touched, so manual lab setups need `cmd.labMode(room, 'off')`.

**What runs the jobs:** existing code. `logistics.js` turns input/booster assignments into needs and ships ingredients; `rooms.runLabs` reacts; the mineralTransporter fills inputs/boosters, drains outputs at 1500 and drains labs whose contents don't match the assignment. A managed room with an active job or booster compound and no mineralTransporter gets one queued (level 4, respawning).

**Booster compound:** the first of XGH2O → GH2O → GH with ≥ 1000 empire stock; the current choice is kept while ≥ 300 remain, and upgraded when a better one is stocked (`Memory.production.boostCompound`). Boosting applies up to `boost.maxRcl` (8): at RCL 8 the 15/tick cap limits *energy spent*, not progress — the engine adds each boosted part's bonus after the cap — so 15 XGH2O-boosted WORK parts give 30 GCL/tick for 15 energy.

**Upgrader boosting (`seekBoost`, from `runWorker`):** a pure upgrader with unboosted WORK parts and ≥ `minTicksToLive` (1200) goes to the booster lab and is boosted, if the lab holds enough compound (30/part) and energy (20/part) for every unboosted WORK part — otherwise it carries on unboosted rather than waiting. In RCL 8 rooms only 15 WORK parts room-wide can count per tick, so a creep is boosted for at most 15 minus the boosted WORK already on the room's upgraders (itself included) (`boostCreep(creep, n)`). Opt a creep out with `memory.noBoost = true`.

**Throughput note:** each XGH2O consumes one each of Z, K, U, L, O, X and two H. H (E19S64) and X (E19S58) each come from a single room, so they're the likely bottlenecks — watch `Base stock` in `cmd.production()`.

### logistics.js

Empire-wide, demand-driven resource sharing. Replaces the old push model where each mining room sent its mineral to every other room up to 20k. Mining rooms now only advertise surplus; rooms that consume something post a need, and a central broker matches them. Called from `main.js` after room ops; acts every `runInterval` (10) ticks, matching the terminal cooldown. Only rooms at RCL 6+ with a terminal take part (new colonies like E17S68 are outside the network until RCL 6).

**Ledger (per room, recomputed each pass):**

- **Demand** comes from what the room consumes: input/booster labs (`lab.memory.amount`, default 2000, plus `labBuffer` 3000 held in reserve for reaction inputs or `boosterBuffer` 1000 for booster labs; `idle`/`output` labs create no demand), the factory's `memory.target` recipe components × `factoryBatches` (10), nuker ghodium free capacity (only with `nukerGhodium: true` — off by default since nothing loads the nuker), 1000 power if there's a power spawn, and manual `wants`. Amounts already in the labs/factory count toward it.
- **Need** = demand − (storage + terminal + in-place), posted when ≥ `minSend` (1000).
- **Surplus** = storage + terminal − remaining demand. A room with no use for a resource treats all of it as surplus — that's how a mining room exports its mineral.
- **Energy** uses bands on *effective energy* (storage + terminal energy above the 50k working level that transporters maintain as send fuel). Strong rooms (2 sources) need below 40k (fill to 60k) and donate above 120k. **Weak rooms** (fewer than 2 sources, auto-detected — currently E19S58 and E17S67) need below 80k (fill to 100k) and never donate. Below 20k a need becomes an emergency (top priority). RCL 8 rooms donate above 100k (`energy.rcl8`). **Upgrade sink:** RCL 8 rooms can only spend 15 energy/tick upgrading, so RCL < 8 rooms that are otherwise fine post a lowest-priority need up to 150k (`energy.upgradeSink`), filled **only by RCL 8 donors** — moving capped energy to rooms that can upgrade without a cap is worth the 3–6% per-hop transfer loss. Rooms that aren't RCL 8 don't ship energy just to fund upgrading. Per room: `Memory.logistics.rooms[name].upgradeSink = false` opts out.

**Broker:** needs are sorted by priority (`emergency` energy < `boost` < `reaction` < `factory` < `energy` < `structure` (nuker/power) < `manual` < `sink`). For each, the donor with surplus that's actually in its terminal, an off-cooldown terminal, and enough terminal energy for the cost plus a 10k reserve is chosen by shortest linear distance (cheapest transfer). One send per terminal per pass; sends up to 10k (minerals) / 20k (energy). Within a pass, scheduled sends are netted from both ledgers so two donors never fill the same need. Terminals with queued market deals are skipped.

**Overflow selling:** after sends, any resource in `sellCap` whose empire total exceeds the cap (base minerals: 100k each) is sold in batches of 5k from the terminal holding the most surplus, at most `maxSellsPerPass` (1) sale per pass, respecting an optional `minPrice[resource]`. Resources not in `sellCap` (compounds, energy) are never auto-sold.

**Terminal staging:** `terminalTarget(room, r)` = min(surplus, `terminalStock` 10k) for non-energy resources; the mineralTransporter balances storage↔terminal toward it, and generic transporters use it for the room mineral instead of the old 25k cap. Imports the room needs itself are left in the terminal (labs/factory pull from either) unless it's 5k+ over target.

**Configuration (all optional, `Memory` so it survives deploys):**

| Path | Effect |
|---|---|
| `Memory.logistics.config` | Deep-merged over `logistics.DEFAULTS` (e.g. `{sellCap:{H:150000}, energy:{strong:{donorFloor:150000}}, minPrice:{X:0.5}}`) |
| `Memory.logistics.rooms[name].weak` | Force a room's weak/strong classification |
| `Memory.logistics.rooms[name].energy` | Override that room's `low` / `target` / `donorFloor` |
| `Memory.logistics.rooms[name].upgradeSink` | Force the room in/out of the upgrade-sink energy need |
| `Memory.logistics.rooms[name].export` | `false` stops the room offering non-energy surplus |
| `Memory.logistics.rooms[name].wants` | `{resource: amount}` standing demand (use `cmd.want`) |
| `Memory.logistics.history` | Ring buffer of the last 30 sends/sells (shown by `cmd.logistics()`) |

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
3. In `findRoute`, the `couldn't findRoute to ${destination}` log line is commented out. Upstream fires it every tick a creep tries to (re)build a path that has no room-level route — usually because `intel.routeCallback` is returning `Infinity` for a critical transit room. The failure already falls through to unconstrained `PathFinder.search` downstream, so silence is harmless. Diagnose route blockages via `Game.cmd.listFlagged()` instead.
4. Heavy-CPU log silenced. The `TRAVELER: heavy cpu use:` `console.log` in `travelTo` is commented out because the metric isn't actionable for this codebase: `useFindRoute: true` + `intel.routeCallback` runs on every path build, and combat roles repath each tick, so sustained pathing CPU is structural cost — not a hotspot to optimize.

   The supporting machinery is left intact so the diagnostic can be re-enabled if needed:
   - `REPORT_CPU_THRESHOLD = 2000`
   - `CPU_REPORT_WINDOW_TICKS = 200` — `state.cpu` is reset to 0 in `deserializeState` when more than this many ticks have passed since `cpuWindowStart` (stored at `state[STATE_CPU_WINDOW_START]`), so when re-enabled it represents recent average CPU rate rather than lifetime accumulation.
   - Backward-compatible: legacy `_trav` arrays without index 7 fall back to "window starts now."

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
power.run()            // observer scan each tick; ops throttled to every 10 ticks
production.run()       // before logistics, throttled to every 50 ticks
logistics.run()        // after rooms.run (deal execution), throttled to every 10 ticks
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
