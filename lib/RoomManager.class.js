
const util = require('../util.root');

class RoomManager{
    
    constructor(room){
        this.room = room;
        this.spawnQueue = new Queue();
        this.initMem();
    }

    run(){
        this.spawner();
    }

    spawner(){
        this.updateSpawnQueue();
        this.processSpawnQueue();
    }

    updateSpawnQueue(){
        let roles = ['harvester','builder'];

        for(var i = 0; i < roles.length; i++){
            let roleCreeps = this.room.find(FIND_MY_CREEPS,{
                filter:(creep) => {
                    return creep.memory.role == roles[i];
                }
            });
            let roleCount = roleCreeps.length + this.getQueueCount(roles[i]) + this.getRespawnCount(roles[i]);
            if(roleCount < Memory.roomData[room.name].roleMin[roles[i]]){
                let memory = {'role':roles[i],'respawn':true}
                this.spawnQueue.enqueue({'name':util.nameGenerator(),'memory':memory});
            }
        }
    }

    processSpawnQueue(){
        var spawn = this.getAvailableSpawn();
        while(spawn && this.spawnQueue.length){
            let build = this.spawnQueue.dequeue();
            util.spawnCreep(spawn,build.name,build.memory);
            spawn = this.getAvailableSpawn();
        }
    }

    getAvailableSpawn(){
        var spawns = this.room.find(FIND_MY_SPAWNS);

        for(var i = 0; i < spawns; i++){
            if(spawns[i].spawning == null){
                return spawns[i];
            }
        }
        return false;
    }

    getQueueCount(role = null){
        let i = this.spawnQueue.head;
        let count = 0;
        while(i <= this.spawnQueue.tail){
            if(role != null && this.spawnQueue.check(i).memory.role != role){
                continue;
            }
            count++;
            i = i ++;
        }
        return count;
    }

    getRespawnCount(role = null){
        var creeps = 0;
        for(var name in Memory.creeps) {
            if(!Game.creeps[name]){
                if(Memory.creeps[name].respawn && Memory.creeps[name].home.room.name == this.room.name){
                    if(role != null && role != Memory.creeps[name].role){ continue; }
                    creeps++;
                }
            }
        }
        return creeps;
    }


    initMem(){
        if(!Memory.roomData[this.room.name]){
            var spawns = this.room.find(FIND_MY_SPAWNS);
            Memory.roomData[this.room.name] = {
                containersPlaced:false,
                roadNetworkPlaced:false,
                primarySpawn:spawns[0].id,
                roleMin:{
                    "harvester":0,
                    "builder":0
                }
            };
        }
    }
}
