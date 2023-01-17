/*
 * Role Harvester - collects energy from sources and delivers it to Spawns / Extensions / Containers
        -sunset by miner / logistic roles
 */

var harvester = {
    run: function(creep){
        if(creep.memory.harvesting && creep.store.getFreeCapacity() == 0) {
            creep.memory.harvesting = false;
	        creep.say('⚡ Deliver');
	    }
        if(!creep.memory.harvesting && creep.store[RESOURCE_ENERGY] == 0) {
            creep.memory.harvesting = true;
            creep.say('🔄 Harvest');
	    }

        if(creep.memory.harvesting){
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
            var targets = creep.room.find(FIND_STRUCTURES, {
                filter: (structure) => {
                    return (structure.structureType == STRUCTURE_EXTENSION ||
                            structure.structureType == STRUCTURE_CONTAINER ||
                            structure.structureType == STRUCTURE_SPAWN) && 
                            structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
                }
            });

            if(targets.length){
                if(creep.transfer(targets[0], RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                    creep.moveTo(targets[0], {visualizePathStyle: {stroke: '#ffffff'}, reusePath:4});
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
};

module.exports = harvester;