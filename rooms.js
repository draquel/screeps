/* eslint-disable no-undef */
const util = require("./util");
const market = require("./market");
const creep = require("./creeps");

module.exports = {
    getRoomByName(name = null){
        return util.getRoomByName(name)
    },

    // Fills in missing room memory defaults in place. It used to rebuild
    // room.memory from a whitelist every tick, which silently dropped every
    // other key — including the Room prototype caches (sourceIds, mineral,
    // factoryId), forcing a fresh find() for each of them every tick.
    initMem(room){
        let mem = room.memory;
        if(mem.showPath === undefined){
            console.log('['+room.name+'] Memory: Initializing Room Memory')
        }
        const defaults = {
            terminalResources: () => [RESOURCE_ENERGY],
            reusePath: () => 1,
            showPath: () => false,
            targetLink: () => null,
            spawning: () => [],
            spawnQueue: () => [],
            defenseMin: () => 20000,
            reservations: () => [],
            allowMining: () => true,
        };
        for(let key in defaults){
            if(mem[key] === undefined) mem[key] = defaults[key]();
        }
        // One-time cleanup of keys nothing reads any more (old terminal push
        // model thresholds, unused structure ids, a stray prototype setter key).
        if(!mem._memV || mem._memV < 2){
            for(let key of ['mineralTerminalCap', 'mineralSellThreshold', 'foreignMineralSellThreshold',
                'foreignMineralSellBuffer', 'terminalEnergyReserve', 'storageId', 'terminalId', 'sources']){
                delete mem[key];
            }
            mem._memV = 2;
        }
    },

    run(room){
        // Skip rooms I don't control. main.js iterates Game.rooms which includes
        // any room I currently have vision in (transit, remote, foreign). None of
        // the per-tick room logic below operates on structures I don't own, and
        // running initMem here is what historically polluted Memory.rooms with
        // foreign terminalId/storageId entries.
        if(!room.controller || !room.controller.my) return;

        this.initMem(room)

        var interval = Game.time % 100 === 0

        if(interval){
            this.runMiningCrew(room)
        }
        if(room.memory.reservations.length && interval){
          this.manageReservations(room)
        }

        this.processSpawnQueue(room)

        this.runTowers(room)
        this.runLinks(room)
        this.runTerminal(room)
        this.runLabs(room)
        this.runFactory(room)
    },

    runTowers(room){
        let towers = room.find(FIND_STRUCTURES,{filter:(s) => s.structureType === STRUCTURE_TOWER});
        // Cache once per room — every tower would otherwise re-run the same
        // find + filter passes. Healers are prioritized so we focus down enemy
        // sustain; only HEAL parts that still have hits count.
        let hostiles = room.find(FIND_HOSTILE_CREEPS);
        let healers = hostiles.filter(c => c.body.some(p => p.type === HEAL && p.hits > 0));
        for(let j = 0; j < towers.length; j++){
            let target = towers[j].pos.findClosestByRange(healers);
            if(target === null){
                target = towers[j].pos.findClosestByRange(hostiles);
            }
            if(target !== null){
                towers[j].attack(target)
            }else{
                target = towers[j].pos.findClosestByRange(FIND_MY_CREEPS,{filter:(c) => c.hits < c.hitsMax})
                if(target !== null){
                    towers[j].heal(target)
                }else{
                  if(towers[j].store.getUsedCapacity() / towers[j].store.getCapacity() < 0.33){ return }
                    target = towers[j].pos.findClosestByRange(FIND_STRUCTURES,{filter:(s) => 
                      (s.structureType === STRUCTURE_RAMPART || s.structureType === STRUCTURE_WALL ) && s.hits < s.hitsMax && s.hits < s.room.memory.defenseMin})
                    if(target !== null){
                          towers[j].repair(target)
                    }else{
                      //target = towers[j].pos.findClosestByRange(FIND_STRUCTURES,{filter:(s) => 
                      //[  (s.structureType === STRUCTURE_WALL && s.hits < s.hitsMax && s.hits < 10*s.room.memory.defenseMin)})
                      //if(target !== null){
                      //  towers[j].repair(target)
                      //}
                    }
                }
            }
        }
    },

    runLinks(room){
        let targetLink = Game.getObjectById(room.memory.targetLink);
        let links = room.find(FIND_MY_STRUCTURES,{filter:(s) => s.structureType === STRUCTURE_LINK})
        if(targetLink){
            // Send once a link is nearly full rather than exactly full: partial
            // top-ups (e.g. a harvester arriving with an odd remainder) can leave a
            // sender at 799/800, and an exact-full check would strand it forever.
            const SEND_THRESHOLD = LINK_CAPACITY * 0.9
            const MIN_SEND = 100
            for(let i = 0; i < links.length; i++){
                let link = links[i]
                if(link.id === targetLink.id || link.cooldown > 0){ continue }
                if(link.store.getUsedCapacity(RESOURCE_ENERGY) < SEND_THRESHOLD){ continue }
                // Cap to the receiver's free space so a nearly-full targetLink takes a
                // partial send instead of rejecting with ERR_FULL; skip tiny sends
                // that would burn the cooldown for little energy.
                let amount = Math.min(link.store.getUsedCapacity(RESOURCE_ENERGY), targetLink.store.getFreeCapacity(RESOURCE_ENERGY))
                if(amount >= MIN_SEND){
                    link.transferEnergy(targetLink, amount)
                }
            }
        }
    },

  // Executes queued market deals, one per tick (each uses the terminal
  // cooldown). Inter-room sharing and overflow selling are decided
  // empire-wide by logistics.js, which skips terminals with pending deals.
  runTerminal(room) {
      if (!room.terminal) return;
      if (room.terminal.cooldown > 0) return;

      if (room.terminal.memory.deals && room.terminal.memory.deals.length > 0) {
          let deal = room.terminal.memory.deals.shift();
          let order = Game.market.getOrderById(deal.id);
          if (order != null && order.remainingAmount >= deal.amount) {
              let result = Game.market.deal(deal.id, deal.amount, room.name);
              if (result != OK) { console.log("["+room.name+"] Deal failed: "+result); }
          }
      }
  },
    runLabs(room){
        if(!room.controller || room.controller.level < 6) return;
        let labs = room.find(FIND_MY_STRUCTURES, {filter: s => s.structureType === STRUCTURE_LAB});
        if(!labs.length) return;

        let in1 = labs.find(l => l.memory.role === 'input1');
        let in2 = labs.find(l => l.memory.role === 'input2');
        let outputs = labs.filter(l => l.memory.role === 'output');

        if(in1 && in2 && in1.memory.resource && in2.memory.resource){
            let recipe = REACTIONS[in1.memory.resource] && REACTIONS[in1.memory.resource][in2.memory.resource];
            if(recipe
                && (in1.store[in1.memory.resource] || 0) >= 5
                && (in2.store[in2.memory.resource] || 0) >= 5){
                for(let out of outputs){
                    if(out.cooldown > 0) continue;
                    if(out.memory.resource !== recipe) continue;
                    let cap = out.memory.amount || 3000;
                    if((out.store[recipe] || 0) >= cap - 5) continue;
                    if(out.store.getFreeCapacity(recipe) < 5) continue;
                    let r = out.runReaction(in1, in2);
                    if(r !== OK){
                        console.log("["+room.name+"] runLabs: runReaction "+out.id+" -> "+recipe+" failed "+r);
                    }
                }
            }
        }

        for(let b of labs.filter(l => l.memory.role === 'booster')){
            let resource = b.memory.resource;
            if(!resource) continue;
            if((b.store[resource] || 0) < 30) continue;
            let targets = b.pos.findInRange(FIND_MY_CREEPS, 1, {
                filter: c => c.memory.boostsNeeded && c.memory.boostsNeeded.includes(resource)
            });
            if(targets.length){
                let r = b.boostCreep(targets[0]);
                if(r === OK){
                    targets[0].memory.boostsNeeded = targets[0].memory.boostsNeeded.filter(x => x !== resource);
                    console.log("["+room.name+"] runLabs: boosted "+targets[0].name+" with "+resource);
                }
            }
        }
    },

    runFactory(room){
        if(!room.controller || room.controller.level < 7) return;
        let factory = room.factory;
        if(!factory) return;
        if(factory.memory.enabled === false) return;
        if(factory.cooldown > 0) return;

        let target = factory.memory.target;
        if(!target) return;
        let recipe = COMMODITIES[target];
        if(!recipe) return;
        if(recipe.level && factory.level !== recipe.level) return;

        let outputCap = factory.memory.outputCap || 10000;
        let stored = room.storage ? (room.storage.store[target] || 0) : 0;
        if(stored + (factory.store[target] || 0) >= outputCap) return;

        let ready = Object.keys(recipe.components).every(c =>
            (factory.store[c] || 0) >= recipe.components[c]
        );
        if(!ready) return;
        if(factory.store.getFreeCapacity() < recipe.amount) return;

        let r = factory.produce(target);
        if(r !== OK){
            console.log("["+room.name+"] runFactory: produce "+target+" failed "+r);
        }
    },

    runMiningCrew(room) {
        if (room.controller == null || room.controller.level < 6 || !room.memory.allowMining) {
            return
        }

        let mineral = this.getMineral(room)
        let extractor = this.getExtractor(room)
        let container = this.getMineralContainer(room, mineral)

        //Mineral / Container / extractor check
        if(container == null || extractor == null || mineral == null){
          if(container == null) console.log("["+room.name+"] Mining: Mineral Container not found!!!")
          if(extractor == null) console.log("["+room.name+"] Mining: Mineral Extractor not found!!!")
          if(mineral == null) console.log("["+room.name+"] Mining: Mineral not found!!!")
          return
        }

        //Miner check
        if(extractor != null && container != null && mineral.mineralAmount > 0){
            let miner = util.getCreepsByRole(room,'mineralMiner').filter( (c) => { return c.memory.targetResource === mineral.mineralType })
            if(!miner.length){
                console.log('['+room.name+'] Mining: Extractable Minerals ['+mineral.mineralType+'] Detected in '+room.name+' Deploying Miner')
                this.queCreep(room,'mineralMiner',1,{respawn:false,level:4,target:mineral.id,targetResource:mineral.mineralType})
            }else{
                console.log('['+room.name+'] Mining: Mineral Extraction In Progress in '+room.name)
            }
        }
        //Transporter check
        /*
        if(container != null && container.store.getUsedCapacity(mineral.mineralType) >= 1000){
            let transporter = util.getCreepsByRole(room,'transporter').filter( (c) => { return c.memory.targetResource === mineral.mineralType })
            if(!transporter.length){
                console.log("["+room.name+"] Mining: Transportable Minerals ["+mineral.mineralType+"] Detected in "+room.name+" Deploying Transporter")
                this.queCreep(room,'transporter',1,{respawn:false,level:3,targetResource:mineral.mineralType})
            }else{
              console.log("["+room.name+"] Mining: Mineral Transport In Progress in "+room.name)
            }
        }
        */
        //Paused check
        if(mineral.mineralAmount === 0 && extractor != null && container != null){
            console.log('['+room.name+'] Mining: Mineral Extraction Paused in '+room.name+'. Mineral Regeneration in '+mineral.ticksToRegeneration+' ticks')
        }
    },

    //8 space square with spaces for all base upgrades
    buildSquareBaseRoads(room,spawn){
        room = this.checkRoomObj(room)
        let center = new RoomPosition(spawn.pos.x - 2, spawn.pos.y - 3,room.name)
        for(let x = -4; x <= 4; x++){
            for(let y = -4; y <= 4; y++){
                if(
                    Math.abs(x) == Math.abs(y) || // X
                    (Math.abs(y) == 2 && Math.abs(x) == 1) || // 4 corners between X & T
                    (x == 0 && Math.abs(y) > 2 || y == 0 && Math.abs(x) > 1) || // T
                    ((x < 0 || y < 0) && ((Math.abs(x) == 4 && Math.abs(y) == 2) || (Math.abs(x) == 2 && Math.abs(y) == 4))) // Little Xs
                ){
                    room.createConstructionSite(center.x + x,center.y + y,STRUCTURE_ROAD);
                }
            }
        }
    },

    // Queues market deals selling `amount` of `resource` from the room's
    // terminal, best price first, within its terminal energy budget. Orders
    // below `minPrice` (optional) are skipped. Returns true if anything queued.
    sellForeignResources(room, resource, amount, minPrice = null) {
    room = this.checkRoomObj(room);

    if (room.terminal == null) return false;

    let orders = market.getBuyOrdersFor(resource, amount);
    if (minPrice != null) orders = orders.filter(o => o.price >= minPrice);
    if (!orders.length) {
        console.log("["+room.name+"] sellForeignResources: No buy orders found for "+resource+(minPrice != null ? " at >= "+minPrice : ""));
        return false;
    }

    let left = amount;
    let cost = 0;
    let total = 0;

    let energyReserve = 0 //room.memory.terminalEnergyReserve || 5000;
    let energyAvailable = (room.terminal.store[RESOURCE_ENERGY] || 0) - energyReserve;

    if (energyAvailable <= 0) {
        console.log("["+room.name+"] sellForeignResources: Not enough energy in terminal to cover any deals (have "+(room.terminal.store[RESOURCE_ENERGY] || 0)+", reserve "+energyReserve+")");
        return false;
    }

    console.log("Selling " + amount + " " + resource + " in " + room.name + ":");

    for (let i = 0; i < orders.length; i++) {
        if (left <= 0) break;

        let energyBudgetRemaining = energyAvailable - cost;
        if (energyBudgetRemaining <= 0) break;

        let transactionAmount = orders[i].remainingAmount >= left ? left : orders[i].remainingAmount;
        let transactionCost = Game.market.calcTransactionCost(transactionAmount, room.name, orders[i].roomName);

        if (transactionCost > energyBudgetRemaining) {
            // Cant afford the full amount - calculate the largest partial amount we can afford
            // Binary search between 1 and transactionAmount for the most we can send
            let lo = 1;
            let hi = transactionAmount;
            let affordable = 0;
            while (lo <= hi) {
                let mid = Math.floor((lo + hi) / 2);
                let midCost = Game.market.calcTransactionCost(mid, room.name, orders[i].roomName);
                if (midCost <= energyBudgetRemaining) {
                    affordable = mid;
                    lo = mid + 1;
                } else {
                    hi = mid - 1;
                }
            }

            if (affordable <= 0) {
                console.log("["+room.name+"] sellForeignResources: Cannot afford even 1 unit of order "+orders[i].id+" (budget: "+energyBudgetRemaining+"e), stopping");
                break;
            }

            transactionAmount = affordable;
            transactionCost = Game.market.calcTransactionCost(transactionAmount, room.name, orders[i].roomName);
            console.log("["+room.name+"] sellForeignResources: Partial deal - can afford "+transactionAmount+" of "+orders[i].remainingAmount+" (cost: "+transactionCost+"e, budget: "+energyBudgetRemaining+"e)");
        }

        let value = Math.round(transactionAmount * orders[i].price);
        console.log(room.name+" - Selling "+transactionAmount+" "+resource+" @ $"+orders[i].price+" [$"+value+"] (cost: "+transactionCost+"e)");

        room.terminal.addDeal({ id: orders[i].id, amount: transactionAmount });

        left -= transactionAmount;
        total += value;
        cost += transactionCost;
    }

    if (cost > 0) {
        console.log("Total Projected Earnings: $"+Math.round(total)+", Total Energy Cost: "+cost+"e");
        return true;
    }
    console.log("["+room.name+"] sellForeignResources: No affordable deals scheduled for "+resource);
    return false;
},
    sellResources(room, amount = 10000) {
    room = this.checkRoomObj(room);
    if (room.terminal == null) return;
    let resource = this.getMineral(room).mineralType;
    this.sellForeignResources(room, resource, amount);
},

    getSources(room){
        room = this.checkRoomObj(room)
        return room.find(FIND_SOURCES)
    },

    getMineral(room){
        room = this.checkRoomObj(room)
        return room.find(FIND_MINERALS).shift()
    },

    getMineralContainer(room,mineral){
        room = this.checkRoomObj(room)
        return room.find(FIND_STRUCTURES,{filter: (s) => { return s.structureType === STRUCTURE_CONTAINER && s.pos.inRangeTo(mineral,2) }}).shift()
    },

    getExtractor(room){
        room = this.checkRoomObj(room)
        return room.find(FIND_STRUCTURES,{filter:(s) => { return s.structureType === STRUCTURE_EXTRACTOR}}).shift()
    },

    getCreeps(room, includeQueued){
      room = this.checkRoomObj(room)
      
      if(includeQueued){
        let creeps = room.find(FIND_MY_CREEPS);
        let spawning = room.memory.spawning;
        let queued = room.memory.spawnQueue;

        return [...creeps,...spawning,...queued];
      }
      else{
        return room.find(FIND_MY_CREEPS)
      }
    },

    queMiningCrew(room){
        let mineral = this.getMineral(room)
        let container = this.getMineralContainer(room,mineral)
        if(mineral == null || container == null){
            return false;
        }

        this.queCreep(room,'mineralMiner',1,{respawn:false,level:4,target:container.id,targetResource:mineral.mineralType})
        this.queCreep(room,'transporter',1,{respawn:false,level:2,targetResource:mineral.mineralType})
        return true
    },

    queEnergyCrew(room, level = 2){
        let sources = this.checkRoomObj(room).sources
        this.queCreep(room,'miner',sources.length,{respawn:true,level:level})
        this.queCreep(room,'transporter',sources.length,{respawn:true,level:level})
    },

    queColony(room, targetRoom, level = 2){
        this.queCreep(room,'claimer',1,{respawn:false,level:1,targetRoom:targetRoom})
        this.queCreep(room,'builder',2,{respawn:false,level:level,targetRoom:targetRoom})
        this.queCreep(room,'attack',1,{respawn:false,level:level,targetRoom:targetRoom})
    },

    queEnergyMiners(room, level = 2, count = null){
        let sources = this.checkRoomObj(room).sources
        this.queCreep(room,'miner',count == null ? sources.length : count,{respawn:true,level:level})
    },

    queEnergyTransporters(room, level = 2, count = null){
        let sources = this.checkRoomObj(room).sources
        this.queCreep(room,'transporter',count == null ? sources.length : count,{respawn:true,level:level})
    },

    queBuilders(room,level = 1,count = 1){
        this.queCreep(room,'builder',count,{respawn:true,level:level})
    },

    queHarvesters(room, level = 1,count = 1){
        this.queCreep(room,'harvester',count,{respawn:true,level:level})
    },

    // buildBase(room){
    //     if(room.controller.owner !== undefined && room.controller.owner.username !== 'Deep160'){ return }
    //
    //     if(room.controller.level === 1 && !room.memory.level['1'].complete){
    //         //spawn harvesters
    //         if(!room.memory.level['1'].spawnHarvesters) {
    //             this.queCreep(room, 'harvester', this.getSources(room).length, {respawn: true})
    //             room.memory.level['1'].spawnHarvesters = true
    //         }
    //         if(room.memory.level['1'].spawnHarvesters){
    //             room.memory.level['1'].complete = true
    //         }
    //     }
    //
    //     if(room.controller.level === 2 && !room.memory.level['2'].complete){
    //         //spawn builders, build extensions
    //         if(!room.memory.level['2'].spawnBuilders){
    //             this.queCreep(room,'builder',2,{respawn:true})
    //             room.memory.level['2'].spawnBuilders = true;
    //         }
    //         if(!room.memory.level['2'].extensions){
    //             room.memory.level['2'].extensions = this.availableExtensions(room) === 0
    //         }
    //
    //         if(room.memory.level['2'].extensions && room.memory.level['2'].spawnBuilders){
    //             util.setCreepPropsByRole(room,'builder','level',2)
    //             room.memory.level['2'].complete = true;
    //         }
    //     }
    //
    //     if(room.controller.level === 3 && !room.memory.level['3'].complete){
    //         //build extensions, place\build source containers, switch harvesters to miners, spawn maintenance
    //         if(!room.memory.level['3'].extensions){
    //             room.memory.level['3'].extensions = this.availableExtensions(room) === 0
    //         }
    //
    //         if(!room.memory.level['3'].containers && room.memory.level['3'].extensions){
    //             let sources = this.getSources(room);
    //             for(let i = 0; i < sources.length; i++){
    //                 let spots = util.openSpacesNearPos(sources[i].pos,1,true);
    //                 room.createConstructionSite(spots[0].x,spots[0].y,STRUCTURE_CONTAINER);
    //             }
    //             room.memory.level['3'].containers = true;
    //         }
    //
    //         if(!room.memory.level['3'].containersBuilt && room.find(FIND_STRUCTURES,{filter:(s) => { return s.structureType === STRUCTURE_CONTAINER }}).length >= this.getSources(room).length){
    //             room.memory.level['3'].containersBuilt = true;
    //         }
    //
    //         if(!room.memory.level['3'].spawnMaintenance && room.memory.level['3'].containersBuilt){
    //             this.queCreep(room,'maintenance',2,{respawn:true})
    //             room.memory.level['3'].spawnMaintenance = true;
    //         }
    //
    //         if(!room.memory.level['3'].upgradeCreeps1 && room.memory.level['3'].containersBuilt){
    //             util.setCreepPropsByRole(room,'harvester','respawn',false)
    //             this.queCreep(room,'miner',this.getSources(room).length,{respawn:true,level:2})
    //             console.log('Upgraded Harvesters to Miners')
    //             room.memory.level['3'].upgradeCreeps1 = true
    //         }
    //
    //         if(room.memory.level['3'].extensions && room.memory.level['3'].containers && room.memory.level['3'].upgradeCreeps && room.memory.level['2'].spawnMaintenance){
    //             room.memory.level['3'].complete = true;
    //         }
    //     }
    //
    //     if(room.controller.level === 4 && !room.memory.level['4'].complete){
    //         //switch harvesters to miners, add e-maint, upgrade creeps,
    //         if(!room.memory.level['4'].extensions){
    //             room.memory.level['4'].extensions = this.availableExtensions(room) === 0
    //         }
    //
    //         if(!room.memory.level['4'].upgradeCreeps && room.memory.level['4'].extensions){
    //             util.setCreepPropsByRole(room,'miner','level',3)
    //             util.setCreepPropsByRole(room,'r-harvester','level',3)
    //             util.setCreepPropsByRole(room,'builder','level',3)
    //             room.memory.level['4'].upgradeCreeps = true
    //         }
    //     }
    //
    //     if(room.controller.level === 5 && !room.memory.level['5'].complete){
    //         //place target link
    //         if(!room.memory.level['5'].extensions){
    //             room.memory.level['5'].extensions = this.availableExtensions(room) === 0
    //         }
    //     }
    //     if(room.controller.level === 6 && !room.memory.level['6'].complete){
    //         if(!room.memory.level['6'].extensions){
    //             room.memory.level['6'].extensions = this.availableExtensions(room) === 0
    //         }
    //     }
    //     if(room.controller.level === 7 && !room.memory.level['7'].complete){
    //         if(!room.memory.level['7'].extensions){
    //             room.memory.level['7'].extensions = this.availableExtensions(room) === 0
    //         }
    //     }
    //     if(room.controller.level === 8 && !room.memory.level['8'].complete){
    //         if(!room.memory.level['8'].extensions){
    //             room.memory.level['8'].extensions = this.availableExtensions(room) === 0
    //         }
    //     }
    // },

    checkRoomObj(room){
        return util.checkRoomObj(room)
    },

    updateSpawning(room){
        if(!room.memory.spawning || room.memory.spawning.length === 0){ return; }

        // Names actively being produced by a spawn structure this tick.
        const activeSpawnNames = new Set();
        for(const s of room.find(FIND_MY_SPAWNS)){
            if(s.spawning){ activeSpawnNames.add(s.spawning.name); }
        }

        // FIND_MY_CREEPS excludes spawning creeps — that's the whole reason
        // room.memory.spawning exists, as a placeholder so getCreepsByRole
        // (and the unstuckSpawnQueue spawning.length===0 gate) can count
        // committed-but-not-yet-deployed creeps.
        //
        // Filter (not splice-in-loop, which used to skip duplicates):
        //   * malformed/legacy entries (no name) → drop
        //   * creep mid-spawn (Game.creeps[name].spawning === true) → keep
        //   * creep fully deployed (in Game.creeps without .spawning) → drop
        //     (the creep is now in FIND_MY_CREEPS and counted as a real creep)
        //   * no creep but a spawn is actively producing it → keep
        //     (defensive — covers an unusual case where the name isn't in
        //     Game.creeps yet, e.g. immediately after a global reset)
        //   * otherwise → drop (spawn was cancelled or the entry is orphaned)
        room.memory.spawning = room.memory.spawning.filter(entry => {
            if(!entry || !entry.name) return false;
            const c = Game.creeps[entry.name];
            if(c) return c.spawning === true;
            return activeSpawnNames.has(entry.name);
        });
    },

    processSpawnQueue(room){
        this.updateSpawning(room);
        if(room.memory.spawnQueue.length === 0){ return }

        if(this.getCreeps(room).length == 0 && room.memory.spawnQueue.length > 0 && room.memory.spawning.length == 0){
            if(this.unstuckSpawnQueue(room)){ return }
        }

        let spawns = this.getAvailableSpawns(room);
        if(spawns.length){
            for(let i = 0; i < spawns.length; i++){
                if(!room.memory.spawnQueue.length){ break; }
                let build = room.memory.spawnQueue[0];
                let res = util.spawnCreep(spawns[i],build.name,build.memory);
                if(res === 0){
                    room.memory.spawning.push(room.memory.spawnQueue.shift());
                }
            }
        }
    },

    getAvailableSpawns(room){
        let spawns = room.find(FIND_MY_SPAWNS);
        let available = [];
        if(spawns.length){
            for(let i = 0; i < spawns.length; i++){
                if(spawns[i].spawning == null){
                    available.push(spawns[i]);
                }
            }
            return available;
        }
        return false;
    },

    queCreep(room,role,count = 1,memory = {level:1,respawn:true,target:null,targetRoom:null,targetCollect:null,targetResource:null},expidite = false){
        let succ = false
        room = this.checkRoomObj(room)
        for(let i = 0; i < count; i++){
            memory.role = role 
            succ = expidite ?
                this.unshiftSpawnQueue(room,{'name':util.nameGenerator(),'memory':creep.initRole(room,memory)}) :
                this.pushSpawnQueue(room,{'name':util.nameGenerator(),'memory':creep.initRole(room,memory)})
        }
        return succ
    },

    pushSpawnQueue(room,build,log=true){
        if(log){ console.log('['+room.name+'] Spawn Queue: Pushed '+ build.memory.role.charAt(0).toUpperCase()+build.memory.role.slice(1) + (build.name ? ' ' + build.name : '')); }
        return room.memory.spawnQueue.push(build) > 0;
    },

    unshiftSpawnQueue(room,build,log=true){
        if(log){ console.log('['+room.name+'] Spawn Queue: Unshifted '+ build.memory.role.charAt(0).toUpperCase()+build.memory.role.slice(1) + (build.name ? ' ' + build.name : '')); }
        return room.memory.spawnQueue.unshift(build) > 0;
    },

    unstuckSpawnQueue(room){
      room = this.checkRoomObj(room)
      if(!room.memory.spawnQueue || !room.memory.spawnQueue.length) return false;

      // Gate on affordability of queue[0], not level. The previous level-based
      // heuristic assumed unstick always queues L1 — once we started queuing
      // higher-level unstick workers, the new queue head was still >L1 so
      // the gate stayed open and processSpawnQueue's early-return after a
      // successful unstick prevented any spawn from actually happening,
      // producing thousands of duplicates.
      //
      // With this gate: when the unstick worker we unshift is itself
      // affordable (which it will be, since we sized it to current energy),
      // the next tick's call returns false, the spawn loop runs, and the
      // unstick worker spawns normally.
      const head = room.memory.spawnQueue[0];
      if(!head || !head.memory || !head.memory.role) return false;
      const headBuild = util.getRoleBuild(head.memory.role, head.memory.level || 1);
      const headCost = util.calcCreepBuildEnergy(headBuild);
      if(headCost <= room.energyAvailable) return false;

      // Pick the highest worker level we can currently afford. Fall back to
      // "queue nothing" if even L1 is unaffordable so we don't pile up
      // unspawnable entries while waiting for energy.
      const available = room.energyAvailable;
      let level = 0;
      for(let l = 8; l >= 1; l--){
        const cost = util.calcCreepBuildEnergy(util.getRoleBuild("worker", l));
        if(cost <= available){ level = l; break; }
      }
      if(level === 0) return false;

      console.log('['+room.name+'] Spawn Queue: Stuck queue detected — queuing L'+level+' worker (energyAvailable='+available+', head cost was '+headCost+')');
      return this.queCreep(room,"worker",1,{level:level,respawn:false},true);
    },

    availableExtensions(room){
        return ((room.controller.level - 1) * 5) - room.find(FIND_MY_STRUCTURES,{filter:(s) => s.structureType === STRUCTURE_EXTENSION}).length
    },

    //Unused, but useful...

    clearQue(room){
        console.log('['+room.name+'] Spawn Queue: Clearing Queue')
        room = this.checkRoomObj(room)
        room.memory.spawnQueue = []
    },

    getQueueCount(room,role = null){
        let count = 0;
        for(var i = 0; i < room.memory.spawnQueue.length; i++){
            if(role != null && room.memory.spawnQueue[i].memory.role !== role){
                continue;
            }
            count++;
        }
        return count;
    },

    getSpawningCount(room,role = null){
        let count = 0;
        for(var i = 0; i < room.memory.spawning.length; i++){
            if(role != null && room.memory.spawning[i].memory.role !== role){
                continue;
            }
            count++;
        }
        return count;
    },

    getRespawnCount(room,role = null){
        var creeps = 0;
        for(var name in Memory.creeps) {
            if(!Game.creeps[name]){
                if(Memory.creeps[name].respawn && Game.getObjectById(Memory.creeps[name].room).name === room.name){
                    if(role != null && role !== Memory.creeps[name].role){ continue; }
                    creeps++;
                }
            }
        }
        return creeps;
    },

    buildExtractor(room){

    },

    manageReservations(room){
      //console.log("Managing Reservations for: "+room.name+" - variable is set: "+(room.memory.reservations !== undefined)+" count: "+(room.memory.reservations !== undefined ? 0 : memory.reservations.length))
      if(room.memory && room.memory.reservations && room.memory.reservations.length > 0 && room.controller.level >= 4){
        for(var i = 0; i < room.memory.reservations.length; i++){
          let reservedController = Game.getObjectById(room.memory.reservations[i])
          if(!reservedController){
            console.log("["+room.name+"] Reservation: Controller("+room.memory.reservations[i]+") not accessible.")
            return
          }
          if(reservedController){
            if(reservedController.reservation && reservedController.reservation.ticksToEnd){
              if(reservedController.reservation.ticksToEnd > 1000){
                return
              }
            }
            let claimers = util.getAllCreepsByRole("claimer").filter(c => c.memory.targetRoom === reservedController.room.name)
            let queuedClaimers = room.memory.spawnQueue.filter(c => c.memory.role === "claimer")
            if(claimers.length > 0 || queuedClaimers.length > 0){
              console.log("["+room.name+"] Reservation: Reservation of "+reservedController.room.name+" in progress")
              return
            } else {
              console.log("["+room.name+"] Reservation: Detected "+(!reservedController.reservation || (reservedController.reservation && reservedController.reservation.ticksToEnd === 0) ? "Inactive" : "Exiring")+" Reservation for "+reservedController.room.name)
              let spaces = util.openSpacesNearPos(reservedController.pos)
              let count = spaces > 3 ? 3 : spaces
              while(count > 0){
                this.pushSpawnQueue(room,
                  {'name':util.nameGenerator(),
                    'memory':creep.initRole(room,{role:"claimer",level:2,targetRoom:reservedController.room.name,mode:"reserve"})
                  }
                )
                count--
              }
            }
          } else{
            console.log("["+room.name+"] Reservation: Reservation of "+reservedController.room.name+" still active")
          }
        }
      }
    }
}
