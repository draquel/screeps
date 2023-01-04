class RoomManager{
    
    constructor(room){
        this.room = room;
        this.spawnQueue = new Queue();

        this.initMem();
    }

    op(){
        
    }

    initMem(){
        if(!Memory.roomData[room.name]){
            var spawns = room.find(FIND_MY_SPAWNS);
            Memory.roomData[room.name] = {
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