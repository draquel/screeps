const util = require("./util.root");
module.exports  =   {

    run(room){

        this.updateSpawnQueue(room);
        this.processSpawnQueue(room);

        if(room.controller.level == 1){
            Memory.roomData[room.name].roleMin.harvester = 3;
        }
    },

    processSpawnQueue(room){
        if(Memory.roomData[room.name].spawnQueue.length == 0){ return; }

        let spawns = this.getAvailableSpawns(room);
        if(spawns.length){
            for(let i = 0; i < spawns.length; i++){
                let build = Memory.roomData[room.name].spawnQueue[0];
                let res = util.spawnCreep(spawns[i],build.name,build.memory);
                if(res == 0){
                    Memory.roomData[room.name].spawnQueue.shift();
                }
            }
        }
    },

    getAvailableSpawns(room){
        let spawns = room.find(FIND_MY_SPAWNS);
        let available = [];
        if(spawns.length){
            for(let i = 0; i < spawns.length; i++){
                if(spawns[i].spawning == null){
                    available.push(spawns[i]);
                }
            }
            return available;
        }
        return false;
    },

    updateSpawnQueue(room){
        let roles = ['harvester','builder'];
        for(var i = 0; i < roles.length; i++){
            let roleCreeps = room.find(FIND_MY_CREEPS,{
                filter:(creep) => {
                    return creep.memory.role == roles[i];
                }
            });
            let roleCount = roleCreeps.length + this.getQueueCount(room,roles[i]) + this.getRespawnCount(room,roles[i]);
            if(roleCount < Memory.roomData[room.name].roleMin[roles[i]]){
                console.log('Added '+ roles[i] + ' to ' + room.name + ' spawn queue');
                let memory = {'role':roles[i],'respawn':true}
                Memory.roomData[room.name].spawnQueue.push({'name':util.nameGenerator(),'memory':memory});
            }
        }
    },

    getQueueCount(room,role = null){
        let count = 0;
        for(var i = 0; i < Memory.roomData[room.name].spawnQueue.length; i++){
            if(role != null && Memory.roomData[room.name].spawnQueue[i].memory.role != role){
                continue;
            }
            count++;
        }
        return count;
    },

    getRespawnCount(room,role = null){
        var creeps = 0;
        for(var name in Memory.creeps) {
            if(!Game.creeps[name]){
                if(Memory.creeps[name].respawn && Memory.creeps[name].home.room.name == room.name){
                    if(role != null && role != Memory.creeps[name].role){ continue; }
                    creeps++;
                }
            }
        }
        return creeps;
    },

    initMem(room){
        if(!Memory.roomData[room.name]){
            console.log('Initializing Room Memory: ' + room.name );
            var spawns = room.find(FIND_MY_SPAWNS);
            Memory.roomData[room.name] = {
                containersPlaced:false,
                roadNetworkPlaced:false,
                primarySpawn:spawns[0].id,
                spawnQueue:[],
                roleMin:{
                    "harvester":0,
                    "builder":0
                }
            };
        }
    }
}
