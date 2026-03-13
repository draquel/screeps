/* eslint-disable no-undef */
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
        return result
    },

    combatHeal(creep,target){
        if(target.hits === target.hitsMax){
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
        return result
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
        return result
    },

    combatClaim(creep){
        let controller = creep.room.find(FIND_STRUCTURES,{filter:(s) => s.structureType === STRUCTURE_CONTROLLER})
        let result = creep.claimController(controller[0])
        if(result === ERR_NOT_IN_RANGE){
            util.moveToTarget(creep,{showPath: creep.room.memory.showPath, pathColor: '#ffffff'},controller[0])
        }else if(result === ERR_INVALID_TARGET){
            console.log("combatClaim: Attacking Target Controller")
            this.combatAttackController(creep)
        }else if(result === ERR_NO_BODYPART){
            console.log("combatClaim: Creep "+creep.name+" does not have CLAIM part")
        }else if(result === ERR_INVALID_ARGS){
            console.log("combatClaim: Invalid Arguments")
        }else if(result === ERR_GCL_NOT_ENOUGH){
            //console.log("combatClaim: GCL too low -> reserving room")
            this.combatReserve(creep)
        }
        return result
    },

    combatReserve(creep){
        let controller = creep.room.find(FIND_STRUCTURES,{filter:(s) => s.structureType === STRUCTURE_CONTROLLER})
        let result = creep.reserveController(controller[0])
        if(result === ERR_NOT_IN_RANGE){
            util.moveToTarget(creep,{showPath: creep.room.memory.showPath, pathColor: '#ffffff'},controller[0])
        }else if(result === ERR_INVALID_TARGET){
            console.log("combatReserve: Attacking Target Controller")
            this.combatAttackController(creep)
        }else if(result === ERR_NO_BODYPART){
            console.log("combatReserve: Creep "+creep.name+" does not have CLAIM part")
        }else if(result === ERR_INVALID_ARGS){
            console.log("combatReserve: Invalid Arguments")
        }
        return result
    },

    combatAttackController(creep){
        let controller = creep.room.find(FIND_STRUCTURES,{filter:(s) => s.structureType === STRUCTURE_CONTROLLER})
        let result = creep.attackController(controller[0])
        if(result === ERR_NOT_IN_RANGE){
            util.moveToTarget(creep,{showPath: creep.room.memory.showPath, pathColor: '#ffffff'},controller[0])
        }else if(result === ERR_INVALID_TARGET){

        }else if(result === ERR_NO_BODYPART){
            console.log("combatAttackController: Creep "+creep.name+" does not have CLAIM part")
        }else if(result === ERR_INVALID_ARGS){
            console.log("combatAttackController: Invalid Arguments")
        }
        return result
    },

    getAttackTarget(creep){
        let takenTargets = util.getCreepPropsByRole(creep.room,creep.memory.role,'target')
        takenTargets = takenTargets == null ? [] : takenTargets

        let targets = creep.room.find(FIND_CREEPS, {filter: (c) => !c.my && c.body.map(i => i.type).includes("ATTACK") })
        if(targets.length === 0){
            targets = creep.room.find(FIND_CREEPS, {filter: (c) => !c.my && !takenTargets.includes(c.id) })
        }
        if(targets.length === 0){
            targets = creep.room.find(FIND_STRUCTURES,{filter: (s) => !s.my && s.structureType !== STRUCTURE_WALL && s.structureType !== STRUCTURE_CONTROLLER && (s.hitsMax > 1000 || !takenTargets.includes(s.id))})
        }

        let target = creep.pos.findClosestByPath(targets,{algorithm: "astar"})
        return target
    }

}
