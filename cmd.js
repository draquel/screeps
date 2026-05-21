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
    runTest(creep){ util.runTest(creep) }
}
