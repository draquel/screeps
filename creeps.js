//const util = require("./util");
const work = require("./creeps.work");
const combat = require("./creeps.combat");
const util = require("./util");

module.exports =  {

    run(creep){
        //runOrder
        this.runRole(creep);
    },

    /*
    *   ROLES
    */

    runRole(creep){
        switch(creep.memory.role){
            case 'scout': this.runScout(creep); break;
            case 'harvester': this.runHarvester(creep); break;
            case 'builder': this.runBuilder(creep); break;
            case 'maintenance': this.runMaintenance(creep); break;
            case 'd-maintenance': this.runDMaintenance(creep); break;
            case 'transporter': this.runTransporter(creep); break;
            case 'miner': this.runMiner(creep); break;

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
            creep.memory.targetCollect = null;
            creep.say('🚚 Deliver');
        }
        if(!creep.memory.working && creep.store[RESOURCE_ENERGY] === 0) {
            creep.memory.working = true;
            creep.memory.targetDeposit = null;
            creep.say('🔄 Harvest');
        }

        if(creep.memory.working){
            if(creep.memory.targetRoom != null && !this.inTargetRoom(creep)){
                this.moveToRoom(creep)
            }else if(creep.memory.targetRoom == null && !this.inHomeRoom(creep)){
                this.moveToHome(creep)
            }else{
                work.collectResource(creep,{sources:true,drops:true,tombs:true})
            }
        }else{
            if(!this.inHomeRoom(creep)){
                this.moveToHome(creep)
            }else if (!work.refillBaseEnergy(creep, {storages: true, containers: true, links:false})) {
                work.workerUpgrade(creep)
            }
        }
    },

    runMaintenance(creep){
        if(creep.memory.working && creep.store[RESOURCE_ENERGY] === 0) {
            creep.memory.working = false;
            //creep.memory.target = null;
            creep.memory.targetDeposit = null;
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
            if(!work.depositResources(creep, {factory:true,terminal:true,links:false,storages:false,containers:false},resource)){
                work.depositResources(creep, {terminal:false,links:false,labs:false,storages:true,containers:false},resource)
            }
        }else{
            let targets = creep.room.find(FIND_STRUCTURES, {
                algorithm: "astar",
                filter: (s) => {
                    return (s.structureType === STRUCTURE_SPAWN && s.store.getFreeCapacity(resource) > 0 ||
                        s.structureType === STRUCTURE_EXTENSION && s.store.getFreeCapacity(resource) > 0 ||
                        s.structureType === STRUCTURE_TOWER) && s.store.getFreeCapacity(resource) > s.store.getCapacity(resource) * 0.25 ||
                        s.structureType === STRUCTURE_TERMINAL && s.store.getFreeCapacity(resource) > 0 && s.store.getUsedCapacity(resource) < 10000 ||
                        resource === RESOURCE_ENERGY && s.structureType === STRUCTURE_LAB && s.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
                }
            });
            let controllerUnder5 = creep.room.controller != null && creep.room.controller.level < 5

            work.collectResource(
                creep,
                {
                    drops: controllerUnder5,
                    tombs: controllerUnder5,
                    links: true,
                    sources: false,
                    containers: controllerUnder5 || resource !== RESOURCE_ENERGY,
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
            creep.say('🔧 Repair');
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
                    storages:creep.room.controller.level > 4,
                    links:true,
                    tombs:false,
                    drops:true,
                    sources:!containers.length
                }
            );
        }
    },

    runMiner(creep){
        let resource = this.getTargetResource(creep)
        if(creep.memory.working && creep.store.getFreeCapacity() === 0) {
            creep.memory.working = false;
            //creep.say('🚚 Deliver');
        }
        if(!creep.memory.working && creep.store[resource] === 0) {
            creep.memory.working = true;
            //creep.say('🔦 Mining');
        }

        let target
        if(!creep.memory.target){
            let taken = util.getCreepProp(creep.room.find(FIND_MY_CREEPS),'target');
            if(resource === RESOURCE_ENERGY){
                target = creep.pos.findClosestByPath(creep.room.sources,{filter:(s) => { return !taken.includes(s.id) },algorithm: "astar"});
            }else{
                target = creep.pos.findClosestByPath(FIND_MINERALS,{filter:(s) => { return !taken.includes(s.id) },algorithm: "astar"});
            }
            creep.memory.target = target != null ? target.id : null;
        }else{
            target = Game.getObjectById(creep.memory.target);
        }

        if(creep.memory.working && target != null){
            work.workerHarvest(creep,target)
        }else{
            let link = creep.pos.findClosestByRange(FIND_STRUCTURES,{filter:(s) => { return s.structureType === STRUCTURE_LINK && s.store.getFreeCapacity(resource) > 0}});
            if(link != null && creep.pos.inRangeTo(link.pos.x,link.pos.y,2)){
                res = work.workerTransfer(creep,link)
            }else{
                let container = creep.pos.findClosestByRange(FIND_STRUCTURES,{filter:(s) => { return s.structureType === STRUCTURE_CONTAINER }});
                if(container && creep.pos.inRangeTo(container.pos.x,container.pos.y,2) && creep.store.getUsedCapacity(resource) > 0){
                    work.workerTransfer(creep,container,resource)
                }
            }
        }
    },

    runClaimer(creep){
        if(creep.memory.targetRoom != null && !this.inTargetRoom(creep)){
            this.moveToRoom(creep)
            return
        }

        if(creep.memory.fighting){
            combat.combatClaim(creep)
        }else{}
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
            util.moveToTarget(creep,{showPath:creep.room.memory.showPath, pathColor: "#0c02d1", reusePath:10},creep.pos.findClosestByPath(creep.room.findExitTo(room),{algorithm:'astar'}))
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
