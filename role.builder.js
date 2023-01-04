/*
 * Role Builder - collects
        
 */

var creepUtil = require('util.creep');
var roleBuilder = {

    /** @param {Creep} creep **/
    run: function(creep) {

	    if(creep.memory.building && creep.store[RESOURCE_ENERGY] == 0) {
            creep.memory.building = false;
            creep.say('🔄 harvest');
	    }
	    if(!creep.memory.building && creep.store.getFreeCapacity() == 0) {
	        creep.memory.building = true;
	        creep.say('🚧 build');
	    }

	    if(creep.memory.building) {
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
            var containers = creep.room.find(FIND_STRUCTURES,{ filter: (structure) => { return structure.structureType == STRUCTURE_CONTAINER && structure.store.getUsedCapacity(RESOURCE_ENERGY) > 0; } });
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
	}
};

module.exports = roleBuilder;
