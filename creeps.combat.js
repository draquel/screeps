const util = require("./util");

module.exports =  {

    combatAttack(creep,target){
        let result = creep.attack(target)
        if (result === ERR_NOT_IN_RANGE) {
            creep.moveTo(target, {visualizePathStyle: {stroke: '#FF0000'}, reusePath: creep.room.memory.reusePath});
        }else if(result === ERR_INVALID_TARGET){
            creep.memory.target = null;
        }else if(result === ERR_NO_BODYPART){
            console.log("combatAttack: Creep "+creep.name+" does not have ATTACK part")
        }else if(result === ERR_INVALID_ARGS){
            console.log("combatAttack: Invalid Arguments")
        }
    },

    combatHeal(creep,target){
        if(targetObj.hits === targetObj.hitsMax){
            return
        }

        let result = creep.heal(target)
        if (result === ERR_NOT_IN_RANGE) {
            creep.moveTo(target, {visualizePathStyle: {stroke: '#00FF00'}, reusePath: creep.room.memory.reusePath});
        }else if(result === ERR_INVALID_TARGET){
            creep.memory.target = null;
        }else if(result === ERR_NO_BODYPART){
            console.log("combatHeal: Creep "+creep.name+" does not have HEAL part")
        }else if(result === ERR_INVALID_ARGS){
            console.log("combatHeal: Invalid Arguments")
        }
    },

    combatRanged(creep,target){
        let result = creep.ranged_attack(target)
        if (result === ERR_NOT_IN_RANGE) {
            creep.moveTo(target, {visualizePathStyle: {stroke: '#0000FF'}, reusePath: creep.room.memory.reusePath});
        }else if(result === ERR_INVALID_TARGET){
            creep.memory.target = null;
        }else if(result === ERR_NO_BODYPART){
            console.log("combatRanged: Creep "+creep.name+" does not have RANGED part")
        }else if(result === ERR_INVALID_ARGS){
            console.log("combatRanged: Invalid Arguments")
        }
    },

    combatClaim(creep,target){
        let result = creep.claim(target)
        if (result === ERR_NOT_IN_RANGE) {
            creep.moveTo(target, {visualizePathStyle: {stroke: '#00FFFF'}, reusePath: creep.room.memory.reusePath});
        }else if(result === ERR_INVALID_TARGET){
            creep.memory.target = null;
        }else if(result === ERR_NO_BODYPART){
            console.log("combatClaim: Creep "+creep.name+" does not have CLAIM part")
        }else if(result === ERR_INVALID_ARGS){
            console.log("combatClaim: Invalid Arguments")
        }
    },

    getAttackTarget(creep){
        var takenTargets = util.getCreepPropsByRole(creep.room,creep.memory.role,'target');
        let target = creep.pos.findClosestByPath(FIND_HOSTILE_STRUCTURES,{filter: (s) => (takenTargets.length && !takenTargets.includes(s.id)) && s.structureType === STRUCTURE_TOWER})
        if(target == null){
            target = creep.pos.findClosestByPath(FIND_HOSTILE_CREEPS, {filter: (c) => (takenTargets.length && !takenTargets.includes(c.id)) && c.body.map(i => i.type).includes("ATTACK")});
        }
        if (target == null) {
            target = creep.pos.findClosestByPath(FIND_HOSTILE_CREEPS, {filter: (c) => (takenTargets.length && !takenTargets.includes(c.id)) });
        }
        if (target == null) {
            target = creep.pos.findClosestByPath(FIND_HOSTILE_STRUCTURES, {filter: (s) => s.structureType !== STRUCTURE_CONTROLLER})
        }
        if (target == null) {
            target = creep.pos.findClosestByPath(FIND_HOSTILE_STRUCTURES, {filter: (s) => s.structureType === STRUCTURE_CONTROLLER})
        }
        return target
    }

}
