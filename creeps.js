//const util = require("./util");
const work = require("./creeps.work");
const combat = require("./creeps.combat");

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
                let target = work.getCollectTarget(creep,{sources:true})
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
            work.collectResource(creep,{sources:true,drops:true,tombs:true})
        }else{
            if(!work.refillBaseEnergy(creep,{storages: false, containers: true})){
                work.workerUpgrade(creep)
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
                work.collectResource(creep,{sources: true, drops: true, tombs: true})
            }
        }else{
            if(this.moveToHome(creep)){
                if(!work.refillBaseEnergy(creep,{links: true, storages: true, containers: true})){
                    work.workerUpgrade(creep)
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
            if(!work.refillBaseEnergy(creep,{storages: false, containers: false})){
                if(!work.maintainBaseStructures(creep)){
                    let targetObj = creep.pos.findClosestByRange(FIND_STRUCTURES,{
                        algorithm: "astar",
                        filter: (s) =>
                            (s.structureType === STRUCTURE_RAMPART && s.hits < 100000) || (s.structureType === STRUCTURE_WALL && s.hits < 100000)
                    });
                    if(targetObj != null) {
                        work.workerRepair(creep,targetObj)
                        creep.memory.target = targetObj.id;
                    }else{
                        work.workerUpgrade(creep)
                    }
                }
            }
        }else{
            work.collectResource(creep,{drops: false, tombs: true, sources: true, containers: true, storages: true})
        }

    },

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
            if(!work.refillBaseEnergy(creep,{storages: false, containers: false})){
                work.refillBaseEnergy(creep,{storages: true, containers: false})
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

            let res = work.collectResource(
                creep,
                {
                    drops: true,
                    tombs: true,
                    links: true,
                    sources: false,
                    containers: (creep.room.controller.level <= 5),
                    storages: (targets.length > 0)
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
            if(!work.maintainBaseDefenses(creep)){
                if(!work.refillBaseEnergy(creep,{storages: false, containers: false})){
                    work.workerUpgrade(creep)
                }
            }
        }else{
            work.collectResource(
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
            let target = work.getBuildTarget(creep)
            if(target) {
                work.workerBuild(creep,target)
            }else{
                work.workerUpgrade(creep)
            }
        }
        else{
            let containers = creep.room.find(FIND_STRUCTURES,{filter: (s) => s.structureType === STRUCTURE_CONTAINER && s.store.getUsedCapacity(RESOURCE_ENERGY) >= creep.store.getFreeCapacity() * 2})
            work.collectResource(
                creep,{
                    containers:true,
                    storages:true,
                    sources:(!containers.length)
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
        // if(creep.memory.fighting && creep.memory.target === null) {
        //     creep.memory.fighting = false;
        //     creep.say('🚚 Defend');
        // }
        // if(!creep.memory.fighting && creep.memory.target !== null) {
        //     creep.memory.fighting = true;
        //     creep.say('🔦 Attack');
        // }

        if(this.moveToRoom(creep)) {
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
                if(this.moveToRoom(creep,targetObj.room.name)){
                    combat.combatHeal(creep,targetObj)
                }
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
                combat.combatAttack(creep,targetObj)
            }else{
                creep.memory.target = null
            }
        }else{
            let target = combat.getAttackTarget(creep)
            if(target != null){
                creep.memory.target = target
            }else{
                //fallback behavior
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
            if(this.moveToRoom(creep)){
                let targetObj = Game.getObjectById(creep.memory.target);
                if (targetObj != null){
                    combat.combatAttack(creep,targetObj)
                }else{
                    creep.memory.target = null
                }
            }
        }else{
            if(this.moveToRoom(creep)){
                let target = combat.getAttackTarget(creep)
                if(target != null){
                    creep.memory.target = target
                }else{
                    //fallback behavior
                }
            }
        }
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
                visualizePathStyle: {stroke: '#0c02d1'},
                reusePath: creep.room.memory.reusePath
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
    }

}
