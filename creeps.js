const util = require("./util");

module.exports =  {


    run(creep){
        //runOrder
        this.runRole(creep);
    },

    // runOrders(creep){
    //     if(creep.memory.orders.length === 0){
    //         return false;
    //     }
    //
    //     let order = creep.memory.orders.shift();
    //
    // },

    /*
    *   ROLES
    */

    runRole(creep){
        switch(creep.memory.role){
            case 'scout': this.runScout(creep); break;
            case 'harvester': this.runHarvester(creep); break;
            case 'r-harvester': this.runRHarvester(creep); break;
            case 'builder': this.runBuilder(creep); break;
            case 'maintenance': this.runMaintenance(creep); break;
            case 'd-maintenance': this.runDMaintenance(creep); break;
            case 'e-maintenance': this.runEMaintenance(creep); break;
            case 'c-miner': this.runCMiner(creep); break;

            case 'healer': this.runHealer(creep); break;
            case 'attack': this.runAttack(creep); break;
            case 'defend': this.runDefend(creep); break;
            case 'claimer': this.runClaimer(creep); break;
        }
    },

    runScout(creep){
        if(creep.memory.working){
            if(this.moveToRoom(creep)){
                creep.memory.working = false;
            }
        }else{
            if(this.inTargetRoom(creep)){
                let target = this.getCollectTarget(creep,{sources:true})
                if(target != null) {
                    creep.moveTo(target)
                }
            }
        }
    },

    runHarvester(creep){
        if(creep.memory.working && creep.store.getFreeCapacity() === 0) {
            creep.memory.working = false;
            creep.say('🚚 Deliver');
        }
        if(!creep.memory.working && creep.store[RESOURCE_ENERGY] === 0) {
            creep.memory.working = true;
            creep.say('🔄 Harvest');
        }

        if(creep.memory.working){
            this.collectResource(creep,{sources:true,drops:true,tombs:true})
        }else{
            if(!this.refillBaseEnergy(creep,{storages: false, containers: true})){
                this.workerUpgrade(creep)
            }
        }
    },

    runRHarvester(creep){
        if(creep.memory.working && creep.store.getFreeCapacity() === 0) {
            creep.memory.working = false;
            creep.memory.target = null;
            creep.say('🚚 Deliver');
        }
        if(!creep.memory.working && creep.store[RESOURCE_ENERGY] === 0) {
            creep.memory.working = true;
            creep.say('🔄 Harvest');
        }

        if(creep.memory.working){
            if(this.moveToRoom(creep)){
                this.collectResource(creep,{sources: true, drops: true, tombs: true})
            }
        }else{
            if(this.moveToHome(creep)){
                if(!this.refillBaseEnergy(creep,{links: true, storages: true, containers: true})){
                    this.workerUpgrade(creep)
                }
            }
        }
    },

    runMaintenance(creep){
        if(creep.memory.working && creep.store[RESOURCE_ENERGY] === 0) {
            creep.memory.working = false;
            creep.memory.target = null;
            creep.say('⚡ Recharge');
        }
        if(!creep.memory.working && creep.store.getFreeCapacity() === 0) {
            creep.memory.working = true;
            creep.memory.targetEnergy = null;
            creep.say('🔧 Repair');
        }

        if(creep.memory.working){
            if(!this.refillBaseEnergy(creep,{storages: false, containers: false})){
                if(!this.maintainBaseStructures(creep)){
                    let targetObj = creep.pos.findClosestByPath(FIND_STRUCTURES,{
                        algorithm: "astar",
                        filter: (s) =>
                            (s.structureType === STRUCTURE_RAMPART && s.hits < 100000) || (s.structureType === STRUCTURE_WALL && s.hits < 100000)
                    });
                    if(targetObj != null) {
                        creep.memory.target = targetObj.id;
                        if (creep.repair(targetObj) === ERR_NOT_IN_RANGE) {
                            creep.moveTo(targetObj, {visualizePathStyle: {stroke: '#ffaa00'}, reusePath: 4});
                        }
                    }else{
                        this.workerUpgrade(creep)
                    }
                }
            }
        }else{
            this.collectResource(creep,{drops: false, tombs: true, sources: true, containers: true, storages: true, findOptions: { filter: (s) => { return s.store.getUsedCapacity() > 500; }}})
        }

    },

    // runMMaintenance(creep){
    //     if(!creep.memory.working && creep.store[creep.memory.mineral] === 0) {
    //         creep.memory.working = false;
    //         creep.memory.target = null;
    //         creep.say('⚡ Recharge');
    //     }
    //     if(creep.memory.working && creep.store.getFreeCapacity(creep.memory.mineral) === 0) {
    //         creep.memory.working = true;
    //         creep.say('🚚 Deliver');
    //     }
    //
    //     if(creep.memory.working){
    //         let targets = creep.room.find(FIND_STRUCTURES, {filter: (s) => s.structureType ===  STRUCTURE_CONTIANER && s.store.getUsedCapacity(creep.memory.mineral) > 0})
    //     }else{
    //
    //     }
    // },

    runEMaintenance(creep){
        if(creep.memory.working && creep.store[RESOURCE_ENERGY] === 0) {
            creep.memory.working = false;
            creep.memory.target = null;
            creep.say('⚡ Recharge');
        }
        if(!creep.memory.working && creep.store.getFreeCapacity() === 0) {
            creep.memory.working = true;
            creep.memory.targetEnergy = null;
            creep.say('🚚 Deliver');
        }

        if(creep.memory.working){
            if(!this.refillBaseEnergy(creep,{storages: false, containers: false})){
                this.refillBaseEnergy(creep,{storages: true, containers: false})
            }
        }else{
            let targets = creep.room.find(FIND_STRUCTURES, {
                algorithm: "astar",
                filter: (s) => {
                    return (s.structureType === STRUCTURE_SPAWN ||
                            s.structureType === STRUCTURE_EXTENSION||
                            s.structureType === STRUCTURE_TOWER) &&
                        s.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
                }
            });

            let res = this.collectResource(
                creep,
                {
                    drops: true,
                    tombs: true,
                    links: true,
                    sources: false,
                    containers: (creep.room.controller.level <= 5),
                    storages: (targets.length > 0),
                    findOptions: {
                        filter: (s) => {
                             if(s.structureType === STRUCTURE_CONTAINER){
                                 return s.store.getUsedCapacity() > 1000
                             }
                             return true
                        }
                    }
                }
            )
            if(!res){
                //return to spawn area if not nearby
            }
        }

    },

    runDMaintenance(creep){
        if(creep.memory.working && creep.store[RESOURCE_ENERGY] === 0) {
            creep.memory.working = false;
            creep.memory.target = null;
            creep.say('⚡ Recharge');
        }
        if(!creep.memory.working && creep.store.getFreeCapacity() === 0) {
            creep.memory.working = true;
            creep.memory.targetEnergy = null;
            creep.say('🔧 repair');
        }

        if(creep.memory.working){
            if(!this.maintainBaseDefenses(creep)){
                if(!this.refillBaseEnergy(creep,{storages: false, containers: false})){
                    this.workerUpgrade(creep)
                }
            }
        }else{
            this.collectResource(
                creep,
                {
                    drops: false,
                    tombs: true,
                    storages: false,
                    containers: true,
                    findOptions: {}
                }
            )
        }
    },

    runBuilder(creep){
        if(creep.memory.working && creep.store[RESOURCE_ENERGY] === 0) {
            creep.memory.working = false;
            creep.say('⚡ Recharge');
        }
        if(!creep.memory.working && creep.store.getFreeCapacity() === 0) {
            creep.memory.working = true;
            creep.memory.targetEnergy = null;
            creep.say('🔨 build');
        }

        if(creep.memory.working) {
            let target = this.getBuildTarget(creep)
            if(target) {
                this.workerBuild(creep,target)
            }else{
                this.workerUpgrade(creep)
            }
        }
        else{
            let containers = creep.room.find(FIND_STRUCTURES,{filter: (s) => s.structureType === STRUCTURE_CONTAINER && s.store.getUsedCapacity(RESOURCE_ENERGY) > 100})
            this.collectResource(
                creep,{
                    containers:true,
                    storages:true,
                    sources:(!containers.length),
                    options:{
                        algorithm: "astar",
                        filter:(s) => {
                            if(s.structureType === STRUCTURE_CONTAINER) {
                                return s.store.getUsedCapacity(RESOURCE_ENERGY) > 100;
                            }
                            if(s.structureType === STRUCTURE_STORAGE) {
                                return s.store.getUsedCapacity(RESOURCE_ENERGY) > 10000;
                            }
                            return true
                        }
                    }
                }
            );
        }
    },

    runCMiner(creep){
        if(creep.memory.working && creep.store.getFreeCapacity() === 0) {
            creep.memory.working = false;
            //creep.say('🚚 Deliver');
        }
        if(!creep.memory.working && creep.store[RESOURCE_ENERGY] === 0) {
            creep.memory.working = true;
            //creep.say('🔦 Mining');
        }

        if(!creep.memory.target){
            var targetObj = creep.pos.findClosestByPath(FIND_STRUCTURES,{filter:(s) => { return s.structureType === STRUCTURE_CONTAINER && s.store.getFreeCapacity(RESOURCE_ENERGY) > 0 },algorithm: "astar"});
            creep.memory.target = targetObj.id;
        }else{
            targetObj = Game.getObjectById(creep.memory.target);
        }

        if(creep.memory.working && targetObj != null){
            if(!creep.pos.isEqualTo(targetObj.pos)) {
                creep.moveTo(targetObj, {visualizePathStyle: {stroke: '#ffffff'},reusePath:4});
            }else{
                var source = creep.pos.findClosestByRange(FIND_SOURCES,{algorithm: "astar"});
                if(source && creep.pos.inRangeTo(source,1)) {
                    if (creep.harvest(source) === ERR_NOT_IN_RANGE) {
                        console.log('C-Miner ' + creep.name + ': Source Out of Range!!!')
                    }
                }else{
                    var mine = creep.pos.findClosestByRange(FIND_MINERALS,{algorithm: "astar"});
                    if (creep.harvest(mine) === ERR_NOT_IN_RANGE) {
                        console.log('C-Miner ' + creep.name + ': Source Out of Range!!!')
                    }
                }
            }
        }else{
            let res = creep.transfer(targetObj, RESOURCE_ENERGY)
            if(res === ERR_NOT_IN_RANGE) {
                creep.moveTo(targetObj, {visualizePathStyle: {stroke: '#ffffff'},reusePath:4});
                console.log('C-Miner '+ creep.name+': Container Out of Range!!!')
            }
            if(res === ERR_FULL){
                let link = creep.pos.findClosestByRange(FIND_STRUCTURES,{filter:(s) => { return s.structureType === STRUCTURE_LINK }});
                if(link && creep.pos.inRangeTo(link.pos,1)){
                    creep.transfer(link, RESOURCE_ENERGY)
                }
            }
            let resources = creep.room.find(FIND_DROPPED_RESOURCES,{filter:(r) => r.pos.isNearTo(creep) })
            if(resources.length > 0){
                creep.pickup(resources[0])
            }
        }
    },

    runClaimer(creep){
        if(creep.room.name !== creep.memory.targetRoom) {
            creep.moveTo(creep.pos.findClosestByRange(creep.room.findExitTo(creep.memory.targetRoom)), {
                visualizePathStyle: {stroke: '#ffaa00'},
                reusePath: 4
            });
        }else{
            let controller = creep.room.find(FIND_STRUCTURES,{filter:(s) => s.structureType === STRUCTURE_CONTROLLER})
            let res = creep.claimController(controller[0])
            if(res === ERR_NOT_IN_RANGE){
                creep.moveTo(controller[0], {visualizePathStyle: {stroke: '#ffffff'},reusePath:4});
            }
            if(res === ERR_INVALID_TARGET){
                if(creep.attackController(controller[0]) === ERR_TIRED){
                    //console.log("wait")
                }
            }

        }
    },

    runHealer(creep){
        if(creep.memory.fighting && creep.memory.target === null) {
            creep.memory.fighting = false;
            creep.say('🚚 Defend');
        }
        if(!creep.memory.fighting && creep.memory.target !== null) {
            creep.memory.fighting = true;
            creep.say('🔦 Attack');
        }

        if(creep.memory.fighting) {
            let targetObj = Game.creeps[creep.memory.target];
            if (targetObj != null){
                if(creep.room.name !== targetObj.room.name){
                    creep.moveTo(creep.pos.findClosestByRange(creep.room.findExitTo(targetObj.room.name)), {visualizePathStyle: {stroke: '#ffaa00'},reusePath: 4});
                }else if (!creep.pos.inRangeTo(targetObj,1)) {
                    creep.moveTo(targetObj, {visualizePathStyle: {stroke: '#ffffff'}, reusePath: 4});
                }else if(targetObj.hits < targetObj.hitsMax){
                    creep.heal(targetObj)
                }
            }else{
                //no target
            }
        }else{
            //not fighting
        }
    },

    runDefend(creep){
        if(creep.memory.fighting && creep.memory.target === null) {
            creep.memory.fighting = false;
            creep.say('🚚 Defend');
        }
        if(!creep.memory.fighting && creep.memory.target !== null) {
            creep.memory.fighting = true;
            creep.say('🔦 Attack');
        }

        if(creep.memory.fighting) {
            let targetObj = Game.getObjectById(creep.memory.target);

            if (targetObj != null){
                if (creep.attack(targetObj) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(targetObj, {visualizePathStyle: {stroke: '#ffffff'}, reusePath: 4});
                }
            }else{
                creep.memory.target = null
            }
        }else{
            let target = creep.pos.findClosestByRange(FIND_HOSTILE_CREEPS);
            if(target != null){
                this.memory.target = target.id;
            }else{
                //fallback behavior
                //patrol
                let targets = creep.room.find(FIND_STRUCTURES,{filter: (s) => s.structureType === STRUCTURE_CONTAINER || s.structureType === STRUCTURE_SPAWN})
                if(targets.length > 0){

                }
            }
        }

    },

    runAttack(creep){
        if(creep.memory.fighting && creep.memory.target === null) {
            creep.memory.fighting = false;
            creep.say('🚚 Defend');
        }
        if(!creep.memory.fighting && creep.memory.target !== null) {
            creep.memory.fighting = true;
            creep.say('🔦 Attack');
        }

        if(creep.memory.fighting){
            if(creep.memory.targetRoom != null && creep.room.name !== creep.memory.targetRoom) {
                creep.moveTo(creep.pos.findClosestByRange(creep.room.findExitTo(creep.memory.targetRoom)), {
                    visualizePathStyle: {stroke: '#ffaa00'},
                    reusePath: 4
                });
            }else{
                let targetObj = Game.getObjectById(creep.memory.target);
                if (targetObj != null){
                    if (creep.attack(targetObj) === ERR_NOT_IN_RANGE) {
                        creep.moveTo(targetObj, {visualizePathStyle: {stroke: '#ffffff'}, reusePath: 4});
                    }
                }else{
                    creep.memory.target = null
                }
            }
        }else{
            if(creep.memory.targetRoom != null && creep.room.name !== creep.memory.targetRoom) {
                creep.moveTo(creep.pos.findClosestByRange(creep.room.findExitTo(creep.memory.targetRoom)), {
                    visualizePathStyle: {stroke: '#ffaa00'},
                    reusePath: 4
                });
            }else{
                var takenTargets = util.getCreepPropsByRole(creep.room,'attack','target');
                let t = creep.pos.findClosestByPath(FIND_HOSTILE_STRUCTURES,{filter: (s) => (takenTargets.length && !takenTargets.includes(s.id)) && s.structureType === STRUCTURE_TOWER})
                if(t != null){
                    creep.memory.target = t.id;
                }else{
                    let c = creep.pos.findClosestByPath(FIND_HOSTILE_CREEPS, {filter: (c) => (takenTargets.length && !takenTargets.includes(c.id)) && c.body.map(i => i.type).includes("ATTACK")});
                    if (c != null) {
                        creep.memory.target = c.id;
                    }else {
                        let ac = creep.pos.findClosestByPath(FIND_HOSTILE_CREEPS, {filter: (c) => (takenTargets.length && !takenTargets.includes(c.id)) });
                        if (ac != null) {
                            creep.memory.target = ac.id;
                        }else {
                            let s = creep.pos.findClosestByPath(FIND_HOSTILE_STRUCTURES, {filter: (s) => s.structureType !== STRUCTURE_CONTROLLER})
                            if (s != null) {
                                creep.memory.target = s.id;
                            }else{
                                let rc = creep.pos.findClosestByPath(FIND_STRUCTURES, {filter: (s) => s.structureType === STRUCTURE_CONTROLLER})
                                if (rc != null) {
                                    creep.moveTo(rc,{visualizePathStyle: {stroke: '#ffffff'}, reusePath: 4})
                                }
                            }
                        }
                    }
                }
            }
        }
    },

    /*
    *   Work Actions
    */

    workerHarvest(creep,target){
        let result = creep.harvest(target)
        if (result === ERR_NOT_IN_RANGE) {
            creep.moveTo(target, {visualizePathStyle: {stroke: '#523417'}, reusePath: 4});
        }else if(result === ERR_INVALID_TARGET){
            creep.memory.target = null;
        }else if(result === ERR_INVALID_ARGS){
            console.log("workerHarvest: Invalid Arguments")
        }
    },

    workerWidthdraw(creep,target,resource = RESOURCE_ENERGY){
        let result = creep.withdraw(target,resource)
        if(result === ERR_NOT_IN_RANGE) {
            creep.moveTo(target, {visualizePathStyle: {stroke: '#8a008f'},reusePath:4});
        }else if(result === ERR_INVALID_TARGET || result === ERR_NOT_ENOUGH_RESOURCES || target.store.getUsedCapacity(resource) === 0){
            creep.memory.targetEnergy = null;
        }else if(result === ERR_INVALID_ARGS){
            console.log("workerWidthdraw: Invalid Arguments")
        }
    },

    workerPickup(creep,target,resource = RESOURCE_ENERGY){
        let result = creep.pickup(target,resource);
        if(result === ERR_NOT_IN_RANGE) {
            creep.moveTo(target, {visualizePathStyle: {stroke: '#2fbd47'},reusePath:4});
        }else if(result === ERR_INVALID_TARGET || result === ERR_NOT_ENOUGH_RESOURCES || target.store.getUsedCapacity(resource) === 0){
            creep.memory.targetEnergy = null;
        }else if(result === ERR_INVALID_ARGS){
            console.log("workerPickup: Invalid Arguments")
        }
    },

    workerRepair(creep,target){
        let result = creep.repair(target)
        if (result === ERR_NOT_IN_RANGE) {
            creep.moveTo(target, {visualizePathStyle: {stroke: '#3a85e0'}, reusePath: 4});
        }else if(result === ERR_INVALID_TARGET){
            creep.memory.target = null;
        }else if(result === ERR_INVALID_ARGS){
            console.log("workerRepair: Invalid Arguments")
        }
    },

    workerBuild(creep, target){
        let result = creep.build(target);
        if(result === ERR_NOT_IN_RANGE) {
            creep.moveTo(target, {visualizePathStyle: {stroke: '#c49e16'}, reusePath:4});
        }else if(result === ERR_INVALID_TARGET){
            creep.memory.target = null;
        }else if(result === ERR_INVALID_ARGS){
            console.log("workerBuild: Invalid Arguments")
        }
    },

    workerUpgrade(creep){
        if(creep.room.controller.level < 8) {
            if(creep.upgradeController(creep.room.controller) === ERR_NOT_IN_RANGE){
                creep.moveTo(creep.room.controller, {visualizePathStyle: {stroke: '#b03d0c'}, reusePath:4});
            }
        }
    },

    getBuildTarget(creep){
        let target = null
        if(Game.getObjectById(creep.memory.target) === null || !creep.memory.target){
            var cSites = creep.room.find(FIND_CONSTRUCTION_SITES);
            if(cSites.length){
                target = creep.pos.findClosestByPath(cSites,{algorithm: "astar"});
                creep.memory.target = target.id;
            }
        }else{
            target = Game.getObjectById(creep.memory.target);
        }
        return target
    },

    /*
    *   Room Nav
    */

    inTargetRoom(creep,room = creep.memory.targetRoom){
        return creep.room.name === room
    },

    inHomeRoom(creep){
        return creep.room.name === creep.memory.room
    },

    moveToHome(creep){
        return this.moveToRoom(creep,creep.memory.room)
    },

    moveToRoom(creep,room = creep.memory.targetRoom){
        if(!this.inTargetRoom(creep,room)) {
            creep.moveTo(creep.pos.findClosestByPath(creep.room.findExitTo(room)), {
                visualizePathStyle: {stroke: '#150b52'},
                reusePath: 4
            });
            //console.log('moveToRoom: Moving to Room '+creep.memory.targetRoom)
            return false;
        }else{
            if(creep.pos.x*creep.pos.y === 0 || creep.pos.x === 49 || creep.pos.y === 49){
                creep.moveTo(new RoomPosition(25,25,creep.memory.targetRoom))
            }
            //console.log('moveToRoom: Found Room '+creep.memory.targetRoom)
            return true;
        }
    },

    /*
    *   resource collection
    */

    getCollectTarget(creep,options = {sources:false,containers:false,storages:false,links:false,tombs:true,drops:true,findOptions:{}},resource = RESOURCE_ENERGY){
        let taken = util.getCreepPropsByRole(creep.room,creep.memory.role,'targetEnergy');

        let storages = creep.room.find(FIND_STRUCTURES,{filter:(s) => { return s.structureType === STRUCTURE_STORAGE && s.store.getUsedCapacity(resource) >= creep.store.getFreeCapacity()*4 }});
        let containers = creep.room.find(FIND_STRUCTURES,{filter:(s) => { return s.structureType === STRUCTURE_CONTAINER && s.store.getUsedCapacity(resource) > creep.store.getFreeCapacity()*2 }});
        let links = creep.room.find(FIND_STRUCTURES,{filter:(s) => { return s.structureType === STRUCTURE_LINK && s.id === creep.room.memory.targetLink && s.store.getUsedCapacity(resource) > 80 }});
        let tombs = creep.room.find(FIND_TOMBSTONES,{filter:(t) => t.store.getUsedCapacity(resource) > 0 && !taken.includes(t.id)})
        let drops = creep.room.find(FIND_DROPPED_RESOURCES,{filter:(d) => d.resourceType === resource && !taken.includes(d.id)})

        let target;
        if(links.length > 0 && options.links){
            target = creep.pos.findClosestByPath(links,options.findOptions);
        }else if(storages.length > 0 && options.storages){
            target = creep.pos.findClosestByPath(storages,options.findOptions);
        }else if(drops.length > 0 && options.drops){
            target = creep.pos.findClosestByPath(drops);
        }else if(tombs.length > 0 && options.tombs){
            target = creep.pos.findClosestByPath(tombs);
        }else if(containers.length > 0 && options.containers){
            target = creep.pos.findClosestByPath(containers,options.findOptions);
        }else if(options.sources) {
            var available = []
            var sources = creep.room.find(FIND_SOURCES)
            for(let i = 0; i < sources.length; i++){
                if(util.openSpacesNearPos(sources[i].pos,1,false) >= util.creepsNearPos(sources[i].pos)){
                    available.push(sources[i]);
                }
            }
            if(available.length) {
                target = creep.pos.findClosestByPath(available);
            }
        }else{
            return null;
        }
        return target;
    },

    collectTargetResource(creep,target,resource = RESOURCE_ENERGY){
        if(target instanceof Structure || target instanceof Tombstone){
            this.workerWidthdraw(creep,target,resource)
        }else if(target instanceof Resource){
            this.workerPickup(creep,target,resource)
        }else if(target instanceof Source){
            this.workerHarvest(creep,target)
        }
    },

    collectResource(creep, options = {sources:false,containers:false,storages:false,links:false,tombs:true,drops:true,findOptions:{}}, resource = RESOURCE_ENERGY){
        let existingTarget = creep.memory.targetEnergy == null ? null : Game.getObjectById(creep.memory.targetEnergy)
        if(existingTarget != null){
            this.collectTargetResource(creep,existingTarget,resource)
            return true;
        }

        let newTarget = this.getCollectTarget(creep,options,resource)
        if(newTarget != null){
            this.collectTargetResource(creep,newTarget,resource)
            return true;
        }
        return false
    },

    /*
    *   Base maintenance functions
    */

    refillBaseEnergy(creep,options = {storages:false,containers:false,links:false}){
        var target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
            algorithm: "astar",
            filter: (s) => {
                return (s.structureType === STRUCTURE_SPAWN ||
                        s.structureType === STRUCTURE_EXTENSION||
                        s.structureType === STRUCTURE_TOWER) &&
                    s.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
            }
        });
        if(target == null && options.links) {
            target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                algorithm: "astar",
                filter: (s) => {
                    return s.structureType === STRUCTURE_LINK && s.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
                }
            });
        }
        if(target == null && options.containers) {
            target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                algorithm: "astar",
                filter: (s) => {
                    return s.structureType === STRUCTURE_CONTAINER && s.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
                }
            });
        }
        if(target == null && options.storages) {
            target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                algorithm: "astar",
                filter: (s) => {
                    return s.structureType === STRUCTURE_STORAGE && s.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
                }
            });
        }

        if(target != null){
            if(creep.transfer(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                creep.moveTo(target, {visualizePathStyle: {stroke: '#ffffff'}, reusePath:2});
            }
            return true;
        }
        return false;
    },

    maintainBaseStructures(creep){
        let target = null;
        if(creep.memory.target != null){
            target = Game.getObjectById(creep.memory.target);
            if(!target || target.hits === target.hitsMax){
                creep.memory.target =  null;
                target = null;
            }
        }
        if(creep.memory.target == null){
            var takenTargets = util.getCreepPropsByRole(creep.room,creep.memory.role,'target');
            if(takenTargets.length){
                target = creep.pos.findClosestByPath(FIND_STRUCTURES,{
                    algorithm: "astar",
                    filter: (s) =>
                        (!takenTargets.includes(s.id))
                        && s.hits < s.hitsMax
                        && (s.structureType !== STRUCTURE_WALL && s.structureType !== STRUCTURE_RAMPART)
                });
            }else{
                target = creep.pos.findClosestByPath(FIND_STRUCTURES,{
                    algorithm: "astar",
                    filter: (s) =>
                        s.hits < s.hitsMax
                        && (s.structureType !== STRUCTURE_WALL && s.structureType !== STRUCTURE_RAMPART)
                });
            }
        }
        if(target != null) {
            this.workerRepair(creep,target)
            return true;
        }
        return false;
    },

    maintainBaseDefenses(creep){
        let target = null;
        if(creep.memory.target !== null){
            target = Game.getObjectById(creep.memory.target);
            if(!target || target.hits === target.hitsMax){
                creep.memory.target =  null;
                target = null;
            }
        }
        if(creep.memory.target == null){
            let takenTargets = util.getCreepPropsByRole(creep.room,'d-maintenance','target');
            target = creep.pos.findClosestByPath(FIND_STRUCTURES,{
                algorithm: "astar",
                filter: (s) =>
                    (takenTargets.length && !takenTargets.includes(s.id))
                    && s.hits < s.hitsMax
                    && s.structureType === STRUCTURE_RAMPART
            });
            if(!target){
                target = creep.pos.findClosestByPath(FIND_STRUCTURES,{
                    algorithm: "astar",
                    filter: (s) =>
                        s.hits < s.hitsMax * 0.25
                        && s.structureType === STRUCTURE_WALL
                });
            }
            if(!target){
                target = creep.pos.findClosestByPath(FIND_STRUCTURES,{
                    algorithm: "astar",
                    filter: (s) =>
                        s.hits < s.hitsMax * 0.50
                        && s.structureType === STRUCTURE_WALL
                });
            }
            if(!target){
                target = creep.pos.findClosestByPath(FIND_STRUCTURES,{
                    algorithm: "astar",
                    filter: (s) =>
                        s.hits < s.hitsMax * 0.75
                        && s.structureType === STRUCTURE_WALL
                });
            }
            if(!target){
                target = creep.pos.findClosestByPath(FIND_STRUCTURES,{
                    algorithm: "astar",
                    filter: (s) =>
                        s.hits < s.hitsMax
                        && s.structureType === STRUCTURE_WALL
                });
            }
        }

        if(target != null) {
            this.workerRepair(creep,target)
            return true;
        }
        return false;
    }
}
