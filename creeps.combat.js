const util = require("./util");

module.exports =  {

    combatAttack(creep,target){
        let result = creep.attack(target)
        if (result === ERR_NOT_IN_RANGE) {
            util.moveToTarget(creep,{showPath: creep.room.memory.showPath, pathColor: '#ff0000'},target)
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
            util.moveToTarget(creep,{showPath: creep.room.memory.showPath, pathColor: '#00ff00'},target)
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
            util.moveToTarget(creep,{showPath: creep.room.memory.showPath, pathColor: '#0000ff'},target)
        }else if(result === ERR_INVALID_TARGET){
            creep.memory.target = null;
        }else if(result === ERR_NO_BODYPART){
            console.log("combatRanged: Creep "+creep.name+" does not have RANGED part")
        }else if(result === ERR_INVALID_ARGS){
            console.log("combatRanged: Invalid Arguments")
        }
    },

    combatClaim(creep){
        let controller = creep.room.find(FIND_STRUCTURES,{filter:(s) => s.structureType === STRUCTURE_CONTROLLER})
        let res = creep.claimController(controller[0])
        if(res === ERR_NOT_IN_RANGE){
            util.moveToTarget(creep,{showPath: creep.room.memory.showPath, pathColor: '#ffffff'},target)
        }else if(res === ERR_INVALID_TARGET){
            if(creep.attackController(controller[0]) === ERR_TIRED){
                //console.log("wait")
            }
        }else if(result === ERR_NO_BODYPART){
            console.log("combatClaim: Creep "+creep.name+" does not have CLAIM part")
        }else if(result === ERR_INVALID_ARGS){
            console.log("combatClaim: Invalid Arguments")
        }
    },

    getAttackTarget(creep){
        var takenTargets = util.getCreepPropsByRole(creep.room,creep.memory.role,'target');
        let target = creep.pos.findClosestByPath(FIND_HOSTILE_CREEPS, {filter: (c) => (takenTargets.length && !takenTargets.includes(c.id)) && c.body.map(i => i.type).includes("ATTACK")});
        if(target == null){
            target = creep.pos.findClosestByPath(FIND_HOSTILE_STRUCTURES,{filter: (s) => (takenTargets.length && !takenTargets.includes(s.id)) && s.structureType === STRUCTURE_TOWER})
        }
        // if (target == null) {
        //     target = creep.pos.findClosestByPath(FIND_HOSTILE_CREEPS, {filter: (c) => (takenTargets.length && !takenTargets.includes(c.id)) });
        // }
        // if (target == null) {
        //     target = creep.pos.findClosestByPath(FIND_HOSTILE_STRUCTURES, {filter: (s) => s.structureType !== STRUCTURE_CONTROLLER})
        // }
        // if (target == null) {
        //     target = creep.pos.findClosestByPath(FIND_HOSTILE_STRUCTURES, {filter: (s) => s.structureType === STRUCTURE_CONTROLLER})
        // }
        //console.log("target: "+target == null ? null : target.id)
        return target
    }

}
