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
      case "mineralMiner":
        res = this.initMineralMiner(room, memory);
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

  initMineralMiner(room, memory) {
    if (memory.target != null && Game.getObjectById(memory.target) != null) {
      return memory;
    }
    let mineral = room.find(FIND_MINERALS).shift();
    if (!mineral) return memory;
    if (memory.resourceTarget === undefined) {
      memory.resourceTarget = mineral.mineralType;
    }
    if (mineral.mineralType === memory.resourceTarget) {
      memory.target = mineral.id;
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
      case "mineralMiner":
        this.runMiner(creep);
        break;

      case "transporter":
        this.runTransporter(creep);
        break;
      case "transporter2":
        this.runTransporter2(creep);
        break;
      case "mineralTransporter":
        this.runMineralTransporter(creep);
        break;
      case "healer":
        this.runHealer(creep);
        break;
      case "attack":
        this.runAttack(creep);
        break;
      case "ranged":
        this.runRanged(creep);
        break;
      case "defender":
        this.runDefender(creep);
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
        util.patrol(creep);
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
        // In the harvest target room, spend a bounded slice of the load on local
        // build/repair, then carry the reserve home. The reserve is what prevents
        // the maintain→empty→harvest→maintain cycle that would trap the creep here.
        const reserve = creep.store.getCapacity() * 0.75;
        if (
          resource === RESOURCE_ENERGY &&
          this.inTargetRoom(creep) &&
          creep.store[resource] > reserve
        ) {
          if (work.buildConstructionSites(creep)) {
            return;
          }
          if (work.maintainBaseStructures(creep)) {
            return;
          }
        }
        this.moveToHome(creep);
        return;
      }
      let depositGroupA = {
            factory: true,
            terminal: true,
            links: false,
            storages: false,
            containers: false,
      };
      let depositGroupB = {
            terminal: false,
            links: true,
            labs: false,
            storages: true,
            containers: false,
      };

      if (work.depositResources(creep, depositGroupA, resource)) {
        return;
      }
      if(work.depositResources(creep, depositGroupB, resource)){
        return;
      }
      if (work.maintainBaseStructures(creep)) {
        return;
      }  
      if (work.buildConstructionSites(creep)) {
        return;
      }
      if(creep.store.getFreeCapacity(resource) > creep.store.getCapacity()*0.9){
        creep.memory.working  = true;
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
            labs:true,
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
            factory: false,
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
              s.store.getUsedCapacity(resource) < 50000) ||
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

    // Stationary work tile: opt out of being shoved by the traffic manager once
    // we're within harvest range, and re-enable shoving while we're still en route.
    if (target != null && creep.pos.inRangeTo(target.pos, 1)) {
      creep.memory.noShove = true;
    } else if (creep.memory.noShove) {
      delete creep.memory.noShove;
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

  runMineralTransporter(creep) {
    if (creep.memory.working && creep.store.getUsedCapacity() === 0) {
        creep.memory.working = false;
        creep.memory.targetDeposit = null;
        creep.memory.foreignMoveResource = null;
        creep.memory.foreignMoveMode = null;
        creep.memory.drainResource = null;
        creep.memory.labFillResource = null;
        creep.memory.factoryFeedResource = null;
        creep.say("🛻 Load");
    }
    if (!creep.memory.working && creep.store.getFreeCapacity() === 0) {
        creep.memory.working = true;
        creep.memory.targetCollect = null;
        creep.say("🚚 Deliver");
    }
    
    let roomMineral = creep.room.mineral ? creep.room.mineral.mineralType : null;

    if (creep.memory.working) {
        let carried = Object.keys(creep.store).filter(r => creep.store[r] > 0);
        if (!carried.length) return;

        // Priority 1: drain resource goes to storage
        let drainResource = creep.memory.drainResource;
        if (drainResource && carried.includes(drainResource)) {
            if (creep.room.storage && creep.room.storage.store.getFreeCapacity() > 0) {
                work.workerTransfer(creep, creep.room.storage, drainResource);
                return;
            }
            if (creep.room.terminal && creep.room.terminal.store.getFreeCapacity() > 0) {
                work.workerTransfer(creep, creep.room.terminal, drainResource);
                return;
            }
        }
        creep.memory.drainResource = null;

        // Priority 2: factory feed resource goes to factory if still needed
        let factoryFeedResource = creep.memory.factoryFeedResource;
        if (factoryFeedResource && carried.includes(factoryFeedResource)) {
            let factory = creep.room.factory;
            if (factory && factory.store.getFreeCapacity() > 0) {
                work.workerTransfer(creep, factory, factoryFeedResource);
                return;
            }
        }
        creep.memory.factoryFeedResource = null;

        // Priority 3: lab fill resource goes to lab if still needed
        let labResource = carried.find(r => this.getRoomLabResource(creep.room, r) != null);
        if (labResource) {
            let lab = this.getRoomLabResource(creep.room, labResource);
            if (lab) {
                let target = lab.memory.amount || 2000;
                let current = lab.store[labResource] || 0;
                if (current < target && lab.store.getFreeCapacity(labResource) > 0) {
                    work.workerTransfer(creep, lab, labResource);
                    return;
                }
            }
        }

        // Priority 4: room mineral tops up terminal to cap
        if (roomMineral && carried.includes(roomMineral)) {
            let terminal = creep.room.terminal;
            if (terminal) {
                let terminalHeld = terminal.store[roomMineral] || 0;
                let terminalCap = creep.room.memory.mineralTerminalCap || 25000;
                if (terminalHeld < terminalCap) {
                    if (terminal.store.getFreeCapacity() > 0) {
                        work.workerTransfer(creep, terminal, roomMineral);
                        return;
                    } else {
                        creep.memory.targetDeposit = null;
                        console.log(creep.name+": Terminal full, holding "+roomMineral+" in storage temporarily");
                    }
                }
            }
        }

        // Priority 5: foreign mineral routes based on mode
        let foreignMoveResource = creep.memory.foreignMoveResource;
        let foreignMoveMode = creep.memory.foreignMoveMode;
        if (foreignMoveResource && carried.includes(foreignMoveResource)) {
            if (foreignMoveMode === 'toTerminal') {
                let terminal = creep.room.terminal;
                if (terminal && terminal.store.getFreeCapacity() > 0) {
                    work.workerTransfer(creep, terminal, foreignMoveResource);
                    return;
                }
            } else {
                if (creep.room.storage && creep.room.storage.store.getFreeCapacity() > 0) {
                    work.workerTransfer(creep, creep.room.storage, foreignMoveResource);
                    return;
                }
            }
            creep.memory.foreignMoveResource = null;
            creep.memory.foreignMoveMode = null;
        }

        // Catch-all: anything else to storage
        if (creep.room.storage && creep.room.storage.store.getFreeCapacity() > 0) {
            let resource = carried.reduce((a, b) => creep.store[a] >= creep.store[b] ? a : b);
            work.workerTransfer(creep, creep.room.storage, resource);
            return;
        }

    } else {
        // Always clear job flags at the start of every collect cycle
        creep.memory.foreignMoveResource = null;
        creep.memory.foreignMoveMode = null;
        creep.memory.drainResource = null;
        creep.memory.labFillResource = null;
        creep.memory.factoryFeedResource = null;

        // Priority 1: drain labs with wrong or unassigned contents
        let drainTarget = this.getLabDrainTarget(creep);
        if (drainTarget) {
            creep.memory.drainResource = drainTarget.resource;
            work.collectResource(creep, {
                storages: false, containers: false, terminals: false,
                drops: false, tombs: false, links: false, sources: false, labs: true,
            }, drainTarget.resource);
            return;
        }

        // Priority 2: fill input/booster labs that need topping up
        let labTarget = this.getLabFillTargetRaw(creep.room);
        if (labTarget) {
            creep.memory.labFillResource = labTarget.resource;
            work.collectResource(creep, {
                storages: true, containers: false, terminals: true,
                ignoreTerminalThresholds: true,
                drops: false, tombs: false, links: false, sources: false,
            }, labTarget.resource);
            return;
        }

        // Priority 3: drain output labs above their threshold to storage
        let productDrain = this.getLabProductDrainTarget(creep.room);
        if (productDrain) {
            work.collectResource(creep, {
                storages: false, containers: false, terminals: false,
                drops: false, tombs: false, links: false, sources: false, outputLabs: true,
            }, productDrain.resource);
            return;
        }

        // Priority 4: feed factory inputs from storage/terminal
        let factoryNeed = this.getFactoryInputNeed(creep.room);
        if (factoryNeed) {
            creep.memory.factoryFeedResource = factoryNeed.resource;
            work.collectResource(creep, {
                storages: true, containers: false, terminals: true,
                ignoreTerminalThresholds: true,
                drops: false, tombs: false, links: false, sources: false,
            }, factoryNeed.resource);
            return;
        }

        // Priority 5: drain factory output / stale ingredients to storage
        let factoryDrain = this.getFactoryDrainTarget(creep.room);
        if (factoryDrain) {
            work.collectResource(creep, {
                storages: false, containers: false, terminals: false,
                drops: false, tombs: false, links: false, sources: false, factories: true,
            }, factoryDrain.resource);
            return;
        }

        // Priority 6: drain miner containers, and top up terminal from storage when needed
        if (roomMineral) {
            let terminal = creep.room.terminal;
            let terminalHeld = terminal ? (terminal.store[roomMineral] || 0) : 0;
            let terminalCap = creep.room.memory.mineralTerminalCap || 25000;
            let hasInContainers = creep.room.find(FIND_STRUCTURES, {
                filter: s => s.structureType === STRUCTURE_CONTAINER && (s.store[roomMineral] || 0) > 0
            }).length > 0;
            let hasInStorage = creep.room.storage && (creep.room.storage.store[roomMineral] || 0) > 0;
            let wantFromStorage = terminalHeld < terminalCap && hasInStorage;
            if (hasInContainers || wantFromStorage) {
                work.collectResource(creep, {
                    storages: wantFromStorage, containers: hasInContainers, relaxedContainers: true,
                    terminals: false, drops: false, tombs: false, links: false, sources: false,
                }, roomMineral);
                return;
            }
        }

        // Priority 7: manage foreign minerals
        if (creep.room.terminal && creep.room.storage) {
            let foreignSellThreshold = creep.room.memory.foreignMineralSellThreshold || 10000;
            let foreignSellBuffer = creep.room.memory.foreignMineralSellBuffer || 2000;

            // Build a combined picture of all foreign minerals across both terminal and storage
            let allForeignResources = new Set([
                ...Object.keys(creep.room.terminal.store),
                ...Object.keys(creep.room.storage.store)
            ].filter(r => r !== RESOURCE_ENERGY && r !== roomMineral));

            // First pass: find anything over threshold + buffer - push storage portion to terminal
            let excessForeign = Array.from(allForeignResources).find(r => {
                let storageAmount = creep.room.storage.store[r] || 0;
                let terminalAmount = creep.room.terminal.store[r] || 0;
                let combined = storageAmount + terminalAmount;
                // Only collect from storage if storage actually has some to move
                return combined > foreignSellThreshold + foreignSellBuffer && storageAmount > 0;
            });

            if (excessForeign) {
                creep.memory.foreignMoveResource = excessForeign;
                creep.memory.foreignMoveMode = 'toTerminal';
                work.collectResource(creep, {
                    storages: true, containers: false, terminals: false,
                    drops: false, tombs: false, links: false, sources: false,
                }, excessForeign);
                return;
            }

            // Second pass: find anything under threshold in terminal to move to storage
            let inboundForeign = Array.from(allForeignResources).find(r => {
                let terminalAmount = creep.room.terminal.store[r] || 0;
                if (terminalAmount <= 0) return false;
                let storageAmount = creep.room.storage.store[r] || 0;
                let combined = storageAmount + terminalAmount;
                // Pull into storage only when combined total is safely under threshold
                return combined <= foreignSellThreshold;
            });

            if (inboundForeign) {
                creep.memory.foreignMoveResource = inboundForeign;
                creep.memory.foreignMoveMode = 'toStorage';
                work.collectResource(creep, {
                    storages: false, containers: false, terminals: true,
                    drops: false, tombs: false, links: false, sources: false,
                }, inboundForeign);
                return;
            }
        }

        // Priority 8: loose minerals from containers or drops
        let looseMineral = this.getLooseMineralTarget(creep, roomMineral);
        if (looseMineral) {
            work.collectResource(creep, {
                storages: false, containers: true, relaxedContainers: true,
                terminals: false, drops: true, tombs: true, links: false, sources: false,
            }, looseMineral);
            return;
        }

        // No collect target found - if we're already carrying something, deliver it
        if (creep.store.getUsedCapacity() > 0) {
            creep.memory.working = true;
            creep.memory.targetCollect = null;
            creep.say("🚚 Deliver");
        }
    }
},  // Used in collect phase - checks raw lab need without enRoute adjustment
//  Only considers input/booster labs - output labs accumulate from reactions, not transporter fills
getLabFillTargetRaw(room) {
    let labs = room.find(FIND_MY_STRUCTURES, {
        filter: s => s.structureType === STRUCTURE_LAB && s.memory.role !== 'output'
    });
    for (let lab of labs) {
        let resource = lab.memory.resource;
        if (!resource) continue;
        let target = lab.memory.amount || 2000;
        let current = lab.store[resource] || 0;
        if (current >= target) continue;
        // Skip labs we can't actually source from: collectResource will return
        // empty, but Priority 2 returns unconditionally and we'd loop forever
        // here, blocking lower-priority work (miner container drains, foreign
        // mineral management, etc.). Only flag labs whose resource exists in
        // storage or terminal.
        let inStorage = room.storage ? (room.storage.store[resource] || 0) : 0;
        let inTerminal = room.terminal ? (room.terminal.store[resource] || 0) : 0;
        if (inStorage + inTerminal === 0) continue;
        return { lab, resource };
    }
    return null;
},

// Used in working phase - accounts for what creep is already carrying
getLabFillTarget(creep) {
    let labs = creep.room.find(FIND_MY_STRUCTURES, {
        filter: s => s.structureType === STRUCTURE_LAB && s.memory.role !== 'output'
    });
    for (let lab of labs) {
        let resource = lab.memory.resource;
        if (!resource) continue;
        let target = lab.memory.amount || 2000;
        let current = lab.store[resource] || 0;
        let enRoute = creep.store[resource] || 0;
        if (current + enRoute < target) {
            return { lab, resource };
        }
    }
    return null;
},
  // Returns the first input/booster lab assigned to a resource, or null
  // Output labs are excluded so working-phase deposits don't loop product back into the output.
  getRoomLabResource(room, resource) {
    let labs = room.find(FIND_MY_STRUCTURES, {
      filter: (s) =>
        s.structureType === STRUCTURE_LAB
        && s.memory.role !== 'output'
        && s.memory.resource === resource,
    });
    return labs.length ? labs[0] : null;
  },

  // Returns { lab, resource } for the first output lab whose product is at/over drain threshold
  getLabProductDrainTarget(room) {
    let labs = room.find(FIND_MY_STRUCTURES, {
      filter: (s) =>
        s.structureType === STRUCTURE_LAB
        && s.memory.role === 'output'
        && s.memory.resource,
    });
    for (let lab of labs) {
      let resource = lab.memory.resource;
      let threshold = lab.memory.drainThreshold || 1500;
      if ((lab.store[resource] || 0) >= threshold) {
        return { lab, resource };
      }
    }
    return null;
  },

  // Returns { resource, factory } for the first under-staged factory input, or null
  getFactoryInputNeed(room) {
    let factory = room.factory;
    if (!factory) return null;
    let target = factory.memory.target;
    if (!target) return null;
    let recipe = COMMODITIES[target];
    if (!recipe) return null;

    for (let resource in recipe.components) {
      if (resource === RESOURCE_ENERGY) continue;
      let need = recipe.components[resource];
      let cap = factory.memory.inputCap !== undefined ? factory.memory.inputCap : need * 4;
      let have = factory.store[resource] || 0;
      if (have >= cap) continue;
      let available = (room.storage ? (room.storage.store[resource] || 0) : 0)
                    + (room.terminal ? (room.terminal.store[resource] || 0) : 0);
      if (available > 0) return { resource, factory };
    }
    return null;
  },

  // Returns { factory, resource } for the first thing in the factory we want out:
  // the produced commodity, or stale ingredients not in the current recipe.
  getFactoryDrainTarget(room) {
    let factory = room.factory;
    if (!factory) return null;
    let target = factory.memory.target;
    let recipe = target ? COMMODITIES[target] : null;

    for (let resource in factory.store) {
      if ((factory.store[resource] || 0) === 0) continue;
      if (resource === RESOURCE_ENERGY) continue;
      if (resource === target) return { factory, resource };
      if (!recipe || !recipe.components[resource]) return { factory, resource };
    }
    return null;
  },

  // Returns the resource type of the best loose mineral target, or null
  getLooseMineralTarget(creep, roomMineral) {
    let drops = creep.room.find(FIND_DROPPED_RESOURCES, {
      filter: (d) => d.resourceType !== RESOURCE_ENERGY,
    });
    if (drops.length) return drops[0].resourceType;

    let tombs = creep.room.find(FIND_TOMBSTONES, {
      filter: (t) =>
        Object.keys(t.store).some(
          (r) => r !== RESOURCE_ENERGY && t.store[r] > 0,
        ),
    });
    if (tombs.length) {
      let resource = Object.keys(tombs[0].store).find(
        (r) => r !== RESOURCE_ENERGY && tombs[0].store[r] > 0,
      );
      return resource || null;
    }

    return null;
  },
  // Returns { lab, resource } for the first lab that contains a resource
  // that doesn't match its assigned memory.resource, or null
  getLabDrainTarget(creep) {
    let labs = creep.room.find(FIND_MY_STRUCTURES, {
      filter: (s) => s.structureType === STRUCTURE_LAB,
    });
    for (let lab of labs) {
      let assigned = lab.memory.resource;
      let contents = Object.keys(lab.store).filter(
        (r) => r !== RESOURCE_ENERGY && lab.store[r] > 0,
      );
      if (!contents.length) continue;
      // drain if unassigned, or if what's inside doesn't match assignment
      for (let resource of contents) {
        if (!assigned || assigned !== resource) {
          return { lab, resource };
        }
      }
    }
    return null;
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

  runDefender(creep) {
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
      // Room-transit guard above already ensures we're in the right room
      // (targetRoom if set, else home). No need to re-check here.
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

  runRanged(creep) {
    if (creep.memory.fighting && creep.memory.target === null) {
      creep.memory.fighting = false;
    }
    if (!creep.memory.fighting && creep.memory.target !== null) {
      creep.memory.fighting = true;
      creep.say("🏹 Engage");
    }

    if (creep.memory.targetRoom != null && !this.inTargetRoom(creep)) {
      this.moveToRoom(creep);
      return;
    } else if (creep.memory.targetRoom == null && !this.inHomeRoom(creep)) {
      this.moveToHome(creep);
      return;
    }

    if (creep.memory.fighting) {
      let targetObj = Game.getObjectById(creep.memory.target);
      if (targetObj != null) {
        combat.combatRanged(creep, targetObj);
      } else {
        creep.memory.target = null;
      }
    } else {
      let target = combat.getAttackTarget(creep);
      if (target != null) {
        creep.memory.target = target.id;
      } else {
        util.patrol(creep);
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
    // Traveler handles multi-room routing, exit selection, border stepping, and
    // hostile-room avoidance via intel.routeCallback. We just hand it a deep
    // target inside the room with a generous range so it doesn't reroute when
    // any tile in the room is reachable.
    // Defensive: if no room is specified, treat as "we're there" rather than
    // constructing a RoomPosition with an undefined roomName (the engine
    // throws inside roomNameToXY).
    if (!room) return true;
    if (this.inTargetRoom(creep, room)) return true;
    util.moveToTarget(
      creep,
      { showPath: creep.room.memory.showPath, pathColor: "#0c02d1", range: 22 },
      new RoomPosition(25, 25, room),
    );
    return false;
  },

  getTargetResource(creep) {
    return creep.memory.targetResource == null
      ? RESOURCE_ENERGY
      : creep.memory.targetResource;
  },
};
