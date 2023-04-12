//const util = require("./util");
const work = require("./creeps.work");
const combat = require("./creeps.combat");
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
            case 'transporter': this.runTransporter(creep); break;
            case 'miner': this.runCMiner(creep); break;
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
            creep.memory.target = null;
            creep.memory.targetDeliver = null;
            creep.say('🚚 Deliver');
        }
        if(!creep.memory.working && creep.store[RESOURCE_ENERGY] === 0) {
            creep.memory.working = true;
            creep.memory.targetCollect = null;
            creep.say('🔄 Harvest');
        }

        if(creep.memory.targetRoom != null && !this.inTargetRoom(creep)){
            this.moveToRoom(creep)
            return
        }

        if(creep.memory.working){
            work.collectResource(creep,{sources:true,drops:true,tombs:true})
        }else{
            if(!work.refillBaseEnergy(creep,{storages: false, containers: false, links:false})) {
                if (!work.refillBaseEnergy(creep, {storages: false, containers: true, links:false})) {
                    work.workerUpgrade(creep)
                }
            }
        }
    },

    runRHarvester(creep){
        if(creep.memory.working && creep.store.getFreeCapacity() === 0) {
            creep.memory.working = false;
            creep.memory.target = null;
            creep.memory.targetDeliver = null;
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
            creep.memory.targetDeliver = null;
            creep.say('⚡ Recharge');
        }
        if(!creep.memory.working && creep.store.getFreeCapacity() === 0) {
            creep.memory.working = true;
            creep.memory.targetCollect = null;
            creep.say('🔧 Repair');
        }

        if(creep.memory.targetRoom != null && !this.inTargetRoom(creep)){
            this.moveToRoom(creep)
            return
        }

        if(creep.memory.working){
            if(!work.refillBaseEnergy(creep,{terminal:false, storages: false, containers: false, links:false})){
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
            work.collectResource(creep,{drops: true, tombs: true, sources: true, containers: true, storages: true})
        }

    },

    runTransporter(creep){
        let resource = this.getTargetResource(creep)
        if(creep.memory.working && creep.store[resource] === 0) {
            creep.memory.working = false;
            creep.memory.targetDeposit = null;
            creep.say('🚚 Load');
        }
        if(!creep.memory.working && creep.store.getFreeCapacity() === 0) {
            creep.memory.working = true;
            creep.memory.targetCollect = null;
            creep.say('🚚 Deliver');
        }


        if(creep.memory.working){
            if(!work.refillBaseResources(creep, {terminal:true,links:true,storages:false,containers:false},resource)){
                work.refillBaseResources(creep, {terminal:false,links:false,storages:true,containers:false},resource)
            }
        }else{
            let targets = creep.room.find(FIND_STRUCTURES, {
                algorithm: "astar",
                filter: (s) => {
                    return (s.structureType === STRUCTURE_SPAWN && s.store.getFreeCapacity(resource) > 0 ||
                        s.structureType === STRUCTURE_EXTENSION && s.store.getFreeCapacity(resource) > 0 ||
                        s.structureType === STRUCTURE_TOWER) && s.store.getFreeCapacity(resource) > 0 ||
                        s.structureType === STRUCTURE_TERMINAL && s.store.getFreeCapacity(resource) > 0 && s.store.getUsedCapacity(resource) < 7500;
                }
            });

            work.collectResource(
                creep,
                {
                    drops: true,
                    tombs: true,
                    links: false,
                    sources: false,
                    containers: true,
                    storages: targets.length > 0
                },
                resource
            )
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
            creep.memory.targetCollect = null;
            creep.say('🔧 repair');
        }

        if(creep.memory.working){
            if(!work.maintainBaseDefenses(creep)){
                if(!work.refillBaseEnergy(creep,{storages: false, containers: false, links: false})){
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
            creep.memory.targetCollect = null;
            creep.say('🔨 build');
        }

        if(creep.memory.targetRoom != null && !this.inTargetRoom(creep)){
            this.moveToRoom(creep)
            return
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
                    links:true,
                    tombs:false,
                    drops:false,
                    sources:(!containers.length)
                }
            );
        }
    },

    runCMiner(creep){
        let resource = this.getTargetResource(creep)
        if(creep.memory.working && creep.store.getFreeCapacity() === 0) {
            creep.memory.working = false;
            //creep.say('🚚 Deliver');
        }
        if(!creep.memory.working && creep.store[resource] === 0) {
            creep.memory.working = true;
            //creep.say('🔦 Mining');
        }

        if(!creep.memory.target){
            let targetObj = creep.pos.findClosestByPath(FIND_STRUCTURES,{filter:(s) => { return s.structureType === STRUCTURE_CONTAINER && s.store.getFreeCapacity(resource) > 0 },algorithm: "astar"});
            creep.memory.target = targetObj.id;
        }else{
            targetObj = Game.getObjectById(creep.memory.target);
        }

        if(creep.memory.working && targetObj != null){
            if(!creep.pos.isEqualTo(targetObj.pos)) {
                util.moveToTarget(creep,{showPath: true,pathColor: '#ffffff'},targetObj)

            }else{
                let target

                if(resource === RESOURCE_ENERGY){
                    //console.log('miner ['+creep.name+']: set energy target')
                    target = creep.pos.findClosestByRange(FIND_SOURCES,{algorithm: "astar"});
                }else{
                    //console.log('miner ['+creep.name+']: set mineral target')
                    target = creep.pos.findClosestByRange(FIND_MINERALS,{algorithm: "astar",filter: (r) => { return r.mineralType === resource}});
                }

                if(target && creep.pos.inRangeTo(target,1)) {
                    if (creep.harvest(target) === ERR_NOT_IN_RANGE) {
                        console.log('Miner ' + creep.name + ': Target Out of Range!!!')
                    }
                }
            }
        }else{
            let res = creep.transfer(targetObj, resource)
            if(res === ERR_NOT_IN_RANGE) {
                creep.moveTo(targetObj, {visualizePathStyle: {stroke: '#ffffff'},reusePath:4});
                console.log('Miner '+ creep.name+': Container Out of Range!!!')
            }
            if(res === ERR_FULL){
                let link = creep.pos.findClosestByRange(FIND_STRUCTURES,{filter:(s) => { return s.structureType === STRUCTURE_LINK }});
                if(link && creep.pos.inRangeTo(link.pos,1)){
                    creep.transfer(link, resource)
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
                creep.memory.target = target.id
            }else{
                //fallback behavior
            }
        }

    },

    runAttack(creep){
        if(creep.memory.fighting && creep.memory.target === null) {
            creep.memory.fighting = false;
            //creep.say('🚚 Defend');
        }
        if(!creep.memory.fighting && creep.memory.target !== null) {
            creep.memory.fighting = true;
            creep.say('🔦 Attack');
        }

        if(creep.memory.fighting){
            if(this.moveToRoom(creep)){
                let targetObj = Game.getObjectById(creep.memory.target);
                //console.log(creep.name + ' Attacking '+ targetObj.name == null ? targetObj.id : targetObj.name )
                if (targetObj != null){
                    combat.combatAttack(creep,targetObj)
                }else{
                    creep.memory.target = null
                }
            }
        }else{
            let moveRes = this.moveToRoom(creep)
            //console.log(moveRes)
            if(moveRes){
                let target = combat.getAttackTarget(creep)
                if(target != null){
                    creep.memory.target = target.id
                    creep.memory.targetRoom = target.room.id
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
        if(creep.memory.currentRoom !== creep.room.name && (creep.pos.x*creep.pos.y === 0 || creep.pos.x === 49 || creep.pos.y === 49)){
            creep.moveTo(new RoomPosition(25,25,creep.room.name))
            creep.memory.currentRoom = creep.room.name
        }
        if(!this.inTargetRoom(creep,room)) {
            util.moveToTarget(creep,{showPath: true, pathColor: "#0c02d1"},creep.pos.findClosestByPath(creep.room.findExitTo(room)))
            //console.log('moveToRoom: Moving To Room '+creep.memory.targetRoom)
            return false;
        }else{
            //console.log('moveToRoom: Found Room '+creep.memory.targetRoom)
            return true;
        }
    },

    getTargetResource(creep) {
        return creep.memory.targetResource == null ? RESOURCE_ENERGY : creep.memory.targetResource
    }

}
