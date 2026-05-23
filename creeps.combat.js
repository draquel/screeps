/* eslint-disable no-undef */
const util = require("./util");

module.exports = {
  combatAttack(creep, target) {
    let result = creep.attack(target);
    if (result === ERR_NOT_IN_RANGE) {
      util.moveToTarget(
        creep,
        { showPath: creep.room.memory.showPath, pathColor: "#ff0000" },
        target,
      );
    } else if (result === ERR_INVALID_TARGET) {
      creep.memory.target = null;
    } else if (result === ERR_NO_BODYPART) {
      console.log(
        "combatAttack: Creep " + creep.name + " does not have ATTACK part",
      );
    } else if (result === ERR_INVALID_ARGS) {
      console.log("combatAttack: Invalid Arguments");
    }
    return result;
  },

  combatHeal(creep, target) {
    if (target.hits === target.hitsMax) {
      return;
    }

    let result = creep.heal(target);
    if (result === ERR_NOT_IN_RANGE) {
      util.moveToTarget(
        creep,
        { showPath: creep.room.memory.showPath, pathColor: "#00ff00" },
        target,
      );
    } else if (result === ERR_INVALID_TARGET) {
      creep.memory.target = null;
    } else if (result === ERR_NO_BODYPART) {
      console.log(
        "combatHeal: Creep " + creep.name + " does not have HEAL part",
      );
    } else if (result === ERR_INVALID_ARGS) {
      console.log("combatHeal: Invalid Arguments");
    }
    return result;
  },

  combatRanged(creep, target) {
    // Attack decision: mass attack when its damage exceeds a single 10-dmg shot.
    // rangedMassAttack does 10/4/1 to every hostile at range 1/2/3.
    //   2 enemies at r1 → 20 dmg (vs 10 single). Worth it.
    //   3 enemies at r2 → 12 dmg (vs 10 single). Worth it.
    const inRange = creep.pos.findInRange(FIND_HOSTILE_CREEPS, 3);
    const r1 = inRange.filter((c) => creep.pos.getRangeTo(c) <= 1);
    const r2 = inRange.filter((c) => creep.pos.getRangeTo(c) <= 2);
    const useMass = r1.length >= 2 || r2.length >= 3;

    let result;
    if (useMass) {
      result = creep.rangedMassAttack();
    } else if (target && creep.pos.inRangeTo(target, 3)) {
      result = creep.rangedAttack(target);
    }
    if (result === ERR_INVALID_TARGET) {
      creep.memory.target = null;
    } else if (result === ERR_NO_BODYPART) {
      console.log(
        "combatRanged: Creep " + creep.name + " does not have RANGED_ATTACK part",
      );
    } else if (result === ERR_INVALID_ARGS) {
      console.log("combatRanged: Invalid Arguments");
    }

    // Positioning: kite away from melee threats at range ≤ 2 so they can't
    // close to range 1 next tick. Otherwise approach the target to range 3.
    const meleeThreat = inRange
      .filter((c) => c.body.some((p) => p.type === ATTACK))
      .sort((a, b) => creep.pos.getRangeTo(a) - creep.pos.getRangeTo(b))[0];
    if (meleeThreat && creep.pos.getRangeTo(meleeThreat) <= 2) {
      const fleeDir = meleeThreat.pos.getDirectionTo(creep.pos);
      creep.move(fleeDir);
    } else if (target && !creep.pos.inRangeTo(target, 3)) {
      util.moveToTarget(
        creep,
        { showPath: creep.room.memory.showPath, pathColor: "#0000ff", range: 3 },
        target,
      );
    }
    return result;
  },

  combatClaim(creep) {
    let controller = creep.room.find(FIND_STRUCTURES, {
      filter: (s) => s.structureType === STRUCTURE_CONTROLLER,
    });
    let result = creep.claimController(controller[0]);
    if (result === ERR_NOT_IN_RANGE) {
      util.moveToTarget(
        creep,
        { showPath: creep.room.memory.showPath, pathColor: "#ffffff" },
        controller[0],
      );
    } else if (result === ERR_INVALID_TARGET && !controller.my) {
      console.log("combatClaim: Attacking Target Controller");
      this.combatAttackController(creep);
    } else if (result === ERR_NO_BODYPART) {
      console.log(
        "combatClaim: Creep " + creep.name + " does not have CLAIM part",
      );
    } else if (result === ERR_INVALID_ARGS) {
      console.log("combatClaim: Invalid Arguments");
    } else if (result === ERR_GCL_NOT_ENOUGH) {
      console.log("CombatClaim: GCL too low -> reserving room");
      this.combatReserve(creep);
    }
    return result;
  },

  combatReserve(creep) {
    let controller = creep.room.find(FIND_STRUCTURES, {
      filter: (s) => s.structureType === STRUCTURE_CONTROLLER,
    });
    let result = creep.reserveController(controller[0]);
    if (result === ERR_NOT_IN_RANGE) {
      util.moveToTarget(
        creep,
        { showPath: creep.room.memory.showPath, pathColor: "#ffffff" },
        controller[0],
      );
    } else if (result === ERR_INVALID_TARGET && !controller.my) {
      //let res = this.combatAttackController(creep);
      //console.log("combatReserve: Attacking Target Controller: "+res);
    } else if (result === ERR_NO_BODYPART) {
      console.log(
        "combatReserve: Creep " + creep.name + " does not have CLAIM part",
      );
    } else if (result === ERR_INVALID_ARGS) {
      console.log("combatReserve: Invalid Arguments");
    }
    return result;
  },

  combatAttackController(creep) {
    let controller = creep.room.find(FIND_STRUCTURES, {
      filter: (s) => s.structureType === STRUCTURE_CONTROLLER,
    });
    let result = creep.attackController(controller[0]);
    if (result === ERR_NOT_IN_RANGE) {
      util.moveToTarget(
        creep,
        { showPath: creep.room.memory.showPath, pathColor: "#ffffff" },
        controller[0],
      );
    } else if (result === ERR_INVALID_TARGET) {
      console.log("combatAttackController: Invalid Target");
    } else if (result === ERR_NO_BODYPART) {
      console.log(
        "combatAttackController: Creep " +
        creep.name +
        " does not have CLAIM part",
      );
    } else if (result === ERR_INVALID_ARGS) {
      console.log("combatAttackController: Invalid Arguments");
    }
    return result;
  },

  getAttackTarget(creep) {
    let takenTargets = util.getCreepPropsByRole(
      creep.room,
      creep.memory.role,
      "target",
    );
    takenTargets = takenTargets == null ? [] : takenTargets;

    let targets = creep.room.find(FIND_CREEPS, {
      filter: (c) =>
        !c.my &&
        (c.body.map((i) => i.type).includes("ATTACK") ||
          c.body.map((i) => i.type).includes("HEAL") ||
          c.body.map((i) => i.type).includes("RANGED_ATTACK")),
    });
    
    if (targets.length === 0) {
      targets = creep.room.find(FIND_CREEPS, {
        filter: (c) => !c.my && !takenTargets.includes(c.id),
      });
    }
    if (targets.length === 0) {
      targets = creep.room.find(FIND_STRUCTURES, {
        filter: (s) => !s.my &&  
          s.structureType !== STRUCTURE_ROAD &&
          s.structureType !== STRUCTURE_WALL &&
          s.structureType !== STRUCTURE_CONTAINER &&
          s.structureType !== STRUCTURE_CONTROLLER,
      });
    }
    /*
        if(targets.length === 0){
          targets = creep.room.find(FIND_STRUCTURES,{filter: (s) => !s.my && s.structureType === STRUCTURE_WALL})
        }
        */

    const reachableTargets = targets.filter((target) => {
      const path = creep.pos.findPathTo(target, {
        ignoreDestructibleStructures: false, 
        maxRooms: 1, 
      });
      return path.length > 0 || creep.pos.isNearTo(target);
    });

    let target = creep.pos.findClosestByPath(reachableTargets, { algorithm: "astar" });
    return target;
  },
};
