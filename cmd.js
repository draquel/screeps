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
