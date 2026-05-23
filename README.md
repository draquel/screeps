# Screeps

A bot for the persistent online MMO [Screeps World](https://www.screeps.com/) — colonies of programmable units mining, building, hauling, and fighting across a shared shard, twenty-four hours a day, whether you're logged in or not.

---

## Run it

```bash
grunt screeps          # deploy all *.js to the configured branch
```

Credentials and target branch live in `screeps.json` (gitignored). The Gruntfile picks up every `.js` in the project root automatically.

```bash
npm install            # one-time setup
```

---

## What's in here

A single-process bot — no build step, no transpile, just plain JavaScript modules required from `main.js`. Each tick the game engine calls `module.exports.loop`, which runs the room and creep dispatchers in order.

```
main.js              entry point / tick loop
├── rooms.js         per-room logic: towers, links, labs, factory, terminal, spawn queue
├── creeps.js        per-creep role dispatcher
│   ├── creeps.work.js     harvest / build / repair / collect / deposit helpers
│   └── creeps.combat.js   attack / heal / claim / reserve helpers
├── util.js          spawning, memory cleanup, body templates, movement facade
├── market.js        in-game market orders
├── cmd.js           Game.cmd console API
│
├── traffic.js       Tier 2: captures move intents and shoves idle blockers
├── intel.js         Tier 3: passive room observation + Traveler routeCallback
├── Traveler.js      Vendored multi-room pathfinder (with two local patches)
│
└── *.prototype.js   prototype extensions for Room, Creep, Source, Lab, Factory, ...
```

The juicy bit is the **movement pipeline**. All movement funnels through `util.moveToTarget`, which sits on top of three layers:

1. **`Traveler.js`** — multi-room `PathFinder` driven by `Game.map.findRoute`.
2. **`intel.js`** — every tick, observes each visible room and writes `Memory.intel.rooms[name]` (owner, hostility with TTL, SK status, …). Its `routeCallback` forbids hostile / user-flagged rooms and discourages Source Keeper rooms with a 2.5× cost so Traveler routes around them.
3. **`traffic.js`** — wraps `Creep.prototype.move` to capture intents. After all roles run, a resolver gives idle friendlies a one-tile shove if they're blocking an active mover. Native Screeps already handles swaps and conga lines atomically, so the resolver only needs to handle the idle-blocker case.

Full architecture, memory schemas, and the local Traveler patches are documented in **[Documentation.md](Documentation.md)**.

---

## Console

A small `Game.cmd` API is exposed for in-game tweaks without redeploying:

```js
Game.cmd.spawn('E19S58', 'worker', 2, { level: 5 })
Game.cmd.setRoleProp('E19S62', 'transporter', 'targetResource', RESOURCE_HYDROGEN)
Game.cmd.counts('E19S61')
Game.cmd.sellResources(Game.rooms.E19S63)
```

See the **cmd.js** section in [Documentation.md](Documentation.md#cmdjs) for the full surface.

---

## Notable design choices

- **No external state.** All persistent data lives in `Memory.*`; no caches that survive a global reset are required for correctness.
- **One movement facade.** Roles never call `creep.moveTo`, `creep.move`, or `Traveler.travelTo` directly. Everything goes through `util.moveToTarget` so traffic resolution and route filtering apply uniformly.
- **Stationary opt-out.** A creep that intentionally stands still (miner on a container, etc.) sets `creep.memory.noShove = true` so the traffic manager doesn't bump it off its work tile.
- **Per-role tuning** of pathfinding behavior — combat creeps repath every tick; haulers cache aggressively.
- **Vendored, patched Traveler.** The `bonzaiferroni/Traveler` library is committed directly with two local patches (visualization gating + path-exhaustion fix), both documented for re-application on upstream refresh.

---

## License

Personal project — code provided as-is for reference. Feel free to read, learn, copy patterns.
