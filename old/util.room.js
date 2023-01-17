var util = require('util.root');
var utilCreep = require('old/util.creep');
const creepUtil = require('./util.creep');

var roomUtil = {
    initData: function(room){
        if(!Memory.roomData[room.name]){
            var spawns = room.find(FIND_MY_SPAWNS);
            Memory.roomData[room.name] = new RoomManager();
        }
    },

    creepSpawner: function(room){
        var spawns = room.find(FIND_MY_SPAWNS);
        var sources = room.find(FIND_SOURCES);
        var harvesters = room.find(FIND_MY_CREEPS,{
            filter:(creep) => {
                return creep.memory.role == 'harvester'
            }
        });
        var builders = room.find(FIND_MY_CREEPS,{
            filter:(creep) => {
                return creep.memory.role == 'builder'
            }
        });

        //Spawn harvesters
        var harvesterCount = harvesters.length + utilCreep.checkRoleRespawnCount('harvester');
        if(spawns[0].spawning == null && harvesterCount < Memory.roomData[room.name].roleMin.harvester){
            var sourceIds = sources.map((s) => { return s.id; });
            var takenTargets = utilCreep.getTargets(harvesters);
            var avaliable = [];
            for(var i = 0; i < sourceIds.length; i++){
                if(takenTargets.includes(sourceIds[i])){ continue; }
                avaliable.push(sourceIds[i]);
            }
            if(avaliable.length){
                this.spawnHarvester(room,avaliable[0]);
            }
        }

        //Spawn Builders
        var builderCount = builders.length + utilCreep.checkRoleRespawnCount('builder');
        if(!spawns[0].spawning && builderCount < Memory.roomData[room.name].roleMin.builder){
            var name = utilCreep.nameGenerator();
            var memory = {role:"builder",level:1,respawn:true};
            utilCreep.spawnCreep(spawns[0],name,memory);
        }
    },

    run: function(room){

        this.creepSpawner(room);

        if(room.controller.level == 1){

            Memory.roomData[room.name].roleMin.harvester = 3;

        }

        if(room.controller.level == 2){
            //place containers near harvester targets
            //place extensions x3
            //spawn builders to work on all the constuction, prioritize extensions
            //when containers are built/full retire harvesters and spawn miners / upgraders / logistics creeps lvl

            Memory.roomData[room.name].roleMin.builders = 3;

            var spawns = room.find(FIND_MY_SPAWNS);
            var harvesters = room.find(FIND_MY_CREEPS,{
                filter:(creep) => {
                    return creep.memory.role == 'harvester'
                }
            });
            var extensions = room.find(FIND_MY_STRUCTURES,{filter: (structure) => { structure.structureType == STRUCTURE_EXTENSION}});
            var targetIds = utilCreep.getTargets(harvesters);

            room.createConstructionSite(spawns[0].x-1,spawns[0].y-2,STRUCTURE_EXTENSION);
            room.createConstructionSite(spawns[0].x-2,spawns[0].y-1,STRUCTURE_EXTENSION);
            room.createConstructionSite(spawns[0].x-3,spawns[0].y,STRUCTURE_EXTENSION);

            if(!Memory.roomData[room.name].containersPlaced && extensions.length == 3){
                for(var i = 0; i < targetIds.length; i++){
                    let source = Game.getObjectById(targetIds[i]);
                    let spots = util.openSpacesNearPos(source.pos,1,true);
                    room.createConstructionSite(spots[0].x,spots[0].y,STRUCTURE_CONTAINER);
                }

                var continers = room.find(FIND_MY_CONSTRUCTION_SITES,{filter: (site) => { return site.structureType == STRUCTURE_CONTAINER}})
                if(continers.length == 3){
                    console.log("Finished placing containers at sources")
                    Memory.roomData[room.name].containersPlaced = true;
                }
            }else if(Memory.roomData[room.name].containersPlaced){
                var structures = room.find(FIND_STRUCTURES,{ filter: (structure) => { return structure.structureType == STRUCTURE_CONTAINER || structure.structureType == STRUCTURE_EXTENSION; } });
                if(structures.length == (targetIds.length+3)){
                    this.constructRoadNetwork(room,targetIds);
                }
            }

        }
    },
    spawnHarvester: function(room,targetId){
        var spawns = room.find(FIND_MY_SPAWNS);
        var name = utilCreep.nameGenerator();
        var memory = {role:"harvester",level:1,target:targetId,respawn:true};
        utilCreep.spawnCreep(spawns[0],name,memory);
    },
    constructRoadNetwork(room,targetIds){
        if(Memory.roomData[room.name].roadNetworkPlaced){ return; }
        var spawns = room.find(FIND_MY_SPAWNS);
        var spawn = spawns[0];
        //Spawn Triangle Around Spawn
        var top = new RoomPosition(spawn.pos.x,spawn.pos.y-2,room.name);
        var left = new RoomPosition(spawn.pos.x-3,spawn.pos.y+3,room.name);
        var right = new RoomPosition(spawn.pos.x+3,spawn.pos.y+3,room.name);
        this.constructRoad(room,top,left,true);
        this.constructRoad(room,left,right,true);
        this.constructRoad(room,top,right,true);

        //Build roads to Harvester targets
        for(var i = 0; i < targetIds.length; i++){
            let targetObj= Game.getObjectById(targetIds[i]);
            let end = this.directionalPosOffset(spawn.pos,targetObj.pos);
            this.constructRoad(room,targetObj.pos,end,false);
        }

        //Build road to Room Controller
        this.constructRoad(room,room.controller.pos,this.directionalPosOffset(spawns[0].pos,room.controller.pos),false);
    },
    constructRoad: function(room,startPos,endPos,addEnds = false){
        var options = {};
        var pathData = PathFinder.search(startPos,endPos);

        // console.log(startPos.x+","+startPos.y)
        // console.log(endPos.x+","+endPos.y)
        // console.log(pathData.path.length)

        if(addEnds){
            room.createConstructionSite(startPos.x,startPos.y,STRUCTURE_ROAD);
        }
        for(var i = 0; i < (addEnds ? pathData.path.length : pathData.path.length - 1); i++){
            room.createConstructionSite(pathData.path[i].x,pathData.path[i].y,STRUCTURE_ROAD);
        }
    },
    directionalPosOffset: function(pos,guide,offset = 2){
        var end = new RoomPosition(pos.x,pos.y,pos.roomName);
        //TODO include offset ratio to adjust by factor of the difference
        if(guide.x < pos.x){ end.x -= offset }else{ end.x += offset }
        if(guide.y < pos.y){ end.y -= offset }else{ end.y += offset }

        return end;
    },
    buildBase: function(room){

    },
    defendRoom: function (room) {
        var hostiles = room.find(FIND_HOSTILE_CREEPS);
        if(hostiles.length > 0) {
            var username = hostiles[0].owner.username;
            Game.notify(`User ${username} spotted in room ${roomName}`);
            var towers = room.find(
                FIND_MY_STRUCTURES, {filter: {structureType: STRUCTURE_TOWER}});
            towers.forEach(tower => tower.attack(hostiles[0]));
        }else{
            var freindlies = room.find(FIND_MY_CREEPS);
            
        }
    }
}

module.exports = roomUtil;
