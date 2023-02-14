const util = require("./util.root");

module.exports =  {

    run(creep){
        //runOrder
        this.runRole(creep);
    },

    runOrders(creep){
        if(creep.memory.orders.length === 0){
            return false;
        }

        let order = creep.memory.orders.shift();

    },

    runRole(creep){
        switch(creep.memory.role){
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
            if(!creep.memory.target){
                var targetObj = creep.pos.findClosestByPath(FIND_SOURCES,{algorithm: "astar"});
                creep.memory.target = targetObj.id;
            }else{
                targetObj = Game.getObjectById(creep.memory.target);
            }

            if(creep.harvest(targetObj) === ERR_NOT_IN_RANGE) {
                creep.moveTo(targetObj, {visualizePathStyle: {stroke: '#ffaa00'},reusePath:4});
            }

        }else{
            if(!this.refillBaseEnergy(creep,{storages: false, containers: true})){
                this.workerFallback(creep)
            }
        }
    },

    runRHarvester(creep){
        if(creep.memory.working && creep.store.getFreeCapacity() === 0) {
            creep.memory.working = false;
            creep.say('🚚 Deliver');
        }
        if(!creep.memory.working && creep.store[RESOURCE_ENERGY] === 0) {
            creep.memory.working = true;
            creep.say('🔄 Harvest');
        }

        if(creep.memory.working){
            if(creep.room.name !== creep.memory.target_room) {
                creep.moveTo(creep.pos.findClosestByRange(creep.room.findExitTo(creep.memory.target_room)), {
                    visualizePathStyle: {stroke: '#ffaa00'},
                    reusePath: 4
                });
            }else{
                if(!creep.memory.target){
                    var targetObj = creep.pos.findClosestByPath(FIND_SOURCES,{algorithm: "astar"});
                    creep.memory.target = targetObj.id;
                }else{
                    targetObj = Game.getObjectById(creep.memory.target);
                }

                if(creep.harvest(targetObj) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(targetObj, {visualizePathStyle: {stroke: '#ffaa00'},reusePath:4});
                }
            }
        }else{
            if(creep.room.name !== creep.memory.room){
                creep.moveTo(creep.pos.findClosestByRange(creep.room.findExitTo(creep.memory.room)),{visualizePathStyle: {stroke: '#ffffff'},reusePath:4});
            }else{
                if(!this.refillBaseEnergy(creep,{links: true, storages: true,  containers: true})){
                    this.workerFallback(creep)
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
            creep.say('🔧 Repair');
        }

        if(creep.memory.working){
            if(!this.refillBaseEnergy(creep,{storages: false, containers: false})){
                var targetObj = null;
                if(creep.memory.target != null){
                    targetObj = Game.getObjectById(creep.memory.target);
                    if(!targetObj || targetObj.hits === targetObj.hitsMax){
                        creep.memory.target =  null;
                        targetObj = null;
                    }
                }
                if(creep.memory.target == null){
                    var takenTargets = util.getCreepPropsByRole(creep.room,'maintenance','target');
                    if(takenTargets.length){
                        targetObj = creep.pos.findClosestByPath(FIND_STRUCTURES,{
                            algorithm: "astar",
                            filter: (s) =>
                                (!takenTargets.includes(s.id))
                                && s.hits < s.hitsMax
                                && (s.structureType !== STRUCTURE_WALL && s.structureType !== STRUCTURE_RAMPART)
                        });
                    }else{
                        targetObj = creep.pos.findClosestByPath(FIND_STRUCTURES,{
                            algorithm: "astar",
                            filter: (s) =>
                                s.hits < s.hitsMax
                                && (s.structureType !== STRUCTURE_WALL && s.structureType !== STRUCTURE_RAMPART)
                        });
                    }
                }

                if(targetObj != null) {
                    creep.memory.target = targetObj.id;
                    if (creep.repair(targetObj) === ERR_NOT_IN_RANGE) {
                        creep.moveTo(targetObj, {visualizePathStyle: {stroke: '#ffaa00'}, reusePath: 4});
                    }
                }else{
                    targetObj = creep.pos.findClosestByPath(FIND_STRUCTURES,{
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
                        this.workerFallback(creep)
                    }
                }
            }
        }else{
            this.collectEnergy(creep,{drops: false, tombs: true, sources: true, containers: true, storages: true, findOptions: { filter: (s) => { return s.store.getUsedCapacity() > 500 ; }}})
        }

    },

    runMMaintenance(creep){
        if(!creep.memory.working && creep.store[creep.memory.mineral] === 0) {
            creep.memory.working = false;
            creep.memory.target = null;
            creep.say('⚡ Recharge');
        }
        if(creep.memory.working && creep.store.getFreeCapacity(creep.memory.mineral) === 0) {
            creep.memory.working = true;
            creep.say('🚚 Deliver');
        }

        if(creep.memory.working){
            let targets = creep.room.find(FIND_STRUCTURES, {filter: (s) => s.structureType == STRUCTURE_CONTIANER && s.store.getUsedCapacity(creep.memory.mineral) > 0})

        }else{

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

            let res = this.collectEnergy(
                creep,
                {
                    drops: true,
                    tombs: true,
                    links: true,
                    sources: false,
                    containers: (creep.room.controller.level > 5 ? false : true),
                    storages: (targets.length > 0 ? true : false),
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
            creep.say('🔧 repair');
        }

        if(creep.memory.working){
            var targetObj = null;
            if(creep.memory.target != null){
                targetObj = Game.getObjectById(creep.memory.target);
                if(!targetObj || targetObj.hits === targetObj.hitsMax){
                    creep.memory.target =  null;
                    targetObj = null;
                }
            }
            if(creep.memory.target == null){
                var takenTargets = util.getCreepPropsByRole(creep.room,'d-maintenance','target');
                targetObj = creep.pos.findClosestByPath(FIND_STRUCTURES,{
                    algorithm: "astar",
                    filter: (s) =>
                        (takenTargets.length && !takenTargets.includes(s.id))
                        && s.hits < s.hitsMax
                        && s.structureType === STRUCTURE_RAMPART
                });
                if(!targetObj){
                    targetObj = creep.pos.findClosestByPath(FIND_STRUCTURES,{
                        algorithm: "astar",
                        filter: (s) =>
                            s.hits < s.hitsMax * 0.25
                            && s.structureType === STRUCTURE_WALL
                    });
                }
                if(!targetObj){
                    targetObj = creep.pos.findClosestByPath(FIND_STRUCTURES,{
                        algorithm: "astar",
                        filter: (s) =>
                            s.hits < s.hitsMax * 0.50
                            && s.structureType === STRUCTURE_WALL
                    });
                }
                if(!targetObj){
                    targetObj = creep.pos.findClosestByPath(FIND_STRUCTURES,{
                        algorithm: "astar",
                        filter: (s) =>
                            s.hits < s.hitsMax * 0.75
                            && s.structureType === STRUCTURE_WALL
                    });
                }
                if(!targetObj){
                    targetObj = creep.pos.findClosestByPath(FIND_STRUCTURES,{
                        algorithm: "astar",
                        filter: (s) =>
                            s.hits < s.hitsMax
                            && s.structureType === STRUCTURE_WALL
                    });
                }
            }

            if(targetObj != null) {
                creep.memory.target = targetObj.id;
                if (creep.repair(targetObj) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(targetObj, {visualizePathStyle: {stroke: '#ffaa00'}, reusePath: 4});
                }
            }else{
                if(!this.refillBaseEnergy(creep,{storages: false, containers: false})){
                    this.workerFallback(creep)
                }
            }
        }else{
            this.collectEnergy(
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
            creep.say('🔨 build');
        }

        if(creep.memory.working) {
            var target = null
            if(Game.getObjectById(creep.memory.target) == null || !creep.memory.target){
                var cSites = creep.room.find(FIND_CONSTRUCTION_SITES);
                if(cSites.length){
                    target = creep.pos.findClosestByPath(cSites,{algorithm: "astar"});
                    creep.memory.target = target.id;
                }
            }else{
                target = Game.getObjectById(creep.memory.target);
            }
            if(target) {
                var result = creep.build(target);
                if(result === ERR_NOT_IN_RANGE) {
                    creep.moveTo(target, {visualizePathStyle: {stroke: '#ffffff'}, reusePath:4});
                }else if(result === ERR_INVALID_TARGET){
                    creep.memory.target = null;
                }
            }else{
                this.workerFallback(creep)
            }
        }
        else{
            let containers = creep.room.find(FIND_STRUCTURES,{filter: (s) => s.structureType === STRUCTURE_CONTAINER})
            this.collectEnergy(
                creep,{
                    containers:true,
                    storages:true,
                    sources:(containers.length ? false : true),
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
        if(creep.room.name !== creep.memory.target_room) {
            creep.moveTo(creep.pos.findClosestByRange(creep.room.findExitTo(creep.memory.target_room)), {
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
                if(creep.room.name != targetObj.room.name){
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
                if (creep.attack(targetObj) == ERR_NOT_IN_RANGE) {
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
                let targets = creep.room.find(FIND_STRUCTURES,{filter: (s) => s.structureType == STRUCTURE_CONTAINER || s.structureType == STRUCTURE_SPAWN})
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
            if(creep.memory.target_room != null && creep.room.name !== creep.memory.target_room) {
                creep.moveTo(creep.pos.findClosestByRange(creep.room.findExitTo(creep.memory.target_room)), {
                    visualizePathStyle: {stroke: '#ffaa00'},
                    reusePath: 4
                });
            }else{
                let targetObj = Game.getObjectById(creep.memory.target);
                if (targetObj != null){
                    if (creep.attack(targetObj) == ERR_NOT_IN_RANGE) {
                        creep.moveTo(targetObj, {visualizePathStyle: {stroke: '#ffffff'}, reusePath: 4});
                    }
                }else{
                    creep.memory.target = null
                }
            }
        }else{
            if(creep.memory.target_room != null && creep.room.name !== creep.memory.target_room) {
                creep.moveTo(creep.pos.findClosestByRange(creep.room.findExitTo(creep.memory.target_room)), {
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

    workerFallback(creep){
        //Upgrade Controller
        if(creep.room.controller.level < 8) {
            if(creep.upgradeController(creep.room.controller) === ERR_NOT_IN_RANGE){
                creep.moveTo(creep.room.controller, {visualizePathStyle: {stroke: '#ffffff'}, reusePath:4});
            }
        }
    },

    collectEnergy(creep,options = {sources:false,containers:false,storages:false,links:false,tombs:true,drops:true,findOptions:{}}){
        if(options.links === undefined){ options.links = false; }
        if(options.tombs === undefined){ options.tombs = false; }
        if(options.drops === undefined){ options.drops = false; }
        if(options.containers === undefined){ options.containers = false; }
        if(options.storages === undefined){ options.storages = false; }
        if(options.sources === undefined){ options.sources = false; }
        if(options.findOptions === undefined){ options.findOptions = {}; }

        var storages = creep.room.find(FIND_STRUCTURES,{filter:(s) => { return s.structureType === STRUCTURE_STORAGE && s.store.getUsedCapacity(RESOURCE_ENERGY) > 10000 }});
        var containers = creep.room.find(FIND_STRUCTURES,{filter:(s) => { return s.structureType === STRUCTURE_CONTAINER && s.store.getUsedCapacity(RESOURCE_ENERGY) > 200 }});
        var links = creep.room.find(FIND_STRUCTURES,{filter:(s) => { return s.structureType === STRUCTURE_LINK && s.id == creep.room.memory.targetLink && s.store.getUsedCapacity(RESOURCE_ENERGY) > 80 }});
        var tombs = creep.room.find(FIND_TOMBSTONES,{filter:(t) => t.store.getUsedCapacity(RESOURCE_ENERGY) > 0})
        var drops = creep.room.find(FIND_DROPPED_RESOURCES,{filter:(d) => d.resourceType === RESOURCE_ENERGY, })

        // console.log([
        //     creep.name+' ('+creep.memory.role+')',
        //     'links: '+ (links.length > 0 && options.links),
        //     'storages: '+ (storages.length > 0 && options.storages),
        //     'containers: '+ (containers.length > 0 && options.containers),
        //     'drops: '+ (drops.length > 0 && options.drops),
        //     'tombs: '+ (tombs.length > 0 && options.tombs)
        // ].toString())

        if(links.length > 0 && options.links){
            var link = creep.pos.findClosestByPath(links,options.findOptions);
            if(creep.withdraw(link,RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                creep.moveTo(link, {visualizePathStyle: {stroke: '#ffaa00'},reusePath:4});
            }
        }else if(storages.length > 0 && options.storages){
            var storage = creep.pos.findClosestByPath(storages,options.findOptions);
            if(creep.withdraw(storage,RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                creep.moveTo(storage, {visualizePathStyle: {stroke: '#ffaa00'},reusePath:4});
            }
        }else if(drops.length > 0 && options.drops){
            var drop = creep.pos.findClosestByPath(drops);
            var res = creep.pickup(drop,RESOURCE_ENERGY);
            if(res === ERR_NOT_IN_RANGE) {
                creep.moveTo(drop, {visualizePathStyle: {stroke: '#ffaa00'},reusePath:4});
            }
        }else if(tombs.length > 0 && options.tombs){
            var tomb = creep.pos.findClosestByPath(tombs);
            if(creep.withdraw(tomb,RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                creep.moveTo(tomb, {visualizePathStyle: {stroke: '#ffaa00'},reusePath:4});
            }
        }else if(containers.length > 0 && options.containers){
            var container = creep.pos.findClosestByPath(containers,options.findOptions);
            if(creep.withdraw(container,RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                creep.moveTo(container, {visualizePathStyle: {stroke: '#ffaa00'},reusePath:4});
            }
        }else if(options.sources) {
            var source = creep.pos.findClosestByRange(FIND_SOURCES,options.findOptions);
            if(creep.harvest(source) === ERR_NOT_IN_RANGE) {
                creep.moveTo(source, {visualizePathStyle: {stroke: '#ffaa00'},reusePath:4});
            }
        }else{
            //console.log("Creep: "+creep.name+" - No Energy target")
            return false;
        }
        return true;
    },

    refillBaseEnergy(creep,options = {storages:false,containers:false,links:false}){
        if(options.containers === undefined){ options.containers = false; }
        if(options.storages === undefined){ options.storages = false; }

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
    }

}
