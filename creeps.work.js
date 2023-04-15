const util = require("./util");

module.exports =  {

    /*
    *   Work Actions
    */

    workerHarvest(creep,target){
        let result = creep.harvest(target)
        if (result === ERR_NOT_IN_RANGE) {
            util.moveToTarget(creep,{showPath: creep.room.memory.showPath, pathColor: '#ff8000'},target)
        }else if(result === ERR_INVALID_TARGET){
            creep.memory.target = null;
        }else if(result === ERR_INVALID_ARGS){
            console.log("workerHarvest: Invalid Arguments")
        }else if(result === ERR_NO_BODYPART){
            console.log("workerHarvest: Missing required BodyPart - "+creep.name)
        }
    },

    workerRepair(creep,target){
        let result = creep.repair(target)
        if (result === ERR_NOT_IN_RANGE) {
            util.moveToTarget(creep,{showPath: creep.room.memory.showPath, pathColor: '#00ff00'},target)
        }else if(result === ERR_INVALID_TARGET){
            creep.memory.target = null;
        }else if(result === ERR_INVALID_ARGS){
            console.log("workerRepair: Invalid Arguments")
        }else if(result === ERR_NO_BODYPART){
            console.log("workerRepair: Missing required BodyPart - ")
        }
    },

    workerBuild(creep, target){
        let result = creep.build(target);
        if(result === ERR_NOT_IN_RANGE) {
            util.moveToTarget(creep,{showPath: creep.room.memory.showPath, pathColor: '#0000ff'},target)
        }else if(result === ERR_INVALID_TARGET){
            creep.memory.target = null;
        }else if(result === ERR_INVALID_ARGS){
            console.log("workerBuild: Invalid Arguments")
        }else if(result === ERR_NO_BODYPART){
            console.log("workerBuild: Missing required BodyPart")
        }
    },

    workerWidthdraw(creep,target,resource = RESOURCE_ENERGY){
        let result = creep.withdraw(target,resource)
        if(result === ERR_NOT_IN_RANGE) {
            util.moveToTarget(creep,{showPath: creep.room.memory.showPath, pathColor: '#ff00ff'},target)
        }else if(result === ERR_INVALID_TARGET || result === ERR_NOT_ENOUGH_RESOURCES || target.store.getUsedCapacity(resource) === 0){
            creep.memory.targetCollect = null;
        }else if(result === ERR_INVALID_ARGS){
            console.log("workerWidthdraw: Invalid Arguments")
        }else if(result === ERR_NO_BODYPART){
            console.log("workerWidthdraw: Missing required BodyPart")
        }
    },

    workerTransfer(creep,target,resource = RESOURCE_ENERGY){
        let result = creep.transfer(target,resource)
        if(result === ERR_NOT_IN_RANGE) {
            util.moveToTarget(creep,{showPath: creep.room.memory.showPath, pathColor: '#fff000'},target)
        }else if(result === ERR_INVALID_TARGET || target.store.getFreeCapacity(resource) === 0){
            creep.memory.targetDeposit = null;
        }else if(result === ERR_INVALID_ARGS){
            console.log("workerTransfer: Invalid Arguments")
        }
    },

    workerPickup(creep,target,resource = RESOURCE_ENERGY){
        let result = creep.pickup(target,resource);
        if(result === ERR_NOT_IN_RANGE) {
            util.moveToTarget(creep,{showPath: creep.room.memory.showPath, pathColor: '#00ffff'},target)
        }else if(result === ERR_INVALID_TARGET || result === ERR_NOT_ENOUGH_RESOURCES){
            creep.memory.targetCollect = null;
        }else if(result === ERR_INVALID_ARGS){
            console.log("workerPickup: Invalid Arguments")
        }else if(result === ERR_NO_BODYPART){
            console.log("workerPickup: Missing required BodyPart")
        }
    },

    workerUpgrade(creep){
        if(creep.room.controller.level < 8) {
            if(creep.upgradeController(creep.room.controller) === ERR_NOT_IN_RANGE){
                util.moveToTarget(creep,{showPath: creep.room.memory.showPath, pathColor: '#ff0000'},creep.room.controller)
            }
        }
    },

    getBuildTarget(creep){
        let target = null
        if(Game.getObjectById(creep.memory.target) === null || !creep.memory.target){
            var cSites = creep.room.find(FIND_CONSTRUCTION_SITES);
            if(cSites.length){
                target = creep.pos.findClosestByRange(cSites,{algorithm: "astar"})
                if(target != null) {
                    creep.memory.target = target.id
                }
            }
        }else{
            target = Game.getObjectById(creep.memory.target);
        }
        return target
    },

    /*
    *   resource collection
    */

    getCollectTargetOld(creep,options = {sources:false,containers:false,storages:false,links:false,tombs:true,drops:true,findOptions:{}},resource = RESOURCE_ENERGY){
        let taken = util.getCreepPropsByRole(creep.room,creep.memory.role,'targetCollect');

        let storages = creep.room.find(FIND_STRUCTURES,{filter:(s) => { return s.structureType === STRUCTURE_STORAGE && s.store.getUsedCapacity(resource) >= 500 }});
        let containers = creep.room.find(FIND_STRUCTURES,{filter:(s) => { return s.structureType === STRUCTURE_CONTAINER && s.store.getUsedCapacity(resource) > 150 * taken.filter((currentItem) => currentItem === s.id).length }});
        let links = creep.room.find(FIND_STRUCTURES,{filter:(s) => { return s.structureType === STRUCTURE_LINK && s.id === creep.room.memory.targetLink && s.store.getUsedCapacity(resource) > 80 }});
        let tombs = creep.room.find(FIND_TOMBSTONES,{filter:(t) => t.store.getUsedCapacity(resource) > 0 && !taken.includes(t.id)})
        let drops = creep.room.find(FIND_DROPPED_RESOURCES,{filter:(d) => d.resourceType === resource && !taken.includes(d.id)})

        let target;
        if(storages.length > 0 && options.storages){
            target = creep.pos.findClosestByPath(storages,options.findOptions);
        }else if(drops.length > 0 && options.drops){
            target = creep.pos.findClosestByPath(drops);
        }else if(tombs.length > 0 && options.tombs){
            target = creep.pos.findClosestByPath(tombs);
        }else if(containers.length > 0 && options.containers){
            target = creep.pos.findClosestByPath(containers,options.findOptions);
        }else if(links.length > 0 && options.links){
            target = creep.pos.findClosestByPath(links,options.findOptions);
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

    getCollectTarget(creep,options = {sources:false,containers:false,storages:false,links:false,tombs:true,drops:true,findOptions:{}},resource = RESOURCE_ENERGY){
        let taken = util.getCreepProp(creep.room.find(FIND_MY_CREEPS),'targetCollect');
        let storages = creep.room.find(FIND_STRUCTURES,{filter:(s) => { return s.structureType === STRUCTURE_STORAGE && s.store.getUsedCapacity(resource) > (taken.filter((currentItem) => currentItem === s.id).length+1) * creep.store.getFreeCapacity(resource) }});
        let containers = creep.room.find(FIND_STRUCTURES,{filter:(s) => { return s.structureType === STRUCTURE_CONTAINER && s.store.getUsedCapacity(resource) > (taken.filter((currentItem) => currentItem === s.id).length+1) * creep.store.getFreeCapacity(resource) }});
        let links = creep.room.find(FIND_STRUCTURES,{filter:(s) => { return s.structureType === STRUCTURE_LINK && s.id === creep.room.memory.targetLink && s.store.getUsedCapacity(resource) > 80 }});
        let tombs = creep.room.find(FIND_TOMBSTONES,{filter:(t) => t.store.getUsedCapacity(resource) > 0 && !taken.includes(t.id)})
        let drops = creep.room.find(FIND_DROPPED_RESOURCES,{filter:(d) => d.resourceType === resource && !taken.includes(d.id)})

        let targets = [];
        if(storages.length > 0 && options.storages){
            targets.push(...storages);
        }
        if(drops.length > 0 && options.drops){
            targets.push(...drops);
        }
        if(tombs.length > 0 && options.tombs){
            targets.push(...tombs);
        }
        if(containers.length > 0 && options.containers){
            targets.push(...containers);
        }
        if(links.length > 0 && options.links){
            targets.push(...links);
        }
        if(!targets.length && options.sources) {
            var sources = creep.room.find(FIND_SOURCES)
            for(let i = 0; i < sources.length; i++){
                if(util.openSpacesNearPos(sources[i].pos,1,false) >= util.creepsNearPos(sources[i].pos)){
                    targets.push(sources[i]);
                }
            }
        }

        let target
        if(targets.length) {
            target = creep.pos.findClosestByPath(targets);
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
        let existingTarget = creep.memory.targetCollect == null ? null : Game.getObjectById(creep.memory.targetCollect)
        if(existingTarget != null){
            this.collectTargetResource(creep,existingTarget,resource)
            return true;
        }

        let newTarget = this.getCollectTarget(creep,options,resource)
        if(newTarget != null){
            creep.memory.targetCollect = newTarget.id
            this.collectTargetResource(creep,newTarget,resource)
            return true;
        }
        return false
    },

    /*
    *   Base maintenance functions
    */

    refillBaseEnergy(creep,options = {storages:false,containers:false,links:false}){
        return this.depositResources(creep,options)
    },

    getDepositTarget(creep, options = {terminal:false,storages:false,containers:false,links:false}, resource = RESOURCE_ENERGY){
        let targetList = []
        let target
        if(resource === RESOURCE_ENERGY) {
            target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                algorithm: "astar",
                filter: (s) => {
                    return (s.structureType === STRUCTURE_SPAWN ||
                            s.structureType === STRUCTURE_EXTENSION ||
                            s.structureType === STRUCTURE_TOWER) &&
                        s.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
                }
            });
            if (target != null) {
                creep.memory.targetDeposit = target.id
                this.workerTransfer(creep, target)
                return true
            }

            if(options.links) {
                target = creep.room.find(FIND_STRUCTURES, {
                    filter: (s) => {return s.id !== creep.room.memory.targetLink && s.structureType === STRUCTURE_LINK && s.store.getFreeCapacity(RESOURCE_ENERGY) > 0; }
                });
                if(target != null){ targetList = [...targetList,...target] }
            }
        }

        if(options.terminal) {
            target = creep.room.find(FIND_STRUCTURES, {
                filter: (s) => {return s.structureType === STRUCTURE_TERMINAL && s.store.getFreeCapacity(resource) > 0 && s.store.getUsedCapacity(resource) < 10000; }
            });
            if(target != null){ targetList = [...targetList,...target] }
        }
        if(options.storages) {
            target = creep.room.find(FIND_STRUCTURES, {
                filter: (s) => {return s.structureType === STRUCTURE_STORAGE && s.store.getFreeCapacity(resource) > 0; }
            });
            if(target != null){ targetList = [...targetList,...target] }
        }
        if(options.containers) {
            target = creep.room.find(FIND_STRUCTURES, {
                filter: (s) => {return s.structureType === STRUCTURE_CONTAINER && s.store.getFreeCapacity(resource) > 0; }
            });
            if(target != null){ targetList = [...targetList,...target] }
        }

        target = creep.pos.findClosestByPath(targetList,{algorithm: "astar"})

        return target
    },

    depositResources(creep, options = {terminal:false,storages:false,containers:false,links:false}, resource = RESOURCE_ENERGY){
        if(creep.memory.targetDeposit != null){
            let memoryTarget = Game.getObjectById(creep.memory.targetDeposit)
            if(memoryTarget != null){
                this.workerTransfer(creep,memoryTarget,resource)
                return true;
            }
        }

        let target = this.getDepositTarget(creep,options,resource)
        if(target != null){
            creep.memory.targetDeposit = target.id
            this.workerTransfer(creep,target,resource)
            return true;
        }
        creep.memory.targetDeposit = null
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
                target = creep.pos.findClosestByRange(FIND_STRUCTURES,{
                    algorithm: "astar",
                    filter: (s) =>
                        !takenTargets.includes(s.id)
                        && s.hits < s.hitsMax
                        && (s.structureType !== STRUCTURE_WALL && s.structureType !== STRUCTURE_RAMPART)
                });
            }else{
                target = creep.pos.findClosestByRange(FIND_STRUCTURES,{
                    algorithm: "astar",
                    filter: (s) =>
                        s.hits < s.hitsMax
                        && (s.structureType !== STRUCTURE_WALL && s.structureType !== STRUCTURE_RAMPART)
                });
            }
            creep.memory.target = target == null ? null : target.id
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
