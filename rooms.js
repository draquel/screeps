const util = require("./util.root");

module.exports = {

    initMem(room){
        if(!room.memory.roleMin){
            console.log('Initializing Room Memory: ' + room.name );
            //let spawns = room.find(FIND_MY_SPAWNS);
            room.memory = {
                level:{
                    '1':{setRoleMin:false},
                    '2':{setRoleMin:false,addExtensions:false,upgradeCreeps:false,addContainers:false,complete:false},
                    '3':{setRoleMin:false,addExtensions:false,complete:false}
                },
                containersPlaced:false,
                roadNetworkPlaced:false,
                //primarySpawn:spawns[0].id,
                spawning:[],
                spawnQueue:[],
                roleMin:{
                    "harvester":0,
                    "c-miner":0,
                    "builder":0,
                    "maintenance":0
                }
            };
        }
    },

    isInit(room){

    },

    run(room){
        this.updateSpawning(room);
        this.updateSpawnQueue(room);
        this.processSpawnQueue(room);

        this.runTowers(room);

        if(room.controller.level === 1 && !room.memory.level['1'].setRoleMin){
            let spawns = room.find(FIND_SOURCES);
            room.memory.roleMin.harvester = spawns.length;
            room.memory.level['1'].setRoleMin = true;
        }
        if(room.controller.level === 2 && !room.memory.level['2'].complete){
            if(!room.memory.level['2'].setRoleMin) {
                room.memory.roleMin.builder = 2;
                room.memory.level['2'].setRoleMin = true;
            }

            // if(!room.memory.level['2'].addExtensions){
            //     let spawns = room.find(FIND_MY_SPAWNS);
            //     let center = spawns[0].pos;
            //     room.createConstructionSite(center.x + 3, center.y - 1, STRUCTURE_EXTENSION);
            //     room.createConstructionSite(center.x + 4, center.y - 1, STRUCTURE_EXTENSION);
            //     room.createConstructionSite(center.x + 5, center.y - 1, STRUCTURE_EXTENSION);
            //     room.createConstructionSite(center.x + 6, center.y - 1, STRUCTURE_EXTENSION);
            //     room.createConstructionSite(center.x + 7, center.y - 1, STRUCTURE_EXTENSION);
            //     room.memory.level['2'].addExtensions = true;
            // }

            // if(
            //     !room.memory.level['2'].upgradeCreeps
            //     && room.find(FIND_MY_STRUCTURES)
            //         .map((s) => { return s.structureType; })
            //         .filter((s) => { return s === 'extension'; }).length === 5
            // ){
            //     let creeps = room.find(FIND_MY_CREEPS,{filter:(creep) => { return creep.memory.room === room.name; }})
            //     util.setCreepProp(creeps,'level',2);
            //     room.memory.level['2'].upgradeCreeps = true;
            // }

            if(!room.memory.level['2'].addContainers &&
                room.find(FIND_MY_STRUCTURES)
                        .map((s) => { return s.structureType; })
                        .filter((s) => { return s === 'extension'; }).length === 5){
                let sources = room.find(FIND_SOURCES);
                for(let i = 0; i < sources.length; i++){
                    let spots = util.openSpacesNearPos(sources[i].pos,1,true);
                    room.createConstructionSite(spots[0].x,spots[0].y,STRUCTURE_CONTAINER);
                }
                room.memory.roleMin.builder = 3;
                room.memory.level['2'].addContainers = true;
            }

            if(room.memory.level['2'].setRoleMin && room.memory.level['2'].addExtensions && room.memory.level['2'].addContainers){
                room.memory.level['2'].complete = true;
            }
        }

        if(room.controller.level === 3 && !room.memory.level['3'].complete){

            // if(!room.memory.level['3'].addExtensions){
            //     let spawns = room.find(FIND_MY_SPAWNS);
            //     let center = spawns[0].pos;
            //     room.createConstructionSite(center.x + 3, center.y, STRUCTURE_ROAD);
            //     room.createConstructionSite(center.x + 4, center.y, STRUCTURE_ROAD);
            //     room.createConstructionSite(center.x + 5, center.y, STRUCTURE_ROAD);
            //     room.createConstructionSite(center.x + 6, center.y, STRUCTURE_ROAD);
            //     room.createConstructionSite(center.x + 7, center.y, STRUCTURE_ROAD);
            //
            //     room.createConstructionSite(center.x + 3, center.y + 1, STRUCTURE_EXTENSION);
            //     room.createConstructionSite(center.x + 4, center.y + 1, STRUCTURE_EXTENSION);
            //     room.createConstructionSite(center.x + 5, center.y + 1, STRUCTURE_EXTENSION);
            //     room.createConstructionSite(center.x + 6, center.y + 1, STRUCTURE_EXTENSION);
            //     room.createConstructionSite(center.x + 7, center.y + 1, STRUCTURE_EXTENSION);
            //     room.memory.level['3'].addExtensions = true;
            // }

            if(
                !room.memory.level['3'].addContainers
                && room.find(FIND_MY_STRUCTURES)
                    .map((s) => { return s.structureType; })
                    .filter((s) => { return s === 'extension'; }).length === 10
            ){
                let sources = room.find(FIND_SOURCES);
                for(var i = 0; i < sources.length; i++){
                    let spots = util.openSpacesNearPos(sources[i].pos,2,true);
                    room.createConstructionSite(spots[0].x,spots[0].y,STRUCTURE_CONTAINER);
                }
                room.memory.level['3'].addContainers = true;
            }
        }

        if(room.controller.level === 4 && !room.memory.level['4'].complete){
            // if(!room.memory.level['4'].addExtensions){
            //     let spawns = room.find(FIND_MY_SPAWNS);
            //     let center = spawns[0].pos;
            //     room.createConstructionSite(center.x + 3, center.y + 2, STRUCTURE_ROAD);
            //     room.createConstructionSite(center.x + 4, center.y + 2, STRUCTURE_ROAD);
            //     room.createConstructionSite(center.x + 5, center.y + 2, STRUCTURE_ROAD);
            //     room.createConstructionSite(center.x + 6, center.y + 2, STRUCTURE_ROAD);
            //     room.createConstructionSite(center.x + 7, center.y + 2, STRUCTURE_ROAD);
            //
            //     room.createConstructionSite(center.x + 3, center.y + 3, STRUCTURE_EXTENSION);
            //     room.createConstructionSite(center.x + 4, center.y + 3, STRUCTURE_EXTENSION);
            //     room.createConstructionSite(center.x + 5, center.y + 3, STRUCTURE_EXTENSION);
            //     room.createConstructionSite(center.x + 6, center.y + 3, STRUCTURE_EXTENSION);
            //     room.createConstructionSite(center.x + 7, center.y + 3, STRUCTURE_EXTENSION);
            //     room.memory.level['4'].addExtensions = true;
            // }
        }

    },

    runTowers(room){
        let towers = room.find(FIND_STRUCTURES,{filter:(s) => s.structureType == STRUCTURE_TOWER});
        for(let j = 0; j < towers.length; j++){
            let target = towers[j].pos.findClosestByRange(FIND_HOSTILE_CREEPS);
            if(target != undefined){
                towers[j].attack(target);
            }else{
                target = towers[j].pos.findClosestByRange(FIND_MY_CREEPS,{filter:(c) => c.hits < c.maxHits});
                if(target != undefined){
                    towers[j].heal(target);
                }
            }
        }
    },

    updateSpawning(room){
        if(room.memory.spawning.length === 0){ return; }

        let creeps = room.find(FIND_MY_CREEPS);
        for(let i = 0; i < creeps.length; i++){
            for(let j = 0; j < room.memory.spawning.length; j++){
                if(creeps[i].name === room.memory.spawning[j].name){
                    room.memory.spawning.splice(j,1);
                }
            }
        }
    },

    processSpawnQueue(room){
        if(room.memory.spawnQueue.length === 0){ return; }

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
        let roles = ['harvester','builder','maintenance','c-miner'];
        for(var i = 0; i < roles.length; i++){
            let roleCreeps = room.find(FIND_MY_CREEPS,{
                filter:(creep) => {
                    return creep.memory.role === roles[i];
                }
            });
            let roleCount = roleCreeps.length + this.getQueueCount(room,roles[i]) + this.getRespawnCount(room,roles[i]) + this.getSpawningCount(room,roles[i]);
            if(roleCount < room.memory.roleMin[roles[i]]){
                let memory = {'role':roles[i],'respawn':true}
                memory = this.initRole(room,memory);
                this.pushSpawnQueue(room,{'name':util.nameGenerator(),'memory':memory})
            }
        }
    },

    initRole(room,memory){
        let res = {};
        switch(memory.role){
            case 'harvester': res = this.initHarvester(room,memory);
            default: res = memory;
        }
        return res;
    },

    initHarvester(room,memory){
        let sourceIds  = room.find(FIND_SOURCES).map((s) => { return s.id; });
        let takenTargets = util.getCreepPropsByRole(room, 'harvester','target');

        let available = [];
        for(var i = 0; i < sourceIds.length; i++){
            if(takenTargets.includes(sourceIds[i])){ continue; }
            available.push(sourceIds[i]);
        }

        memory.target = available[0];
        return memory;
    },

    pushSpawnQueue(room,build){
        room.memory.spawnQueue.push(build);
        console.log('Added '+ build.memory.role + (build.name ? ' ' + build.name : '') + ', to the ' + room.name + ' spawn queue');
    },

    getQueueCount(room,role = null){
        let count = 0;
        for(var i = 0; i < room.memory.spawnQueue.length; i++){
            if(role != null && room.memory.spawnQueue[i].memory.role !== role){
                continue;
            }
            count++;
        }
        return count;
    },

    getSpawningCount(room,role = null){
        let count = 0;
        for(var i = 0; i < room.memory.spawning.length; i++){
            if(role != null && room.memory.spawning[i].memory.role !== role){
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
                if(Memory.creeps[name].respawn && Game.getObjectById(Memory.creeps[name].room).name === room.name){
                    if(role != null && role !== Memory.creeps[name].role){ continue; }
                    creeps++;
                }
            }
        }
        return creeps;
    }
}
