/* eslint-disable no-undef */
//const util = require("./util");
const work = require("./creeps.work");
const combat = require("./creeps.combat");
const util = require("./util");

module.exports = {
  run(creep) {
    //runOrder

    if (creep.memory.portalTarget !== undefined) {
      //console.log(creep.name+" has portal target")
      let target = Game.getObjectById(creep.memory.portalTarget);
      if (target !== null && target.structureType === STRUCTURE_PORTAL) {
        //console.log(creep.name+" found portal")
        util.moveToTarget(
          creep,
          { showPath: creep.memory.showPath, reusePath: 5, pathColor: "#FFF" },
          target,
        );
        return;
      }
    }

    this.runRole(creep);
  },

  /*
   *   ROLES
   */

  initRole(room, memory) {
    let res;
    switch (memory.role) {
      case "worker":
        res = this.initWorker(memory);
        break;
      case "miner":
        res = this.initMiner(room, memory);
        break;
      default:
        res = memory;
        break;
    }
    return res;
  },

  initMiner(room, memory) {
    if (memory.target != null && Game.getObjectById(memory.target) != null) {
      return memory;
    }

    var resource =
      memory.resourceTarget === undefined
        ? RESOURCE_ENERGY
        : memory.resourceTarget;
    let taken = util.getCreepPropsByRole(room, "miner", "target");
    let available = [];
    if (resource === RESOURCE_ENERGY) {
      let sources = room.find(FIND_SOURCES);
      for (var i = 0; i < sources.length; i++) {
        if (taken.includes(sources[i].id)) {
          continue;
        }
        available.push(sources[i].id);
      }
    } else {
      let mineral = room.find(FIND_MINERALS);
      if (mineral.length < 1) {
        return;
      }
      if (
        mineral[0].mineralType === resource &&
        !taken.includes(mineral[0].id)
      ) {
        available.push(mineral[0].id);
      }
    }

    /*
    let rmContainers = room.find(FIND_STRUCTURES, {
      filter: (s) => s.structureType === STRUCTURE_CONTAINER,
    });
    let taken = util.getCreepPropsByRole(room, "miner", "target");
    let available = [];
    for (let i = 0; i < rmContainers.length; i++) {
      if (taken.includes(rmContainers[i].id)) {
        continue;
      }

      let nearby = rmContainers[i].pos.findInRange(FIND_SOURCES, 1);
      if (nearby.length) {
        available.push(rmContainers[i].id);
      }
    }
    */

    if (available.length) {
      memory.target = available[0];
    }

    return memory;
  },

  initWorker(memory) {
    if (memory.target != null && Game.getObjectById(memory.target) != null) {
      return memory;
    }
    memory.eligibility = {
      base: true,
      repair: true,
      build: true,
      ramparts: true,
    };
    memory.rechargeTargets = {
      drops: true,
      tombs: true,
      ruins: true,
      sources: true,
      containers: true,
      storages: true,
      links: true,
    };
    return memory;
  },

  runRole(creep) {
    switch (creep.memory.role) {
      case "scout":
        this.runScout(creep);
        break;
      case "worker":
        this.runWorker(creep);
        break;
      case "harvester":
        this.runHarvester(creep);
        break;
      case "miner":
        this.runMiner(creep);
        break;

      case "transporter":
        this.runTransporter(creep);
        break;
      case "transporter2":
        this.runTransporter2(creep);
        break;

      case "healer":
        this.runHealer(creep);
        break;
      case "attack":
        this.runAttack(creep);
        break;
      case "defend":
        this.runDefend(creep);
        break;
      case "claimer":
        this.runClaimer(creep);
        break;
    }
  },

  runScout(creep) {
    if (creep.memory.working) {
      if (this.moveToRoom(creep)) {
        creep.memory.working = false;
      }
    } else {
      if (this.inTargetRoom(creep)) {
        util.patrol(creep)
        //let target = creep.room.controller;
        //if (target != null) {
        //  creep.moveTo(target);
        //}
      }
    }
  },

  runWorker(creep) {
    if (creep.memory.working && creep.store[RESOURCE_ENERGY] === 0) {
      creep.memory.working = false;
      creep.memory.targetDeposit = null;
      creep.say("⚡ Recharge");
    }
    if (!creep.memory.working && creep.store.getFreeCapacity() === 0) {
      creep.memory.working = true;
      creep.memory.targetCollect = null;
      creep.say("🔨 Work");
    }

    if (creep.memory.targetRoom != null && !this.inTargetRoom(creep)) {
      this.moveToRoom(creep);
      return;
    } else if (creep.memory.targetRoom == null && !this.inHomeRoom(creep)) {
      this.moveToHome(creep);
      return;
    }

    if (creep.memory.working) {
      let energyTargets = {
        terminal: false,
        storages: false,
        containers: false,
        links: false,
      };

      if (
        creep.store[RESOURCE_ENERGY] < creep.store.getCapacity() * 0.1 &&
        creep.memory.targetDeposit === null
      ) {
        creep.memory.working = false;
        creep.say("⚡ Recharge");
        return;
      }

      if (creep.memory.eligibility.base) {
        if (work.refillBaseEnergy(creep, energyTargets)) {
          return;
        }
      }

      if (creep.memory.eligibility.repair) {
        if (work.maintainBaseStructures(creep)) {
          return;
        }
      }

      if (creep.memory.eligibility.ramparts) {
        if (work.maintainBaseRamparts(creep)) {
          return;
        }
      }

      if (creep.memory.eligibility.build) {
        if (work.buildConstructionSites(creep)) {
          return;
        }
      }

      work.workerUpgrade(creep);
    } else {
      //let energyTargets = { drops: true, tombs: true, sources: true, containers: true, storages: true, ruins: true}
      work.collectResource(creep, creep.memory.rechargeTargets);
    }
  },

  runHarvester(creep) {
    if (creep.memory.working && creep.store.getFreeCapacity() === 0) {
      creep.memory.working = false;
      creep.memory.targetCollect = null;
      creep.say("🚚 Deliver");
    }
    if (!creep.memory.working && creep.store.getUsedCapacity() === 0) {
      creep.memory.working = true;
      creep.memory.targetDeposit = null;
      creep.say("🔄 Harvest");
    }

    let resource =
      creep.memory.targetResource === undefined
        ? RESOURCE_ENERGY
        : creep.memory.targetResource;

    if (creep.memory.working) {
      if (creep.memory.targetRoom != null && !this.inTargetRoom(creep)) {
        this.moveToRoom(creep);
        return;
      } else if (creep.memory.targetRoom == null && !this.inHomeRoom(creep)) {
        this.moveToHome(creep);
        return;
      }

      work.collectResource(
        creep,
        {
          sources: true,
          drops: true,
          tombs: true,
          deposits: true,
        },
        resource,
      );
    } else {
      if (!this.inHomeRoom(creep)) {
        this.moveToHome(creep);
        return;
      }
      if (
        !work.depositResources(
          creep,
          {
            factory: true,
            terminal: true,
            links: false,
            storages: false,
            containers: false,
          },
          resource,
        )
      ) {
        work.depositResources(
          creep,
          {
            terminal: false,
            links: true,
            labs: false,
            storages: true,
            containers: false,
          },
          resource,
        );
      }
    }
  },

  runTransporter(creep) {
    let resource = this.getTargetResource(creep);
    if (creep.memory.working && creep.store.getUsedCapacity() === 0) {
      creep.memory.working = false;
      creep.memory.targetDeposit = null;
      creep.say("🛻 Load");
    }
    if (!creep.memory.working && creep.store.getFreeCapacity() === 0) {
      creep.memory.working = true;
      creep.memory.targetCollect = null;
      creep.say("🚚 Deliver");
    }

    if (creep.memory.working) {
      if (
        !work.depositResources(
          creep,
          {
            factory: true,
            terminal: true,
            links: false,
            storages: false,
            containers: false,
          },
          resource,
        )
      ) {
        work.depositResources(
          creep,
          {
            terminal: false,
            links: false,
            labs: false,
            storages: true,
            containers: false,
          },
          resource,
        );
      }
    } else {
      let targets = creep.room.find(FIND_STRUCTURES, {
        algorithm: "astar",
        filter: (s) => {
          return (
            (s.structureType === STRUCTURE_SPAWN &&
              s.store.getFreeCapacity(resource) > 0) ||
            (s.structureType === STRUCTURE_EXTENSION &&
              s.store.getFreeCapacity(resource) > 0) ||
            (s.structureType === STRUCTURE_TOWER &&
              s.store.getFreeCapacity(resource) > 250) ||
            (s.structureType === STRUCTURE_TERMINAL &&
              s.store.getFreeCapacity(resource) > 0 &&
              s.store.getUsedCapacity(resource) < 10000) ||
            (resource === RESOURCE_ENERGY &&
              s.structureType === STRUCTURE_LAB &&
              s.store.getFreeCapacity(RESOURCE_ENERGY) > 0)
          );
        },
      });
      let controllerUnder5 =
        creep.room.controller != null && creep.room.controller.level < 5;

      work.collectResource(
        creep,
        {
          drops: controllerUnder5,
          tombs: controllerUnder5,
          links: true,
          sources: false,
          containers: controllerUnder5 || resource !== RESOURCE_ENERGY,
          storages: targets.length > 0,
        },
        resource,
      );
    }
  },

  runTransporter2(creep) {
    if (creep.memory.working && creep.store.getUsedCapacity() === 0) {
      creep.memory.working = false;
      creep.memory.targetDeposit = null;
      creep.say("🛻 Load");
    }
    if (!creep.memory.working && creep.store.getFreeCapacity() === 0) {
      creep.memory.working = true;
      creep.memory.targetCollect = null;
      creep.say("🚚 Deliver");
    }

    let baseRecharge = false;
    let targets = creep.room.find(FIND_STRUCTURES, {
      algorithm: "astar",
      filter: (s) => {
        return (
          (((s.structureType === STRUCTURE_SPAWN &&
            s.store.getFreeCapacity(RESOURCE_ENERGY) > 0) ||
            (s.structureType === STRUCTURE_EXTENSION &&
              s.store.getFreeCapacity(RESOURCE_ENERGY) > 0) ||
            s.structureType === STRUCTURE_TOWER) &&
            s.store.getFreeCapacity(RESOURCE_ENERGY) > 250) ||
          (s.structureType === STRUCTURE_TERMINAL &&
            s.store.getFreeCapacity(RESOURCE_ENERGY) > 0 &&
            s.store.getUsedCapacity(RESOURCE_ENERGY) < 10000) ||
          (s.structureType === STRUCTURE_LAB &&
            s.store.getFreeCapacity(RESOURCE_ENERGY) > 0)
        );
      },
    });
    if (targets.length) {
      //baseRecharge = true;
    }

    if (creep.memory.working) {
      let resources = Object.keys(creep.store).map((type) => ({
        resource: type,
        amount: creep.store[type],
      }));
      resources.sort((a, b) => {
        b.amount - a.amount;
      });
      let resource = resources[0].resource;

      //console.log(creep.name+" is trying to deposit "+resource)
      if (
        !work.depositResources(
          creep,
          {
            factory: true,
            terminal: true,
            links: false,
            storages: false,
            containers: false,
          },
          resource,
        )
      ) {
        work.depositResources(
          creep,
          {
            terminal: false,
            links: false,
            labs: false,
            storages: true,
            containers: false,
          },
          resource,
        );
      }
    } else {
      if (
        creep.memory.target &&
        Game.getObjectById(creep.memory.targetCollect)
      ) {
        if (
          Game.getObjectById(creep.memory.targetCollect).store.getUsedCapacity()
        ) {
          work.collectTargetResource(creep, target, resource);
          return;
        }
      }

      let taken = util.getCreepProp(
        creep.room.find(FIND_MY_CREEPS),
        "targetCollect",
      );
      let targets = [];
      let options = {
        storages: true,
        drops: true,
        tombs: true,
        containers: true,
        links: true,
      };

      if (options.storages && baseRecharge) {
        let storages = creep.room.find(FIND_STRUCTURES, {
          filter: (s) => s.structureType == STRUCTURE_STORAGE,
        });
        targets.push(...storages);
      }
      if (options.drops) {
        let drops = creep.room.find(FIND_DROPPED_RESOURCES, {
          filter: (d) => !taken.includes(d.id),
        });
        targets.push(...drops);
      }
      if (options.tombs) {
        let tombs = creep.room.find(FIND_TOMBSTONES, {
          filter: (t) => t.store.getUsedCapacity() > 0 && !taken.includes(t.id),
        });
        targets.push(...tombs);
      }
      if (options.containers) {
        let containers;
        if (baseRecharge) {
          containers = creep.room.find(FIND_STRUCTURES, {
            filter: (s) => {
              return (
                s.structureType === STRUCTURE_CONTAINER &&
                s.store.getUsedCapacity(RESOURCE_ENERGY) >
                (taken.filter((currentItem) => currentItem === s.id).length +
                  1) *
                creep.store.getFreeCapacity()
              );
            },
          });
        } else {
          containers = creep.room.find(FIND_STRUCTURES, {
            filter: (s) => {
              return (
                s.structureType === STRUCTURE_CONTAINER &&
                s.store.getUsedCapacity() >
                (taken.filter((currentItem) => currentItem === s.id).length +
                  1) *
                creep.store.getFreeCapacity()
              );
            },
          });
        }
        targets.push(...containers);
      }
      if (options.links) {
        let links = creep.room.find(FIND_STRUCTURES, {
          filter: (s) => {
            return (
              s.structureType === STRUCTURE_LINK &&
              s.id === creep.room.memory.targetLink &&
              s.store.getUsedCapacity() > 80
            );
          },
        });
        targets.push(...links);
      }

      if (targets.length) {
        let target = creep.pos.findClosestByPath(targets);
        let resource;
        if (baseRecharge) {
          resource = RESOURCE_ENERGY;
        } else {
          if (target instanceof Resource) {
            resource = target.resourceType;
          } else {
            let resources = Object.keys(target.store).map((type) => ({
              resource: type,
              amount: creep.store[type],
            }));
            resources.sort((a, b) => {
              b.amount - a.amount;
            });
            resource = resources[0].resource;
          }
        }
        //console.log(creep.name+" is trying to collect "+resource+" from "+target.id)
        work.collectTargetResource(creep, target, resource);
      }
    }
  },

  runMiner(creep) {
    let resource = this.getTargetResource(creep);
    if (creep.memory.working && creep.store.getFreeCapacity() === 0) {
      creep.memory.working = false;
      //creep.say('🚚 Deliver');
    }
    if (!creep.memory.working && creep.store[resource] === 0) {
      creep.memory.working = true;
      //creep.say('🔦 Mining');
    }

    let target;
    if (!creep.memory.target) {
      let taken = util.getCreepProp(creep.room.find(FIND_MY_CREEPS), "target");
      if (resource === RESOURCE_ENERGY) {
        target = creep.pos.findClosestByPath(creep.room.sources, {
          filter: (s) => {
            return !taken.includes(s.id);
          },
          algorithm: "astar",
        });
      } else {
        target = creep.pos.findClosestByPath(FIND_MINERALS, {
          filter: (s) => {
            return !taken.includes(s.id);
          },
          algorithm: "astar",
        });
      }
      creep.memory.target = target != null ? target.id : null;
    } else {
      target = Game.getObjectById(creep.memory.target);
    }

    if (creep.memory.working && target != null) {
      work.workerHarvest(creep, target);
    } else {
      let link = creep.pos.findClosestByRange(FIND_STRUCTURES, {
        filter: (s) => {
          return (
            s.structureType === STRUCTURE_LINK &&
            s.store.getFreeCapacity(resource) > 0
          );
        },
      });
      if (link != null && creep.pos.inRangeTo(link.pos.x, link.pos.y, 2)) {
        res = work.workerTransfer(creep, link);
      } else {
        let container = creep.pos.findClosestByRange(FIND_STRUCTURES, {
          filter: (s) => {
            return s.structureType === STRUCTURE_CONTAINER;
          },
        });
        if (
          container &&
          creep.pos.inRangeTo(container.pos.x, container.pos.y, 2) &&
          creep.store.getUsedCapacity(resource) > 0
        ) {
          work.workerTransfer(creep, container, resource);
        }
      }
    }
  },

  runClaimer(creep) {
    if (creep.memory.targetRoom != null && !this.inTargetRoom(creep)) {
      this.moveToRoom(creep);
      return;
    }

    var mode = creep.memory.mode === undefined ? "claim" : creep.memory.mode;
    if (mode == "claim") {
      if (creep.room.controller.my) {
        console.log(creep.name + " Claimed " + creep.room.controller.room.name);
        creep.suicide();
        return;
      }
      combat.combatClaim(creep);
    } else if (mode == "reserve") {
      if (creep.room.controller.reservation) {
        if (creep.room.controller.reservation.ticksToEnd > 4990) {
          console.log(
            creep.name + " Reserved " + creep.room.controller.room.name,
          );
          creep.suicide();
          return;
        }
      }
      combat.combatReserve(creep);
    }
  },

  runHealer(creep) {
    if (creep.memory.fighting && creep.memory.target === null) {
      creep.memory.fighting = false;
      creep.say("🚚 Defend");
    }
    if (!creep.memory.fighting && creep.memory.target !== null) {
      creep.memory.fighting = true;
      creep.say("🔦 Attack");
    }

    if (creep.memory.fighting) {
      let targetObj = Game.creeps[creep.memory.target];
      if (targetObj != null) {
        if (this.moveToRoom(creep, targetObj.room.name)) {
          combat.combatHeal(creep, targetObj);
        }
      }
    } else {
      //not fighting
    }
  },

  runDefend(creep) {
    if (creep.memory.fighting && creep.memory.target === null) {
      creep.memory.fighting = false;
      creep.say("🚚 Defend");
    }
    if (!creep.memory.fighting && creep.memory.target !== null) {
      creep.memory.fighting = true;
      creep.say("🔦 Attack");
    }

    if (creep.memory.fighting) {
      let targetObj = Game.getObjectById(creep.memory.target);
      if (targetObj != null) {
        combat.combatAttack(creep, targetObj);
      } else {
        creep.memory.target = null;
      }
    } else {
      let target = combat.getAttackTarget(creep);
      if (target != null) {
        creep.memory.target = target.id;
      } else {
        //fallback behavior
      }
    }
  },

  runAttack(creep) {
    if (creep.memory.fighting && creep.memory.target === null) {
      creep.memory.fighting = false;
      //creep.say('🚚 Defend');
    }
    if (!creep.memory.fighting && creep.memory.target !== null) {
      creep.memory.fighting = true;
      creep.say("🔦 Attack");
    }

    if (creep.memory.targetRoom != null && !this.inTargetRoom(creep)) {
      this.moveToRoom(creep);
      return;
    } else if (creep.memory.targetRoom == null && !this.inHomeRoom(creep)) {
      this.moveToHome(creep);
      return;
    }

    if (creep.memory.fighting) {
      if (this.moveToRoom(creep)) {
        let targetObj = Game.getObjectById(creep.memory.target);
        //console.log(creep.name + ' Attacking '+ targetObj.name == null ? targetObj.id : targetObj.name )
        if (targetObj != null) {
          combat.combatAttack(creep, targetObj);
        } else {
          creep.memory.target = null;
        }
      }
    } else {
      let target = combat.getAttackTarget(creep);
      if (target != null) {
        creep.memory.target = target.id;
      } else {
        //fallback behavior
        //patrol
        util.patrol(creep);
        /*
        if(!creep.memory.patrolTarget){
          creep.memory.patrolTarget = 0
        }

        let pt = Game.getObjectById(creep.memory.patrolRoute[creep.memory.patrolTarget])
        console.log(creep.name+" patrol target: "+pt.id)
        if(!creep.pos.inRangeTo(pt,4)){
          util.moveToTarget(creep,{showPath: creep.room.memory.showPath, pathColor: '#ff8000'},pt)
        }else{
          creep.memory.patrolTarget++
          if(creep.memory.patrolTarget >= creep.memory.patrolRoute.length){
            creep.memory.patrolTarget = 0;
          }
        }
        */
      }
    }
  },

  /*
   *   Room Nav
   */

  inTargetRoom(creep, room = creep.memory.targetRoom) {
    return creep.room.name === room;
  },

  inHomeRoom(creep) {
    return creep.room.name === creep.memory.room;
  },

  moveToHome(creep) {
    return this.moveToRoom(creep, creep.memory.room);
  },

  moveToRoom(creep, room = creep.memory.targetRoom) {
    if (
      creep.memory.currentRoom !== creep.room.name &&
      (creep.pos.x * creep.pos.y === 0 ||
        creep.pos.x === 49 ||
        creep.pos.y === 49)
    ) {
      creep.moveTo(new RoomPosition(25, 25, creep.room.name));
      creep.memory.currentRoom = creep.room.name;
    }
    if (!this.inTargetRoom(creep, room)) {
      util.moveToTarget(
        creep,
        {
          showPath: creep.room.memory.showPath,
          pathColor: "#0c02d1",
          reusePath: 10,
        },
        creep.pos.findClosestByPath(creep.room.findExitTo(room), {
          algorithm: "astar",
        }),
      );
      //console.log('moveToRoom: Moving To Room '+creep.memory.targetRoom)
      return false;
    } else {
      //console.log('moveToRoom: Found Room '+creep.memory.targetRoom)
      return true;
    }
  },

  getTargetResource(creep) {
    return creep.memory.targetResource == null
      ? RESOURCE_ENERGY
      : creep.memory.targetResource;
  },
};
