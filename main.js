const util = require('./util.root');
const rooms = require('./rooms');

module.exports.loop = function () {

    util.initGlobals();

    function cleanupMemory(){
        if(Object.keys(Memory.creeps).length > Object.keys(Game.creeps).length){
            for(var name in Memory.creeps) {
                if(!Game.creeps[name]) {
                    if(Memory.creeps[name].respawn){
                        let room = Game.rooms[Memory.creeps[name].room];
                        let memory = Memory.creeps[name];
                        console.log('Auto-Respawning: '+name+' in '+room.name);
                        rooms.pushSpawnQueue(room,{name:name, memory:memory});
                    }
                    delete Memory.creeps[name];
                    console.log('Clearing non-existing creep memory:', name);
                }
            }
        }
    }

    //Cleanup Creep Memory
    cleanupMemory();

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
