
const util = require('./util.root');
const rooms = require('./rooms');


module.exports.loop = function () {

    util.initGlobals();

    //Cleanup Creep Memory
    //  util.cleanupMemory();

    //Room Operations
    var roomNames = Object.keys(Game.rooms);
    for(var i = 0; i < roomNames.length; i++){
        let room = Game.rooms[roomNames[i]];
        if(room.memory.roleMin == null) {
            rooms.initMem(room);
        }
        rooms.run(room);
    }

    //Run Creep Roles
    // for(var name in Game.creeps) {
    //     var creep = Game.creeps[name];
    //     if(!Memory.creepData[creepNames[i]]) {
    //         Memory.creepData[creepNames[i]] = new CreepManager(creep);
    //     }
    //     Memory.creepData[creepNames[i]].run();
    // }
}
