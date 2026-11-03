/* eslint-disable no-undef */
const util = require('./util');
const rooms = require('./rooms');

module.exports = {

    // Single creep setters
    set(name, prop, value) {
        if(Game.creeps[name]) { Game.creeps[name].memory[prop] = value }
    },
    setRole(name, role)       { this.set(name, 'role', role) },
    setTarget(name, id)       { this.set(name, 'target', id) },
    setTargetRoom(name, room) { this.set(name, 'targetRoom', room) },
    setResource(name, res)    { this.set(name, 'targetResource', res) },
    setRespawn(name, val)     { this.set(name, 'respawn', val) },
    setLevel(name, level)     { this.set(name, 'level', level) },

    // Bulk set by role in a room
    setRoleProp(room, role, prop, value) {
        util.setCreepPropsByRole(room, role, prop, value)
    },
    getRoleProp(room, role, prop){
      util.getCreepPropsByRole(room, role, prop, true)
    },

    // Queries
    creeps(room, role) { return util.getCreepsByRole(room, role) },
    counts(room) {
        let creeps = Game.rooms[room].find(FIND_MY_CREEPS)
        return util.getCountMap(creeps.map(c => c.memory.role))
    },
    mem(name) {
        const c = Game.creeps[name]
        if(!c){ console.log('cmd.mem: no creep named '+name); return null; }
        console.log(name+': '+JSON.stringify(c.memory, null, 2))
        return c.memory
    },

    // Spawn queue
    spawn(room, role, count, opts, expidite = false) { rooms.queCreep(room, role, count, opts, expidite) },
    clearQueue(room) { rooms.clearQue(room) },
    unstuckQueue(room) { rooms.unstuckSpawnQueue(room) },
    sellResources(room, resource = null, amount = 10000){
      if(resource == null){
        resource = Game.getObjectById(room.memory.mineral).resource
      }
      rooms.sellForeignResources(room,resource,amount)
    },
    runTest(creep){ util.runTest(creep) },

    // Logistics (logistics.js): demand-driven sharing between my terminals.
    // cmd.logistics() prints each room's energy band state, needs and surplus.
    // Tunables: Memory.logistics.config (overrides logistics.DEFAULTS) and
    // Memory.logistics.rooms[name] = { weak, export, wants: {res: amt}, energy: {low, target, donorFloor} }.
    logistics() { return require('./logistics').report() },

    // Production (production.js): goal-driven lab reactions + upgrader boosts.
    production() { return require('./production').report() },

    // Power mining (power.js): known banks, active operation, recent results.
    // Tunables: Memory.power.config (overrides power.DEFAULTS, plus
    // powerEnergyFloor for power spawn processing, default 150000).
    power() { return require('./power').report() },
    // Abandon the current power operation for a bank id (crew retire).
    abortPower(bankId) {
      const p = require('./power')
      const op = p.mem().ops[bankId]
      if(!op){ console.log('no power op '+bankId+'; ops: '+Object.keys(p.mem().ops).join(', ')); return }
      p.endOp(op, 'aborted')
    },
    // Empire stockpile goal; amount 0/null removes it. e.g. cmd.goal('XGH2O', 10000)
    goal(resource, amount) {
      const p = require('./production')
      const cfg = p.mem().config
      cfg.goals = Object.assign({}, cfg.goals || p.DEFAULTS.goals)
      if(!(amount > 0)){ delete cfg.goals[resource] } else { cfg.goals[resource] = amount }
      console.log('production goals: '+JSON.stringify(cfg.goals))
      return cfg.goals
    },
    // Lab usage for a room: 'auto' | 'off' | 'react' | 'boost' | 'both'
    labMode(room, mode = 'auto') {
      require('./production').roomMem(room).mode = mode
      console.log('production: '+room+' lab mode '+mode)
    },
    // Queue dedicated (boost-eligible) upgraders: workers with every other duty off.
    spawnUpgraders(room, count = 1, level = 7) {
      rooms.queCreep(room, 'worker', count, { level: level, respawn: true, upgrader: true })
    },
    // Turn a live worker into a dedicated upgrader (or back with on = false).
    upgrader(name, on = true) {
      const c = Game.creeps[name]
      if(!c){ console.log('no creep '+name); return }
      c.memory.upgrader = on
      c.memory.eligibility = { base: !on, repair: !on, build: !on, ramparts: !on }
      console.log(name+' upgrader='+on)
    },
    want(room, resource, amount) {
      const m = require('./logistics').mem()
      const rc = m.rooms[room] = m.rooms[room] || {}
      rc.wants = rc.wants || {}
      if(!(amount > 0)){ delete rc.wants[resource] } else { rc.wants[resource] = amount }
      console.log('logistics: '+room+' wants '+JSON.stringify(rc.wants))
      return rc.wants
    },

    // Send energy between two of my rooms' terminals. Pass amount = null to send
    // the most the source terminal can afford after the transfer cost. Validates
    // up front and logs a readable reason instead of a bare error code.
    // Usage: cmd.sendEnergy('E19S59', 'E17S67', 20000)
    sendEnergy(from, to, amount = null) {
      const tag = 'cmd.sendEnergy '+from+' -> '+to+': '
      const src = Game.rooms[from]
      const dst = Game.rooms[to]
      if(!src || !src.controller || !src.controller.my){ console.log(tag+from+' is not a room I own/see'); return ERR_INVALID_ARGS }
      if(!dst || !dst.controller || !dst.controller.my){ console.log(tag+to+' is not a room I own/see'); return ERR_INVALID_ARGS }
      if(from === to){ console.log(tag+'source and destination are the same'); return ERR_INVALID_ARGS }
      if(!src.terminal){ console.log(tag+from+' has no terminal'); return ERR_INVALID_TARGET }
      if(!dst.terminal){ console.log(tag+to+' has no terminal'); return ERR_INVALID_TARGET }
      if(src.terminal.cooldown > 0){ console.log(tag+'terminal on cooldown for '+src.terminal.cooldown+' more ticks'); return ERR_TIRED }

      const available = src.terminal.store[RESOURCE_ENERGY] || 0
      // Largest amount where amount + cost fits in the terminal's energy.
      const maxSendable = () => {
        const rate = Game.market.calcTransactionCost(1000, from, to) / 1000
        let n = Math.floor(available / (1 + rate))
        while(n > 0 && n + Game.market.calcTransactionCost(n, from, to) > available){ n-- }
        return n
      }

      if(amount == null){ amount = maxSendable() }
      if(!(amount > 0)){ console.log(tag+'nothing to send ('+available+' energy in terminal)'); return ERR_NOT_ENOUGH_RESOURCES }

      const cost = Game.market.calcTransactionCost(amount, from, to)
      if(amount + cost > available){
        console.log(tag+'need '+(amount + cost)+' ('+amount+' + '+cost+' cost) but terminal has '+available+'; max sendable is '+maxSendable()+' (pass null to send that)')
        return ERR_NOT_ENOUGH_RESOURCES
      }
      const dstFree = dst.terminal.store.getFreeCapacity(RESOURCE_ENERGY)
      if(dstFree < amount){
        console.log(tag+to+' terminal only has '+dstFree+' free for '+amount)
        return ERR_FULL
      }

      const result = src.terminal.send(RESOURCE_ENERGY, amount, to)
      if(result === OK){
        console.log(tag+'sent '+amount+' energy (cost '+cost+', '+(available - amount - cost)+' left in '+from+' terminal)')
      }else{
        console.log(tag+'send failed with code '+result)
      }
      return result
    },

    // Intel helpers — manipulate Memory.intel.rooms for hostile-room avoidance.
    // See Documentation.md "Movement Architecture" for the schema and which
    // fields are safe to set manually vs. overwritten by intel.update().
    _intelRoom(name) {
      if(!Memory.intel) Memory.intel = {}
      if(!Memory.intel.rooms) Memory.intel.rooms = {}
      if(!Memory.intel.rooms[name]) Memory.intel.rooms[name] = { lastScouted: Game.time }
      return Memory.intel.rooms[name]
    },
    avoidRoom(name)   { this._intelRoom(name).avoid = true;  console.log('intel: '+name+' avoid=true') },
    unavoidRoom(name) {
      if(!Memory.intel || !Memory.intel.rooms || !Memory.intel.rooms[name]) return
      delete Memory.intel.rooms[name].avoid
      console.log('intel: '+name+' avoid cleared')
    },
    markHostile(name) {
      let r = this._intelRoom(name)
      r.hostile = true
      r.hostileSeen = Game.time
      console.log('intel: '+name+' hostile=true (TTL '+(Memory.intel.hostileTTL || 5000)+' ticks)')
    },
    ignoreHostile(name) {
      this._intelRoom(name).ignoreHostile = true
      console.log('intel: '+name+' ignoreHostile=true (routing will treat as safe even if observed hostile)')
    },
    unignoreHostile(name) {
      if(!Memory.intel || !Memory.intel.rooms || !Memory.intel.rooms[name]) return
      delete Memory.intel.rooms[name].ignoreHostile
      console.log('intel: '+name+' ignoreHostile cleared')
    },
    setRoomOwner(name, owner) {
      this._intelRoom(name).owner = owner
      console.log('intel: '+name+' owner='+owner)
    },
    clearRoom(name) {
      if(Memory.intel && Memory.intel.rooms){ delete Memory.intel.rooms[name] }
      console.log('intel: '+name+' cleared')
    },
    intel(name) {
      let r = Memory.intel && Memory.intel.rooms ? Memory.intel.rooms[name] : null
      console.log('intel '+name+': '+(r ? JSON.stringify(r) : 'no entry'))
      return r
    },
    listFlagged() {
      if(!Memory.intel || !Memory.intel.rooms) return []
      let flagged = Object.keys(Memory.intel.rooms).filter(n => {
        let r = Memory.intel.rooms[n]
        return r.avoid || r.hostile
      })
      flagged.forEach(n => console.log(n+': '+JSON.stringify(Memory.intel.rooms[n])))
      return flagged
    },
}
