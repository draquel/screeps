const util = require("./util.root");

module.exports = {

    initMem(room){
        if(!room.memory.level){
            console.log('Initializing Room Memory: ' + room.name );
            room.memory = {
                level:{
                    '1':{spawnHarvesters:false,complete:false},
                    '2':{spawnBuilders:false,extensions:false,complete:false},
                    '3':{spawnMaintenance:false,extensions:false,containers:false,complete:false},
                    '4':{spawnCMiners:false,extensions:false,complete:false},
                    '5':{extensions:false,complete:false},
                    '6':{extensions:false,complete:false},
                    '7':{extensions:false,complete:false},
                    '8':{extensions:false,complete:false}
                },
                targetLink:null,
                spawning:[],
                spawnQueue:[]
            };
        }
    },

    run(room){
        this.initMem(room);

        this.processSpawnQueue(room);

        this.runTowers(room);
        this.runLinks(room);

        this.buildBase(room);
    },

    runTowers(room){
        let towers = room.find(FIND_STRUCTURES,{filter:(s) => s.structureType === STRUCTURE_TOWER});
        for(let j = 0; j < towers.length; j++){
            let target = towers[j].pos.findClosestByRange(FIND_HOSTILE_CREEPS);
            if(target !== undefined){
                towers[j].attack(target);
            }else{
                target = towers[j].pos.findClosestByRange(FIND_MY_CREEPS,{filter:(c) => c.hits < c.maxHits});
                if(target !== undefined){
                    towers[j].heal(target);
                }
            }
        }
    },

    runLinks(room){
        let targetLink = Game.getObjectById(room.memory.targetLink);
        let links = room.find(FIND_STRUCTURES,{filter:(s) => s.structureType === STRUCTURE_LINK})
        if(targetLink){
            for(let i = 0; i < links.length; i++){
                if(links[i].store.getFreeCapacity(RESOURCE_ENERGY) === 0){
                    links[i].transferEnergy(targetLink)
                }
            }
        }

    },

    buildBase(room){
        if(room.controller.owner.username != 'Deep160'){ return }

        if(room.controller.level === 1 && !room.memory.level['1'].complete){
            //spawn harvesters
            if(!room.memory.level['1'].spawnHarvesters) {
                this.queCreep(room, 'harvester', room.find(FIND_SOURCES).length, {respawn: true})
                room.memory.level['1'].spawnHarvesters = true
            }
            if(room.memory.level['1'].spawnHarvesters){
                room.memory.level['1'].complete = true
            }
        }

        if(room.controller.level === 2 && !room.memory.level['2'].complete){
            //spawn builders, build extensions
            if(!room.memory.level['2'].spawnBuilders){
                this.queCreep(room,'builder',2,{respawn:true})
                room.memory.level['2'].spawnBuilders = true;
            }
            if(!room.memory.level['2'].extensions){
                room.memory.level['2'].extensions = this.availableExtensions(room) === 0
            }

            if(room.memory.level['2'].extensions && room.memory.level['2'].spawnBuilders){
                room.memory.level['2'].complete = true;
            }
        }

        if(room.controller.level === 3 && !room.memory.level['3'].complete){
            //build extensions, place\build source containers, upgrade creeps to lvl 2, spawn maintenance
            if(!room.memory.level['3'].extensions){
                room.memory.level['3'].extensions = this.availableExtensions(room) === 0
            }

            if(!room.memory.level['3'].containers && room.memory.level['3'].extensions){
                let sources = room.find(FIND_SOURCES);
                for(let i = 0; i < sources.length; i++){
                    let spots = util.openSpacesNearPos(sources[i].pos,1,true);
                    room.createConstructionSite(spots[0].x,spots[0].y,STRUCTURE_CONTAINER);
                }
                room.memory.level['3'].containers = true;
            }

            if(!room.memory.level['3'].spawnMaintenance && room.memory.level['3'].containers){
                this.queCreep(room,'maintenance',2,{respawn:true})
                room.memory.level['3'].spawnMaintenance = true;
            }

            if(!room.memory.level['3'].upgradeCreeps && room.memory.level['3'].extensions){
                util.setCreepPropsByRole(room,'harvesters','level',2)
                util.setCreepPropsByRole(room,'builders','level',2)
                room.memory.level['3'].upgradeCreeps = true
            }

            if(room.memory.level['3'].extensions && room.memory.level['3'].containers && room.memory.level['3'].upgradeCreeps && room.memory.level['2'].spawnMaintenance){
                room.memory.level['3'].complete = true;
            }
        }
        if(room.controller.level === 4 && !room.memory.level['4'].complete){
            //switch harvesters to c-miners, add e-maint, upgrade creeps,
            if(!room.memory.level['4'].extensions){
                room.memory.level['4'].extensions = this.availableExtensions(room) === 0
            }
        }
        if(room.controller.level === 5 && !room.memory.level['5'].complete){
            //place target link
            if(!room.memory.level['5'].extensions){
                room.memory.level['5'].extensions = this.availableExtensions(room) === 0
            }
        }
        if(room.controller.level === 6 && !room.memory.level['6'].complete){
            if(!room.memory.level['6'].extensions){
                room.memory.level['6'].extensions = this.availableExtensions(room) === 0
            }
        }
        if(room.controller.level === 7 && !room.memory.level['7'].complete){
            if(!room.memory.level['7'].extensions){
                room.memory.level['7'].extensions = this.availableExtensions(room) === 0
            }
        }
        if(room.controller.level === 8 && !room.memory.level['8'].complete){
            if(!room.memory.level['8'].extensions){
                room.memory.level['8'].extensions = this.availableExtensions(room) === 0
            }
        }
    },

    updateSpawning(room){
        if(room.memory.spawning.length === 0){ return; }

        let creeps = room.find(FIND_MY_CREEPS);
        for(let i = 0; i < creeps.length; i++){
            for(let j = 0; j < room.memory.spawning.length; j++){
                if(creeps[i].name === room.memory.spawning[j].name || room.memory.spawning[j].name == undefined){
                    room.memory.spawning.splice(j,1);
                }
            }
        }
    },

    processSpawnQueue(room){
        this.updateSpawning(room);
        if(room.memory.spawnQueue.length === 0){ return; }

        let spawns = this.getAvailableSpawns(room);
        if(spawns.length){
            for(let i = 0; i < spawns.length; i++){
                let build = room.memory.spawnQueue[0];
                let res = util.spawnCreep(spawns[i],build.name,build.memory);
                if(res === 0){
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

    queCreep(room,role,count = 1,options = {level:1,respawn:false,target:null,target_room:null}){
        let succ = false
        for(let i = 0; i < count; i++){
            let memory = {'role':role,'level':options.level,'respawn':options.respawn,'target':options.target,'target_room':options.target_room}
            succ = this.pushSpawnQueue(room,{'name':util.nameGenerator(),'memory':this.initRole(room,memory)})
        }
        return succ
    },

    pushSpawnQueue(room,build,log=true){
        if(log){ console.log('Added '+ build.memory.role + (build.name ? ' ' + build.name : '') + ', to the ' + room.name + ' spawn queue'); }
        return room.memory.spawnQueue.push(build) > 0;
    },

    initRole(room,memory){
        let res = {};
        switch(memory.role){
            case 'harvester': res = this.initHarvester(room,memory); break;
            case 'c-miner': res = this.initCMiner(room,memory); break;
            default: res = memory; break;
        }
        return res;
    },

    initHarvester(room,memory){
        if(memory.target != null){ return memory; }

        let sourceIds  = room.find(FIND_SOURCES).map((s) => { return s.id; });
        let takenTargets = util.getCreepPropsByRole(room, 'harvester','target');

        let available = [];
        for(var i = 0; i < sourceIds.length; i++){
            if(takenTargets.includes(sourceIds[i])){ continue; }
            available.push(sourceIds[i]);
        }

        memory.target = (available.length ? available[0] : sourceIds[0] ) ;
        return memory;
    },

    initCMiner(room,memory){
        let rmContainers = room.find(FIND_STRUCTURES,{filter:(s) => s.structureType === STRUCTURE_CONTAINER});
        let taken = util.getCreepPropsByRole(room, 'c-miner','target');
        let available = [];
        for(let i = 0; i < rmContainers.length; i++){
            if(taken.includes(rmContainers[i].id)){ continue; }

            let nearby = rmContainers[i].pos.findInRange(FIND_SOURCES,1);
            if(nearby.length){
                available.push(rmContainers[i].id);
            }
        }

        if(available.length){
            memory.target = available[0];
        }

      return memory;
    },

    availableExtensions(room){
        return ((room.controller.level - 1) * 5) - room.find(FIND_MY_STRUCTURES,{filter:(s) => s.structureType === STRUCTURE_EXTENSION}).length
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
