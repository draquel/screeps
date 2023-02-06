const rooms = require('./rooms');
const creeps = require('./creeps');

module.exports.loop = function () {
    //Cleanup Creep Memory
    function cleanupMemory(){
        if(!Memory.creeps){ return; }

        if(Object.keys(Memory.creeps).length > Object.keys(Game.creeps).length){
            for(var name in Memory.creeps) {
                if(!Game.creeps[name]) {
                    if(Memory.creeps[name].respawn){
                        let room = Game.rooms[Memory.creeps[name].room];
                        let memory = Memory.creeps[name];
                        console.log('Auto-Respawning: '+name+' in '+room.name);
                        rooms.pushSpawnQueue(room,{name:name, memory:memory});
                    }else{
                        console.log('Clearing memory:', name);
                    }
                    delete Memory.creeps[name];
                }
            }
        }
    }
    cleanupMemory();

    //Room Ops
    var roomNames = Object.keys(Game.rooms);
    for(let i = 0; i < roomNames.length; i++){
        let room = Game.rooms[roomNames[i]];
        if(room.memory.roleMin == null) {
            rooms.initMem(room);
        }
        rooms.run(room);
    }

    //Run Creep Ops
    for(let name in Game.creeps) {
        let creep = Game.creeps[name];
        creeps.run(creep);
    }
}
