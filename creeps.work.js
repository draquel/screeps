/* eslint-disable no-undef */
const util = require("./util");

module.exports =  {

    /*
    *   Work Actions
    */

    workerHarvest(creep,target){
        let result = creep.harvest(target)
        if (result === ERR_NOT_IN_RANGE) {
            util.moveToTarget(creep,{showPath: creep.room.memory.showPath, pathColor: '#ff8000'},target)
            return
        }else if(result === ERR_INVALID_TARGET){
            creep.memory.targetCollect = null;
//            console.log("workerHarvest: "+creep.name+" - Invalid Target")
            return
        }else if(result === ERR_BUSY){
          return
        }else if(result === ERR_INVALID_ARGS){
            console.log("workerHarvest: "+creep.name+" - Invalid Arguments")
            return
        }else if(result === ERR_NO_BODYPART){
            console.log("workerHarvest: Missing required BodyPart - "+creep.name)
            return
        }else if(result === ERR_NOT_ENOUGH_RESOURCES) {
            return
        }else if(result === ERR_TIRED){
            return
        }else if( result != 0){
          console.log("workerHarvest: "+creep.name+" Unknown Error - "+result)
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

    workerBuild(creep,target){
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
        return result
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
        if((Game.getObjectById(creep.memory.target) === null || !creep.memory.target) && creep.store.getUsedCapacity() > (creep.store.getCapacity() * 0.1)){
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

    getCollectTarget(creep,options = {sources:false,containers:false,storages:false,links:false,labs:false,tombs:true,deposits:false,drops:true,findOptions:{}},resource = RESOURCE_ENERGY){
        let taken = util.getCreepProp(creep.room.find(FIND_MY_CREEPS),'targetCollect');
        let targets = [];
        
        if(options.drops){
            let drops = creep.room.find(FIND_DROPPED_RESOURCES,{filter:(d) => d.resourceType === resource && !taken.includes(d.id)})
            if(drops.length > 0) { return creep.pos.findClosestByPath(drops); }
            targets.push(...drops);
        }
        if(options.tombs){
            let tombs = creep.room.find(FIND_TOMBSTONES,{filter:(t) => t.store.getUsedCapacity(resource) > 0 && !taken.includes(t.id)})
            if(tombs.length > 0) { return creep.pos.findClosestByPath(tombs); }
            targets.push(...tombs);
        }
        if(options.ruins){
          let ruins = creep.room.find(FIND_RUINS,{filter:(r) => r.store.getUsedCapacity(resource) > 0})
          targets.push(...ruins);
        }
        if(options.containers){
            let containers = creep.room.find(FIND_STRUCTURES,{filter:(s) => { return s.structureType === STRUCTURE_CONTAINER && s.store.getUsedCapacity(resource) > (taken.filter((currentItem) => currentItem === s.id).length+1) * creep.store.getFreeCapacity(resource) }})
            targets.push(...containers);
        }
        if(options.storages){
            let storages = []
            if(creep.room.storage !== undefined){
                if(creep.room.storage.store.getUsedCapacity(resource) > (taken.filter((currentItem) => currentItem === creep.room.storage.id).length+1) * creep.store.getFreeCapacity(resource)){
                    storages.push(creep.room.storage)
                }
            }
            targets.push(...storages);
        }
        if(options.links){
            let links = creep.room.find(FIND_STRUCTURES,{filter:(s) => { return s.structureType === STRUCTURE_LINK && s.id === creep.room.memory.targetLink && s.store.getUsedCapacity(resource) > 80 }})
            targets.push(...links);
        }
        if(options.labs){
            let labs = creep.room.find(FIND_STRUCTURES,{filter:(s) => { return s.structureType === STRUCTURE_LAB && s.store.getUsedCapacity(resource) > 0 }})
            targets.push(...labs);
        }

        if(options.deposits){
            let deposits = creep.room.find(FIND_DEPOSITS,{filter:d => d.depositType === resource })
            targets.push(...deposits);
        }
        if(!targets.length && options.sources && resource === RESOURCE_ENERGY) {
            var sources = creep.room.sources
            for(let i = 0; i < sources.length; i++){
                if(sources[i].energyCapacity === 0){
                    continue
                }
                let takenCount = 0
                for(let j = 0; j < taken.length; j++){
                    if(taken[j] === sources[i].id){
                        takenCount++
                    }
                }
                if(sources[i].openSpaces > takenCount){
                    targets.push(sources[i]);
                }
            }
        }

        let target
        if(targets.length) {
          target = creep.pos.findClosestByPath(targets);
        }
        //console.log(creep.name+" resource target found: "+target)
        return target;
    },

    collectTargetResource(creep,target,resource = RESOURCE_ENERGY){
        if((target instanceof Source && target.energy > 0) || (target instanceof Deposit && target.depositType === creep.memory.targetResource)){
          this.workerHarvest(creep,target)
          return true;
        }
        if((target instanceof Structure || target instanceof Tombstone || target instanceof Ruin) && target.store.getUsedCapacity(resource) > 0){
          this.workerWidthdraw(creep,target,resource)
          return true;
        }
        if(target instanceof Resource && target.amount > 1){
          this.workerPickup(creep,target,resource)
          return true;
        }

        return false;
    },

    collectResource(creep, options = {sources:false,containers:false,storages:false,links:false,tombs:true,drops:true,ruins:true,deposits:false,findOptions:{}}, resource = RESOURCE_ENERGY){
        let existingTarget = creep.memory.targetCollect == null ? null : Game.getObjectById(creep.memory.targetCollect)
        if(existingTarget != null){
          if(this.collectTargetResource(creep,existingTarget,resource)){
            return true
          }
        }

        let newTarget = this.getCollectTarget(creep,options,resource)
        if(newTarget != null){
            creep.memory.targetCollect = newTarget.id
            this.collectTargetResource(creep,newTarget,resource)
            return true;
        }
        creep.memory.targetCollect = null
        return false
    },

    /*
    *   Base maintenance functions
    */

    refillBaseEnergy(creep,options = {terminal:false,storages:false,containers:false,links:false}){
        return this.depositResources(creep,options)
    },

    getDepositTarget(creep, options = {factory:false,terminal:false,storages:false,containers:false,links:false,labs:false}, resource = RESOURCE_ENERGY){
        let targetList = []
        let target
        if(resource === RESOURCE_ENERGY) {
            let taken = util.getCreepProp(creep.room.find(FIND_MY_CREEPS),'targetDeposit');
            target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                algorithm: "astar",
                filter: (s) => {
                    return (s.structureType === STRUCTURE_SPAWN || (s.structureType === STRUCTURE_EXTENSION && !taken.includes(s.id))) && s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
                }
            });
            if (target == null) {
                target = creep.pos.findClosestByPath(FIND_STRUCTURES,{filter: (s) => { return s.structureType === STRUCTURE_TOWER && s.store.getFreeCapacity(RESOURCE_ENERGY) > s.store.getCapacity(RESOURCE_ENERGY) * 0.25 }})
            }

            if (target == null) {
                target = creep.pos.findClosestByPath(FIND_STRUCTURES,{filter: (s) => { return s.structureType === STRUCTURE_LAB && s.store.getFreeCapacity(RESOURCE_ENERGY) > 0 }})
            }

            if (target != null) {
                creep.memory.targetDeposit = target.id
                this.workerTransfer(creep, target)
                return true
            }

            if(options.links) {
                target = creep.room.find(FIND_STRUCTURES, {filter: (s) => { return s.id !== creep.room.memory.targetLink && s.structureType === STRUCTURE_LINK && s.store.getFreeCapacity(RESOURCE_ENERGY) > 0; } });
                if(target != null){ targetList.push(...target) }
            }
        }

        if(options.terminal) {
            target = []
            if(creep.room.terminal !== undefined){
                if(creep.room.terminal.store.getFreeCapacity(resource) > 0 && creep.room.terminal.store.getUsedCapacity(resource) < 10000){
                    target.push(creep.room.terminal)
                }
            }
            if(target != null){ targetList.push(...target) }
        }

        if(options.factory) {
            target = []
            if(creep.room.factory !== undefined){
                if(creep.room.factory.store.getFreeCapacity(resource) > 0 && creep.room.factory.store.getUsedCapacity(resource) < 10000){
                    target.push(creep.room.factory)
                }
            }
            if(target != null){ targetList.push(...target) }
        }

        if(options.storages) {
            target = []
            if(creep.room.storage !== undefined){
                if(creep.room.storage.store.getFreeCapacity(resource) > 0){
                    target.push(creep.room.storage)
                }
            }
            if(target != null){ targetList.push(...target) }
        }
        if(options.containers) {
            target = creep.room.find(FIND_STRUCTURES, {filter: (s) => { return s.structureType === STRUCTURE_CONTAINER && s.store.getFreeCapacity(resource) > 0; } });
            if(target != null){ targetList.push(...target) }
        }
        if(options.labs) {
            target = creep.room.find(FIND_STRUCTURES, {filter: (s) => { return s.structureType === STRUCTURE_LAB && s.store.getFreeCapacity(resource) > 0; } });
            if(target != null){ targetList.push(...target) }
        }

        return creep.pos.findClosestByPath(targetList,{algorithm: "astar"})
    },

    depositResources(creep, options = {factory:false,terminal:false,storages:false,containers:false,links:false,labs:false}, resource = RESOURCE_ENERGY){
        if(creep.memory.targetDeposit != null){
            let memoryTarget = Game.getObjectById(creep.memory.targetDeposit)
            if(memoryTarget != null){
                this.workerTransfer(creep,memoryTarget,resource)
                return true
            }
        }

        let target = this.getDepositTarget(creep,options,resource)
        if(target != null){
            creep.memory.targetDeposit = target.id
            this.workerTransfer(creep,target,resource)
            return true
        }

        creep.memory.targetDeposit = null
        return false
    },

    maintainBaseStructures(creep){
        let target = null
        if(creep.memory.target != null){
            target = Game.getObjectById(creep.memory.target)
            if(!target || target.hits === target.hitsMax){
                creep.memory.target =  null
                target = null
            }
        }
        if(creep.memory.target == null){
            var takenTargets = util.getCreepPropsByRole(creep.room,creep.memory.role,'target')
            if(takenTargets.length){
                target = creep.pos.findClosestByRange(FIND_STRUCTURES,{
                    algorithm: "astar",
                    filter: (s) =>
                        !takenTargets.includes(s.id)
                        && s.hits < s.hitsMax
                        && (s.structureType !== STRUCTURE_WALL && s.structureType !== STRUCTURE_RAMPART)
                })
            }else{
                target = creep.pos.findClosestByRange(FIND_STRUCTURES,{
                    algorithm: "astar",
                    filter: (s) =>
                        s.hits < s.hitsMax
                        && (s.structureType !== STRUCTURE_WALL && s.structureType !== STRUCTURE_RAMPART)
                })
            }
            creep.memory.target = target == null ? null : target.id
        }
        if(target != null) {
            this.workerRepair(creep,target)
            return true
        }
        return false
    },

    maintainBaseRamparts(creep){
        if(creep.memory.target !== null){
            target = Game.getObjectById(creep.memory.target);
            if(!target || target.hits === target.hitsMax){
                creep.memory.target =  null
                target = null
            }
        }
        
      if(creep.memory.target == null  && creep.store.getUsedCapacity() > (creep.store.getCapacity() * 0.1)){
        let takenTargets = util.getCreepPropsByRole(creep.room,creep.memory.role,'target');
        target = creep.pos.findClosestByPath(FIND_STRUCTURES,{
            algorithm: "astar",
            filter: (s) =>
                (takenTargets.length && !takenTargets.includes(s.id))
                && s.hits < s.hitsMax && s.hits < s.room.memory.defenseMin
                && s.structureType === STRUCTURE_RAMPART
        });
      }
    },

    maintainBaseDefenses(creep){
        let target = null
        if(creep.memory.target !== null){
            target = Game.getObjectById(creep.memory.target);
            if(!target || target.hits === target.hitsMax){
                creep.memory.target =  null
                target = null
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
            return true
        }
        return false
    },

    buildConstructionSites(creep){
      let target = this.getBuildTarget(creep)
      if(target == null){ return false; }
      else{
        this.workerBuild(creep,target)
        return true;
      }
    }
}
