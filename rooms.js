const util = require("./util");

module.exports = {

    initMem(room){
        if(!room.memory.showPath){
            console.log('Initializing Room Memory: ' + room.name )
        }
        room.memory = {
            reusePath:room.memory.reusePath === undefined ? 4 : room.memory.reusePath,
            showPath:room.memory.showPath === undefined ? true : room.memory.showPath,
            targetLink:room.memory.targetLink === undefined ? null : room.memory.targetLink,
            spawning:room.memory.spawning === undefined ? [] : room.memory.spawning,
            spawnQueue:room.memory.spawnQueue === undefined ? [] : room.memory.spawnQueue,
        }
    },

    run(room){
        this.initMem(room)

        if(Game.time%40 === 0){
            this.runMiningCrew(room)
        }
        this.processSpawnQueue(room)

        this.runTowers(room)
        this.runLinks(room)

    },

    runTowers(room){
        let towers = room.find(FIND_STRUCTURES,{filter:(s) => s.structureType === STRUCTURE_TOWER});
        for(let j = 0; j < towers.length; j++){
            let target = towers[j].pos.findClosestByRange(FIND_HOSTILE_CREEPS)
            if(target !== null){
                towers[j].attack(target)
            }else{
                target = towers[j].pos.findClosestByRange(FIND_MY_CREEPS,{filter:(c) => c.hits < c.maxHits})
                if(target !== null){
                    towers[j].heal(target)
                }else{
                    target = towers[j].pos.findClosestByRange(FIND_STRUCTURES,{filter:(s) => s.structureType === STRUCTURE_WALL && s.hits < s.maxHits})
                    if(target !== null){
                        towers[j].heal(target)
                    }
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

    runMiningCrew(room) {
        if (room.controller.level < 6) {
            return
        }

        let mineral = this.getMineral(room)
        let extractor = this.getExtractor(room)
        let container = this.getMineralContainer(room, mineral)

        if(extractor != null && container != null && mineral.mineralAmount > 0){
            let miner = util.getCreepsByRole(room,'miner').filter( (c) => { return c.memory.targetResource === mineral.mineralType })
            let transporter = util.getCreepsByRole(room,'transporter').filter( (c) => { return c.memory.targetResource === mineral.mineralType })
            if(!miner.length && !transporter.length){
                console.log('Extractable Minerals ['+mineral.mineralType+'] Detected in '+room.name+' Deploying Mining Crew')
                this.queMiningCrew(room)
            }else{
                console.log('Mineral Extraction In Progress in '+room.name)
            }
        }
        if(mineral.mineralAmount === 0 && extractor != null && container != null){
            console.log('Mineral Extraction Paused in '+room.name+'. Mineral Regeneration in '+mineral.ticksToRegeneration+' ticks')
        }
    },

    getSources(room){
        return room.find(FIND_SOURCES)
    },

    getMineral(room){
        return room.find(FIND_MINERALS).shift()
    },

    getMineralContainer(room,mineral){
        return room.find(FIND_STRUCTURES,{filter: (s) => { return s.pos.inRangeTo(mineral,1) }}).shift()
    },

    getExtractor(room){
        return room.find(FIND_STRUCTURES,{filter:(s) => { return s.structureType === STRUCTURE_EXTRACTOR}}).shift()
    },

    queMiningCrew(room){
        let mineral = this.getMineral(room)
        let container = this.getMineralContainer(room,mineral)
        if(mineral == null || container == null){
            return false;
        }

        this.queCreep(room,'miner',1,{respawn:false,level:4,target:container.id,targetResource:mineral.mineralType})
        this.queCreep(room,'transporter',1,{respawn:false,level:2,targetResource:mineral.mineralType})
        return true
    },

    queEnergyMiners(room){
        let sources = this.getSources(room)
        this.queCreep(room,'miner',sources.length,{respawn:true,level:2})
    },

    queEnergyTransporters(room){
        let sources = this.getSources(room)
        this.queCreep(room,'transporter',sources.length,{respawn:true,level:2})
    },

    buildBase(room){
        if(room.controller.owner !== undefined && room.controller.owner.username !== 'Deep160'){ return }

        if(room.controller.level === 1 && !room.memory.level['1'].complete){
            //spawn harvesters
            if(!room.memory.level['1'].spawnHarvesters) {
                this.queCreep(room, 'harvester', this.getSources(room).length, {respawn: true})
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
                util.setCreepPropsByRole(room,'builder','level',2)
                room.memory.level['2'].complete = true;
            }
        }

        if(room.controller.level === 3 && !room.memory.level['3'].complete){
            //build extensions, place\build source containers, switch harvesters to miners, spawn maintenance
            if(!room.memory.level['3'].extensions){
                room.memory.level['3'].extensions = this.availableExtensions(room) === 0
            }

            if(!room.memory.level['3'].containers && room.memory.level['3'].extensions){
                let sources = this.getSources(room);
                for(let i = 0; i < sources.length; i++){
                    let spots = util.openSpacesNearPos(sources[i].pos,1,true);
                    room.createConstructionSite(spots[0].x,spots[0].y,STRUCTURE_CONTAINER);
                }
                room.memory.level['3'].containers = true;
            }

            if(!room.memory.level['3'].containersBuilt && room.find(FIND_STRUCTURES,{filter:(s) => { return s.structureType === STRUCTURE_CONTAINER }}).length >= this.getSources(room).length){
                room.memory.level['3'].containersBuilt = true;
            }

            if(!room.memory.level['3'].spawnMaintenance && room.memory.level['3'].containersBuilt){
                this.queCreep(room,'maintenance',2,{respawn:true})
                room.memory.level['3'].spawnMaintenance = true;
            }

            if(!room.memory.level['3'].upgradeCreeps1 && room.memory.level['3'].containersBuilt){
                util.setCreepPropsByRole(room,'harvester','respawn',false)
                this.queCreep(room,'miner',this.getSources(room).length,{respawn:true,level:2})
                console.log('Upgraded Harvesters to Miners')
                room.memory.level['3'].upgradeCreeps1 = true
            }

            if(room.memory.level['3'].extensions && room.memory.level['3'].containers && room.memory.level['3'].upgradeCreeps && room.memory.level['2'].spawnMaintenance){
                room.memory.level['3'].complete = true;
            }
        }

        if(room.controller.level === 4 && !room.memory.level['4'].complete){
            //switch harvesters to miners, add e-maint, upgrade creeps,
            if(!room.memory.level['4'].extensions){
                room.memory.level['4'].extensions = this.availableExtensions(room) === 0
            }

            if(!room.memory.level['4'].upgradeCreeps && room.memory.level['4'].extensions){
                util.setCreepPropsByRole(room,'miner','level',3)
                util.setCreepPropsByRole(room,'r-harvester','level',3)
                util.setCreepPropsByRole(room,'builder','level',3)
                room.memory.level['4'].upgradeCreeps = true
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
                if(creeps[i].name === room.memory.spawning[j].name || room.memory.spawning[j].name === undefined){
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

    queCreep(room,role,count = 1,options = {level:1,respawn:true,target:null,targetRoom:null,targetCollect:null,targetResource:null}){
        let succ = false
        for(let i = 0; i < count; i++){
            let memory = {'role':role,'level':options.level,'respawn':options.respawn,'target':options.target,'targetRoom':options.targetRoom,'targetCollect':options.targetCollect,'targetResource':options.targetResource}
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
            case 'miner': res = this.initMiner(room,memory); break;
            default: res = memory; break;
        }
        return res;
    },

    initMiner(room,memory){
        if(memory.target != null && Game.getObjectById(memory.target) != null){
            return memory
        }

        let rmContainers = room.find(FIND_STRUCTURES,{filter:(s) => s.structureType === STRUCTURE_CONTAINER})
        let taken = util.getCreepPropsByRole(room, 'miner','target')
        let available = []
        for(let i = 0; i < rmContainers.length; i++){
            if(taken.includes(rmContainers[i].id)){ continue }

            let nearby = rmContainers[i].pos.findInRange(FIND_SOURCES,1)
            if(nearby.length){
                available.push(rmContainers[i].id)
            }
        }

        if(available.length){
            memory.target = available[0]
        }

      return memory
    },

    availableExtensions(room){
        return ((room.controller.level - 1) * 5) - room.find(FIND_MY_STRUCTURES,{filter:(s) => s.structureType === STRUCTURE_EXTENSION}).length
    },

    //Unused, but useful...

    clearQue(room){
        console.log('Clearing Spawn Queue')
        room.memory.spawnQueue = []
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
