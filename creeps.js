const util = require("./util.root");

module.exports =  {

    run(creep){

        this.runRole(creep);

    },

    runRole(creep){
        switch(creep.memory.role){
            case 'harvester': this.runHarvester(creep); break;
            case 'r-harvester': this.runRHarvester(creep); break;
            case 'builder': this.runBuilder(creep); break;
            case 'maintenance': this.runMaintenance(creep); break;
            case 'c-miner': this.runCMiner(creep); break;
        }
    },

    runHarvester(creep){
        if(creep.memory.working && creep.store.getFreeCapacity() == 0) {
            creep.memory.working = false;
            creep.say('⚡ Deliver');
        }
        if(!creep.memory.working && creep.store[RESOURCE_ENERGY] == 0) {
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

            if(creep.harvest(targetObj) == ERR_NOT_IN_RANGE) {
                creep.moveTo(targetObj, {visualizePathStyle: {stroke: '#ffaa00'},reusePath:4});
            }

        }else{
            var target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                algorithm: "astar",
                filter: (s) => {
                    return (s.structureType == STRUCTURE_SPAWN ||
                            s.structureType == STRUCTURE_EXTENSION||
                            s.structureType == STRUCTURE_TOWER) &&
                        s.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
                }
            });
            if(target == null) {
                target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                    algorithm: "astar",
                    filter: (s) => {
                        return s.structureType == STRUCTURE_CONTAINER && s.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
                    }
                });
            }

            if(target != null){
                if(creep.transfer(target, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                    creep.moveTo(target, {visualizePathStyle: {stroke: '#ffffff'}, reusePath:4});
                }
            }else{
                if(creep.room.controller.level < 8) {
                    if(creep.upgradeController(creep.room.controller) == ERR_NOT_IN_RANGE){
                        creep.moveTo(creep.room.controller, {visualizePathStyle: {stroke: '#ffffff'}, reusePath:4});
                    }
                }
            }
        }
    },

    runRHarvester(creep){
        if(creep.memory.working && creep.store.getFreeCapacity() == 0) {
            creep.memory.working = false;
            creep.say('⚡ Deliver');
        }
        if(!creep.memory.working && creep.store[RESOURCE_ENERGY] == 0) {
            creep.memory.working = true;
            creep.say('🔄 Harvest');
        }

        if(creep.memory.working){
            if(creep.room.name != creep.memory.target_room) {
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

                if(creep.harvest(targetObj) == ERR_NOT_IN_RANGE) {
                    creep.moveTo(targetObj, {visualizePathStyle: {stroke: '#ffaa00'},reusePath:4});
                }
            }
        }else{
            if(creep.room.name != creep.memory.room){
                creep.moveTo(creep.pos.findClosestByRange(creep.room.findExitTo(creep.memory.room)),{visualizePathStyle: {stroke: '#ffffff'},reusePath:4});
            }else{
                var target = creep.pos.findClosestByPath(FIND_MY_STRUCTURES, {
                    algorithm: "astar",
                    filter: (s) => {
                        return (s.structureType == STRUCTURE_SPAWN ||
                                s.structureType == STRUCTURE_EXTENSION||
                                s.structureType == STRUCTURE_TOWER) &&
                            s.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
                    }
                });
                if(target == null) {
                    target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                        algorithm: "astar",
                        filter: (s) => {
                            return s.structureType == STRUCTURE_CONTAINER && s.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
                        }
                    });
                }

                if(target != null){
                    if(creep.transfer(target, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                        creep.moveTo(target, {visualizePathStyle: {stroke: '#ffffff'}, reusePath:4});
                    }
                }else{
                    if(creep.room.controller.level < 8) {
                        if(creep.upgradeController(creep.room.controller) == ERR_NOT_IN_RANGE){
                            creep.moveTo(creep.room.controller, {visualizePathStyle: {stroke: '#ffffff'}, reusePath:4});
                        }
                    }
                }
            }
        }
    },

    runMaintenance(creep){
        if(creep.memory.working && creep.store[RESOURCE_ENERGY] == 0) {
            creep.memory.working = false;
            creep.memory.target = null;
            creep.say('🔄 harvest');
        }
        if(!creep.memory.working && creep.store.getFreeCapacity() == 0) {
            creep.memory.working = true;
            creep.say('🔧 repair');
        }

        if(creep.memory.working){
            var targetObj = null;
            if(creep.memory.target != null){
                targetObj = Game.getObjectById(creep.memory.target);
                if(!targetObj || targetObj.hits == targetObj.hitsMax){
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
                            && (s.structureType != STRUCTURE_WALL && s.structureType != STRUCTURE_RAMPART)
                    });
                }else{
                    targetObj = creep.pos.findClosestByPath(FIND_STRUCTURES,{
                        algorithm: "astar",
                        filter: (s) =>
                            s.hits < s.hitsMax
                            && (s.structureType != STRUCTURE_WALL && s.structureType != STRUCTURE_RAMPART)
                    });
                }
            }

            if(targetObj != null) {
                creep.memory.target = targetObj.id;
                if (creep.repair(targetObj) == ERR_NOT_IN_RANGE) {
                    creep.moveTo(targetObj, {visualizePathStyle: {stroke: '#ffaa00'}, reusePath: 4});
                }
            }else{
                var targets = creep.room.find(FIND_STRUCTURES, {
                    filter: (s) => {
                        return (s.structureType == STRUCTURE_EXTENSION ||
                                s.structureType == STRUCTURE_SPAWN ||
                                s.structureType == STRUCTURE_TOWER) &&
                            s.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
                    }
                });

                if(targets.length){
                    if(creep.transfer(targets[0], RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                        creep.moveTo(targets[0], {visualizePathStyle: {stroke: '#ffffff'}, reusePath:4});
                    }
                }else{
                    targetObj = creep.pos.findClosestByPath(FIND_STRUCTURES,{
                        algorithm: "astar",
                        filter: (s) =>
                            (s.structureType == STRUCTURE_RAMPART && s.hits < s.hitsMax) || (s.structureType == STRUCTURE_WALL && s.hits < 1000000)
                    });
                    if(targetObj != null) {
                        creep.memory.target = targetObj.id;
                        if (creep.repair(targetObj) == ERR_NOT_IN_RANGE) {
                            creep.moveTo(targetObj, {visualizePathStyle: {stroke: '#ffaa00'}, reusePath: 4});
                        }
                    }else{
                        if(creep.room.controller.level < 8) {
                            if(creep.upgradeController(creep.room.controller) == ERR_NOT_IN_RANGE){
                                creep.moveTo(creep.room.controller, {visualizePathStyle: {stroke: '#ffffff'}, reusePath:4});
                            }
                        }
                    }
                }
            }
        }else{
            var containers = creep.room.find(FIND_STRUCTURES,{ filter: (s) => { return s.structureType == STRUCTURE_CONTAINER && s.store.getUsedCapacity(RESOURCE_ENERGY) > 250; } });
            if(containers.length){
                var container = creep.pos.findClosestByPath(containers,{algorithm: "astar"});
                if(creep.withdraw(container,RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                    creep.moveTo(container, {visualizePathStyle: {stroke: '#ffaa00'},reusePath:4});
                }
            }else{
                var source = creep.pos.findClosestByRange(FIND_SOURCES,{algorithm: "astar"});
                //var source = creepUtil.getTargets(creep.room.find(FIND_MY_CREEPS,{filter: (creep) => creep.memory.role == "harvester"})).map( (c) => { return c.memory.target; }).pop();
                if(creep.harvest(source) == ERR_NOT_IN_RANGE) {
                    creep.moveTo(source, {visualizePathStyle: {stroke: '#ffaa00'},reusePath:4});
                }
            }
        }

    },

    runBuilder(creep){
        if(creep.memory.working && creep.store[RESOURCE_ENERGY] == 0) {
            creep.memory.working = false;
            creep.say('🔄 harvest');
        }
        if(!creep.memory.working && creep.store.getFreeCapacity() == 0) {
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
                if(result == ERR_NOT_IN_RANGE) {
                    creep.moveTo(target, {visualizePathStyle: {stroke: '#ffffff'}, reusePath:4});
                }else if(result == ERR_INVALID_TARGET){
                    creep.memory.target = null;
                }
            }else{
                if(creep.room.controller.level < 8) {
                    if(creep.upgradeController(creep.room.controller) == ERR_NOT_IN_RANGE){
                        creep.moveTo(creep.room.controller, {visualizePathStyle: {stroke: '#ffffff'}, reusePath:4});
                    }
                }
            }
        }
        else {
            var containers = creep.room.find(FIND_STRUCTURES,{ filter: (s) => { return s.structureType == STRUCTURE_CONTAINER && s.store.getUsedCapacity(RESOURCE_ENERGY) > 0; } });
            if(containers.length){
                var container = creep.pos.findClosestByPath(containers,{algorithm: "astar"});
                if(creep.withdraw(container,RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                    creep.moveTo(container, {visualizePathStyle: {stroke: '#ffaa00'},reusePath:4});
                }
            }else{
                var source = creep.pos.findClosestByRange(FIND_SOURCES,{algorithm: "astar"});
                //var source = creepUtil.getTargets(creep.room.find(FIND_MY_CREEPS,{filter: (creep) => creep.memory.role == "harvester"})).map( (c) => { return c.memory.target; }).pop();
                if(creep.harvest(source) == ERR_NOT_IN_RANGE) {
                    creep.moveTo(source, {visualizePathStyle: {stroke: '#ffaa00'},reusePath:4});
                }
            }
        }
    },

    runCMiner(creep){
        if(creep.memory.working && creep.store.getFreeCapacity() == 0) {
            creep.memory.working = false;
            creep.say('⚡ Deliver');
        }
        if(!creep.memory.working && creep.store[RESOURCE_ENERGY] == 0) {
            creep.memory.working = true;
            creep.say('🔄 Harvest');
        }

        if(!creep.memory.target){
            var targetObj = creep.pos.findClosestByPath(FIND_STRUCTURES,{filter:(s) => { return s.structureType == STRUCTURE_CONTAINER },algorithm: "astar"});
            creep.memory.target = targetObj.id;
        }else{
            targetObj = Game.getObjectById(creep.memory.target);
        }

        if(creep.memory.working && targetObj != null){
            if(!creep.pos.isEqualTo(targetObj.pos)) {
                creep.moveTo(targetObj, {visualizePathStyle: {stroke: '#ffaa00'},reusePath:4});
            }else{
                var source = creep.pos.findClosestByRange(FIND_SOURCES,{algorithm: "astar"});
                if(creep.harvest(source) == ERR_NOT_IN_RANGE) {
                    console.log('C-Miner '+ creep.name+': Source Out of Range!!!')
                }
            }
        }else{
            if(creep.transfer(targetObj, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                creep.moveTo(targetObj, {visualizePathStyle: {stroke: '#ffaa00'},reusePath:4});
                console.log('C-Miner '+ creep.name+': Container Out of Range!!!')
            }
        }
    }
}
