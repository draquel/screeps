/* eslint-disable no-undef */
//const util = require("./util");
const work = require("./creeps.work");
const combat = require("./creeps.combat");
const util = require("./util");
const logistics = require("./logistics");
const production = require("./production");
const power = require("./power");

// Loose minerals at least this big are collected before factory work and
// terminal balancing (smaller ones wait for the low-priority sweep).
const LOOSE_MINERAL_URGENT = 100;

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
      case "harvester":
        res = this.initHarvester(memory);
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
    // memory.upgrader: a dedicated upgrader — every other duty off, and
    // eligible for upgrade boosts (production.isUpgrader)
    let duties = !memory.upgrader;
    memory.eligibility = {
      base: duties,
      repair: duties,
      build: duties,
      ramparts: duties,
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

  initHarvester(memory) {
    // Repair participation is opt-out: default the flag on, but honor an explicit
    // value passed via the spawn memory so a batch of harvesters can be queued
    // with repair disabled. Gating repairs keeps them from diverting energy that
    // would otherwise flow into the room.
    if (memory.eligibility === undefined) {
      memory.eligibility = {
        repair: true,
      };
    }
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

    // Pure upgraders visit the booster lab once per life (see production.js)
    if (production.seekBoost(creep)) {
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

    // Existing harvesters spawned before the eligibility flag existed have no
    // eligibility object; treat them as participating so behavior is unchanged
    // until they respawn. Only an explicit false opts a harvester out of repairs.
    const repairEligible =
      creep.memory.eligibility === undefined ||
      creep.memory.eligibility.repair !== false;

    if (creep.memory.working) {
      if (creep.memory.targetRoom != null && !this.inTargetRoom(creep)) {
        this.moveToRoom(creep);
        return;
      } else if (creep.memory.targetRoom == null && !this.inHomeRoom(creep)) {
        this.moveToHome(creep);
        return;
      }

      // Power haulers (power.js): share one big pile, also loot the ruin,
      // and wait by the bank until it breaks / head home once it's gone.
      const powerHaul = creep.memory.mode === "power";
      const collected = work.collectResource(
        creep,
        {
          sources: true,
          drops: true,
          tombs: true,
          deposits: true,
          ruins: powerHaul,
          shareDrops: powerHaul,
        },
        resource,
      );
      if (!collected && powerHaul) {
        power.haulerIdle(creep);
      }
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
          if (repairEligible && work.maintainBaseStructures(creep)) {
            return;
          }
        }
        this.moveToHome(creep);
        return;
      }
      // With a base refiller in the room keeping spawns/extensions topped up,
      // unload at the nearest sink so the energy enters the room economy as fast
      // as possible. Without one, keep the tiered order so the harvester itself
      // refills spawns/extensions before anything else. Refillers are
      // base-eligible workers and energy transporters (both deliver through
      // depositResources, which serves spawns/extensions first); a transporter
      // assigned to a mineral never touches spawns, so it doesn't count.
      const baseRefillerPresent =
        creep.room.find(FIND_MY_CREEPS, {
          filter: (c) =>
            (c.memory.role === "worker" &&
              c.memory.eligibility &&
              c.memory.eligibility.base) ||
            ((c.memory.role === "transporter" ||
              c.memory.role === "transporter2") &&
              this.getTargetResource(c) === RESOURCE_ENERGY),
        }).length > 0;

      if (baseRefillerPresent) {
        if (
          work.depositResources(
            creep,
            {
              pool: true,
              links: true,
              storages: true,
              terminal: true,
              factory: true,
              containers: false,
            },
            resource,
          )
        ) {
          return;
        }
      } else {
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
        if (work.depositResources(creep, depositGroupB, resource)) {
          return;
        }
      }
      if (repairEligible && work.maintainBaseStructures(creep)) {
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
      // Remember where this load came from so delivery can avoid handing it
      // straight back (terminal surplus drain, see collect options below).
      creep.memory.collectedFrom = creep.memory.targetCollect;
      creep.memory.targetCollect = null;
      creep.say("🚚 Deliver");
    }

    if (creep.memory.working) {
      const fromTerminal =
        creep.room.terminal != null &&
        creep.memory.collectedFrom === creep.room.terminal.id;
      if (
        !work.depositResources(
          creep,
          {
            factory: true,
            terminal: !fromTerminal,
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
      let controllerUnder5 =
        creep.room.controller != null && creep.room.controller.level < 5;

      // Energy: drain the targetLink first. It's the room's income (sender
      // links stall once it's full) and used to lose to the storage on
      // distance whenever anything needed energy, so a transporter could
      // loop storage -> storage while the link sat full.
      if (resource === RESOURCE_ENERGY) {
        let link = Game.getObjectById(creep.room.memory.targetLink);
        if (
          link &&
          link.store.getUsedCapacity(RESOURCE_ENERGY) >= Math.min(400, creep.store.getFreeCapacity(RESOURCE_ENERGY))
        ) {
          // collectResource reuses a cached target before looking at options
          if (creep.memory.targetCollect !== link.id) creep.memory.targetCollect = null;
          if (work.collectResource(creep, { links: true, drops: false, tombs: false, ruins: false }, resource)) {
            return;
          }
        }
      }

      // Only pull from storage when there's somewhere to deliver other than
      // storage. Asking getDepositTarget (the same check the delivery uses,
      // claimed extensions/towers excluded) keeps the two in agreement — a
      // separate filter used to disagree and bounce loads straight back.
      let targets = [];
      if (resource === RESOURCE_ENERGY) {
        let dest = work.getDepositTarget(
          creep,
          // factory left out: it's topped up from link/surplus loads on
          // delivery, but isn't a reason to drain storage
          { factory: false, terminal: true, labs: true, links: false, storages: false, containers: false },
          resource,
        );
        if (dest) targets.push(dest);
      } else {
        targets = creep.room.find(FIND_STRUCTURES, {
          filter: (s) =>
            (s.structureType === STRUCTURE_SPAWN || s.structureType === STRUCTURE_EXTENSION) &&
            s.store.getFreeCapacity(resource) > 0 ||
            (s.structureType === STRUCTURE_TOWER && s.store.getFreeCapacity(resource) > 250) ||
            (s.structureType === STRUCTURE_TERMINAL && s.store.getFreeCapacity(resource) > 0 &&
              s.store.getUsedCapacity(resource) < 50000),
        });
      }

      work.collectResource(
        creep,
        {
          drops: controllerUnder5,
          tombs: controllerUnder5,
          links: true,
          sources: false,
          containers: controllerUnder5 || resource !== RESOURCE_ENERGY,
          storages: targets.length > 0,
          // Drain energy sent in by other rooms. The floor sits above the 50k
          // level transporters/harvesters fill the terminal to, so this only
          // takes true surplus and can't fight the top-up. Energy only: the
          // terminal option would otherwise pull foreign minerals too.
          terminals: resource === RESOURCE_ENERGY,
          terminalEnergyFloor: 55000,
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
    // This role operates entirely within its home room (storage/terminal/labs/
    // factory/mineral). If it gets displaced into another room — e.g. shoved
    // across an exit by the traffic resolver, or manually relocated — travel
    // back rather than idling and running in-room logic against foreign
    // (possibly mineral-less) rooms.
    if (!this.inHomeRoom(creep)) {
        this.moveToHome(creep);
        return;
    }

    if (creep.memory.working && creep.store.getUsedCapacity() === 0) {
        creep.memory.working = false;
        creep.memory.targetDeposit = null;
        creep.memory.terminalMoveResource = null;
        creep.memory.terminalMoveMode = null;
        creep.memory.drainResource = null;
        creep.memory.labFillResource = null;
        creep.memory.factoryFeedResource = null;
        creep.memory.powerSpawnFeed = null;
        creep.memory.nukerFeed = null;
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

        // Priority 2b: power spawn feed (power or energy)
        let psFeed = creep.memory.powerSpawnFeed;
        if (psFeed && carried.includes(psFeed)) {
            let ps = this.getPowerSpawn(creep.room);
            if (ps && ps.store.getFreeCapacity(psFeed) > 0) {
                work.workerTransfer(creep, ps, psFeed);
                return;
            }
        }
        creep.memory.powerSpawnFeed = null;

        // Priority 2c: nuker feed (G or energy)
        let nukerFeed = creep.memory.nukerFeed;
        if (nukerFeed && carried.includes(nukerFeed)) {
            let nuker = this.getNuker(creep.room);
            if (nuker && nuker.store.getFreeCapacity(nukerFeed) > 0) {
                work.workerTransfer(creep, nuker, nukerFeed);
                return;
            }
        }
        creep.memory.nukerFeed = null;

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

        // Priority 4: room mineral (e.g. from the miner container) stages in
        // the terminal up to its logistics export target, otherwise storage
        if (roomMineral && carried.includes(roomMineral) && !creep.memory.terminalMoveResource) {
            let terminal = creep.room.terminal;
            if (terminal && terminal.store.getFreeCapacity() > 0
                && (terminal.store[roomMineral] || 0) < logistics.terminalTarget(creep.room, roomMineral)) {
                work.workerTransfer(creep, terminal, roomMineral);
                return;
            }
        }

        // Priority 5: storage <-> terminal balancing job (see getTerminalBalanceJob)
        let terminalMoveResource = creep.memory.terminalMoveResource;
        let terminalMoveMode = creep.memory.terminalMoveMode;
        if (terminalMoveResource && carried.includes(terminalMoveResource)) {
            if (terminalMoveMode === 'toTerminal') {
                let terminal = creep.room.terminal;
                if (terminal && terminal.store.getFreeCapacity() > 0) {
                    work.workerTransfer(creep, terminal, terminalMoveResource);
                    return;
                }
            } else {
                if (creep.room.storage && creep.room.storage.store.getFreeCapacity() > 0) {
                    work.workerTransfer(creep, creep.room.storage, terminalMoveResource);
                    return;
                }
            }
            creep.memory.terminalMoveResource = null;
            creep.memory.terminalMoveMode = null;
        }

        // Catch-all: anything else to storage
        if (creep.room.storage && creep.room.storage.store.getFreeCapacity() > 0) {
            let resource = carried.reduce((a, b) => creep.store[a] >= creep.store[b] ? a : b);
            work.workerTransfer(creep, creep.room.storage, resource);
            return;
        }

    } else {
        // Always clear job flags at the start of every collect cycle
        creep.memory.terminalMoveResource = null;
        creep.memory.terminalMoveMode = null;
        creep.memory.drainResource = null;
        creep.memory.labFillResource = null;
        creep.memory.factoryFeedResource = null;
        creep.memory.powerSpawnFeed = null;
        creep.memory.nukerFeed = null;

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
            if (work.collectResource(creep, {
                storages: true, containers: false, terminals: true,
                ignoreTerminalThresholds: true,
                drops: false, tombs: false, links: false, sources: false,
            }, labTarget.resource)) return;
            // No usable source (e.g. storage holds less than our free
            // capacity, which collectResource won't take): deliver what we
            // already carry, else fall through instead of idling here forever.
            creep.memory.labFillResource = null;
            if (this.deliverPartial(creep, labTarget.resource)) return;
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

        // Priority 3b: sizeable loose minerals (drops decay ~1/1000 per tick,
        // so they go before factory work and terminal balancing)
        let urgentLoose = this.getLooseMineralTarget(creep, LOOSE_MINERAL_URGENT);
        if (urgentLoose) {
            work.collectResource(creep, {
                storages: false, containers: false, terminals: false,
                drops: true, tombs: true, links: false, sources: false,
            }, urgentLoose);
            return;
        }

        // Priority 4: feed factory inputs from storage/terminal
        let factoryNeed = this.getFactoryInputNeed(creep.room);
        if (factoryNeed) {
            creep.memory.factoryFeedResource = factoryNeed.resource;
            if (work.collectResource(creep, {
                storages: true, containers: false, terminals: true,
                ignoreTerminalThresholds: true,
                drops: false, tombs: false, links: false, sources: false,
            }, factoryNeed.resource)) return;
            // Same stall guard as lab fill
            creep.memory.factoryFeedResource = null;
            if (this.deliverPartial(creep, factoryNeed.resource)) return;
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

        // Priority 5b: feed the power spawn (see getPowerSpawnNeed)
        let psNeed = this.getPowerSpawnNeed(creep.room);
        if (psNeed) {
            // Take only what the power spawn can hold, then deliver straight
            // away (a partial load never trips the "full -> deliver" switch).
            creep.memory.powerSpawnFeed = psNeed.resource;
            let amount = Math.min(creep.store.getFreeCapacity(), psNeed.amount, psNeed.source.store[psNeed.resource] || 0);
            let r = creep.withdraw(psNeed.source, psNeed.resource, amount);
            if (r === ERR_NOT_IN_RANGE) {
                util.moveToTarget(creep, { pathColor: '#ff00ff' }, psNeed.source);
            } else if (r === OK) {
                creep.memory.working = true;
            }
            return;
        }

        // Priority 6: drain miner containers
        if (roomMineral) {
            let hasInContainers = creep.room.find(FIND_STRUCTURES, {
                filter: s => s.structureType === STRUCTURE_CONTAINER && (s.store[roomMineral] || 0) > 0
            }).length > 0;
            if (hasInContainers) {
                work.collectResource(creep, {
                    storages: false, containers: true, relaxedContainers: true,
                    terminals: false, drops: false, tombs: false, links: false, sources: false,
                }, roomMineral);
                return;
            }
        }

        // Priority 7: balance non-energy resources between storage and the
        // terminal toward logistics.terminalTarget (exportable surplus staged
        // in the terminal for the broker; excess imports moved to storage)
        let balance = this.getTerminalBalanceJob(creep.room, creep.store.getFreeCapacity());
        if (balance) {
            creep.memory.terminalMoveResource = balance.resource;
            creep.memory.terminalMoveMode = balance.mode;
            let fromTerminal = balance.mode === 'toStorage';
            work.collectResource(creep, {
                storages: !fromTerminal, containers: false, terminals: fromTerminal,
                ignoreTerminalThresholds: true,
                drops: false, tombs: false, links: false, sources: false,
            }, balance.resource);
            return;
        }

        // Priority 8: any remaining loose minerals from containers or drops
        let looseMineral = this.getLooseMineralTarget(creep, 2);
        if (looseMineral) {
            work.collectResource(creep, {
                storages: false, containers: true, relaxedContainers: true,
                terminals: false, drops: true, tombs: true, links: false, sources: false,
            }, looseMineral);
            return;
        }

        // Priority 9 (lowest): load the nuker (see getNukerNeed)
        let nukerNeed = this.getNukerNeed(creep.room);
        if (nukerNeed) {
            creep.memory.nukerFeed = nukerNeed.resource;
            let amount = Math.min(creep.store.getFreeCapacity(), nukerNeed.amount, nukerNeed.source.store[nukerNeed.resource] || 0);
            let r = creep.withdraw(nukerNeed.source, nukerNeed.resource, amount);
            if (r === ERR_NOT_IN_RANGE) {
                util.moveToTarget(creep, { pathColor: '#ff00ff' }, nukerNeed.source);
            } else if (r === OK) {
                creep.memory.working = true;
            }
            return;
        }

        // No collect target found - if we're already carrying something, deliver it
        if (creep.store.getUsedCapacity() > 0) {
            creep.memory.working = true;
            creep.memory.targetCollect = null;
            creep.say("🚚 Deliver");
        }
    }
},

getNuker(room) {
    if (room._nuker === undefined) {
        room._nuker = room.find(FIND_MY_STRUCTURES, { filter: s => s.structureType === STRUCTURE_NUKER })[0] || null;
    }
    return room._nuker;
},

// Nuker top-up: G from terminal/storage when logistics allows nukers to take
// G (nukerPriority), then energy from storage while the room's effective
// energy is above nukerEnergyFloor. Returns { resource, source, amount }.
getNukerNeed(room) {
    let nuker = this.getNuker(room);
    if (!nuker || !room.storage) return null;
    let cfg = logistics.config();
    let gFree = nuker.store.getFreeCapacity(RESOURCE_GHODIUM) || 0;
    if (gFree > 0 && logistics.nukerGhodiumAllowed()) {
        let inTerminal = room.terminal ? room.terminal.store[RESOURCE_GHODIUM] || 0 : 0;
        let inStorage = room.storage.store[RESOURCE_GHODIUM] || 0;
        if (inTerminal + inStorage > 0) {
            return { resource: RESOURCE_GHODIUM, source: inTerminal > 0 ? room.terminal : room.storage, amount: gFree };
        }
    }
    let eFree = nuker.store.getFreeCapacity(RESOURCE_ENERGY) || 0;
    if (eFree > 0 && logistics.effectiveEnergy(room) > cfg.nukerEnergyFloor
        && room.storage.store[RESOURCE_ENERGY] > 0) {
        return { resource: RESOURCE_ENERGY, source: room.storage, amount: eFree };
    }
    return null;
},

getPowerSpawn(room) {
    if (room._powerSpawn === undefined) {
        room._powerSpawn = room.find(FIND_MY_STRUCTURES, { filter: s => s.structureType === STRUCTURE_POWER_SPAWN })[0] || null;
    }
    return room._powerSpawn;
},

// Power spawn top-up: power when it's below half and the room holds some;
// energy (from storage) when it's below half, there's power to process, and
// the room is above the processing floor (rooms.runPowerSpawn) — so a
// starved room never hauls its energy into the power spawn.
// Returns { resource, source } — withdrawn directly (not via getCollectTarget,
// which skips a storage holding less than a full load).
getPowerSpawnNeed(room) {
    let ps = this.getPowerSpawn(room);
    if (!ps || !room.storage) return null;
    let power = ps.store[RESOURCE_POWER] || 0;
    let inTerminal = room.terminal ? room.terminal.store[RESOURCE_POWER] || 0 : 0;
    let inStorage = room.storage.store[RESOURCE_POWER] || 0;
    if (power < POWER_SPAWN_POWER_CAPACITY / 2 && inTerminal + inStorage > 0) {
        return { resource: RESOURCE_POWER, source: inTerminal > 0 ? room.terminal : room.storage,
            amount: POWER_SPAWN_POWER_CAPACITY - power };
    }
    let floor = (Memory.power && Memory.power.config && Memory.power.config.powerEnergyFloor) || 150000;
    if ((ps.store[RESOURCE_ENERGY] || 0) < POWER_SPAWN_ENERGY_CAPACITY / 2 && (power > 0 || inTerminal + inStorage > 0)
        && room.storage.store[RESOURCE_ENERGY] > floor) {
        return { resource: RESOURCE_ENERGY, source: room.storage,
            amount: POWER_SPAWN_ENERGY_CAPACITY - (ps.store[RESOURCE_ENERGY] || 0) };
    }
    return null;
},

// Returns { resource, mode } for the first non-energy resource whose terminal
// amount is off its logistics target: 'toTerminal' when the terminal is more
// than IN_SLACK under target and storage has some, 'toStorage' when it is more
// than OUT_SLACK over (the wide out-margin leaves imports in the terminal where
// labs/factory can still pull them, instead of shuffling every delivery).
// minStorage: storage only counts as a source when it holds more than this —
// getCollectTarget skips a storage holding less than the creep's free
// capacity, and a job it can't source would block the lower priorities.
getTerminalBalanceJob(room, minStorage = 0) {
    const IN_SLACK = 1000, OUT_SLACK = 5000;
    let terminal = room.terminal, storage = room.storage;
    if (!terminal || !storage) return null;
    let resources = new Set([...Object.keys(terminal.store), ...Object.keys(storage.store)]);
    for (let r of resources) {
        if (r === RESOURCE_ENERGY) continue;
        let target = logistics.terminalTarget(room, r);
        let t = terminal.store[r] || 0;
        let s = storage.store[r] || 0;
        if (t < target - IN_SLACK && s > minStorage && terminal.store.getFreeCapacity() > 0) return { resource: r, mode: 'toTerminal' };
        if (t > target + OUT_SLACK && storage.store.getFreeCapacity() > 0) return { resource: r, mode: 'toStorage' };
    }
    return null;
},
// Used in collect phase - checks raw lab need without enRoute adjustment
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

  // Switch to delivery when the creep already carries some of a feed
  // resource it can't top up. Returns true if it switched.
  deliverPartial(creep, resource) {
    if ((creep.store[resource] || 0) === 0) return false;
    creep.memory.working = true;
    creep.memory.targetCollect = null;
    creep.say("🚚 Deliver");
    return true;
  },

  // Returns the resource type of the largest non-energy drop or tombstone
  // holding at least minAmount that no other creep has claimed (claimed piles
  // are skipped by collectResource, so returning one would idle the creep).
  getLooseMineralTarget(creep, minAmount = 2) {
    let taken = util.getCreepProp(
      creep.room.find(FIND_MY_CREEPS, { filter: (c) => c.id !== creep.id }),
      "targetCollect",
    );
    let best = null;
    for (let d of creep.room.find(FIND_DROPPED_RESOURCES, {
      filter: (d) => d.resourceType !== RESOURCE_ENERGY && d.amount >= minAmount && !taken.includes(d.id),
    })) {
      if (!best || d.amount > best.amount) best = { resource: d.resourceType, amount: d.amount };
    }
    if (best) return best.resource;

    for (let t of creep.room.find(FIND_TOMBSTONES, { filter: (t) => !taken.includes(t.id) })) {
      for (let r of Object.keys(t.store)) {
        if (r === RESOURCE_ENERGY || t.store[r] < minAmount) continue;
        if (!best || t.store[r] > best.amount) best = { resource: r, amount: t.store[r] };
      }
    }
    return best ? best.resource : null;
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
    if (creep.memory.mode === "powerBank") {
      power.runAttacker(creep);
      return;
    }
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
