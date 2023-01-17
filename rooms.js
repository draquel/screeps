const util = require("./util.root");
module.exports  =   {

    initMem(room){
        if(!room.memory.roleMin){
            console.log('Initializing Room Memory: ' + room.name );
            let spawns = room.find(FIND_MY_SPAWNS);
            room.memory = {
                containersPlaced:false,
                roadNetworkPlaced:false,
                primarySpawn:spawns[0].id,
                spawning:[],
                spawnQueue:[],
                roleMin:{
                    "harvester":0,
                    "builder":0
                }
            };
        }
    },

    run(room){
        this.updateSpawning(room);
        this.updateSpawnQueue(room);
        this.processSpawnQueue(room);


        if(room.controller.level == 1){
            room.memory.roleMin.harvester = 3;
        }
    },

    updateSpawning(room){
        if(room.memory.spawning.length == 0){ return; }

        let creeps = room.find(FIND_MY_CREEPS);
        for(let i = 0; i < creeps.length; i++){
            for(let j = 0; j < room.memory.spawning.length; j++){
                if(creeps[i].name == room.memory.spawning[j].name){
                    room.memory.spawning.splice(j,1);
                }
            }
        }
    },

    processSpawnQueue(room){
        if(room.memory.spawnQueue.length == 0){ return; }

        let spawns = this.getAvailableSpawns(room);
        if(spawns.length){
            for(let i = 0; i < spawns.length; i++){
                let build = room.memory.spawnQueue[0];
                let res = util.spawnCreep(spawns[i],build.name,build.memory);
                if(res == 0){
                    room.memory.spawning.push(room.memory.spawnQueue.shift());
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
            let roleCount = roleCreeps.length + this.getQueueCount(room,roles[i]) + this.getRespawnCount(room,roles[i]) + this.getSpawningCount(room,roles[i]);
            if(roleCount < room.memory.roleMin[roles[i]]){
                let memory = {'role':roles[i],'respawn':true}
                this.pushSpawnQueue(room,{'name':util.nameGenerator(),'memory':memory})
            }
        }
    },

    pushSpawnQueue(room,build){
        room.memory.spawnQueue.push(build);
        console.log('Added '+ build.memory.role + (build.name ? ' ' + build.name : '') + ', to the ' + room.name + ' spawn queue');
    },

    getQueueCount(room,role = null){
        let count = 0;
        for(var i = 0; i < room.memory.spawnQueue.length; i++){
            if(role != null && room.memory.spawnQueue[i].memory.role != role){
                continue;
            }
            count++;
        }
        return count;
    },

    getSpawningCount(room,role = null){
        let count = 0;
        for(var i = 0; i < room.memory.spawning.length; i++){
            if(role != null && room.memory.spawning[i].memory.role != role){
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
                if(Memory.creeps[name].respawn && Game.getObjectById(Memory.creeps[name].room).name == room.name){
                    if(role != null && role != Memory.creeps[name].role){ continue; }
                    creeps++;
                }
            }
        }
        return creeps;
    }
}
