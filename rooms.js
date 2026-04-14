/* eslint-disable no-undef */
const util = require("./util");
const market = require("./market");
const creep = require("./creeps");

module.exports = {
    getRoomByName(name = null){
        if(Object.keys(Game.rooms).includes(name)){
            return Game.rooms[name]
        }
        return null
    },

    initMem(room){
        if(typeof room.memory.showPath === "undefined"){
            console.log('['+room.name+'] Memory: Initializing Room Memory')
        }
        room.memory = {
            terminalResources:room.memory.terminalResources === undefined ? [RESOURCE_ENERGY] : room.memory.terminalResources,
            reusePath:room.memory.reusePath === undefined ? 1 : room.memory.reusePath,
            showPath:room.memory.showPath === undefined ? false : room.memory.showPath,
            targetLink:room.memory.targetLink === undefined ? null : room.memory.targetLink,
            spawning:room.memory.spawning === undefined ? [] : room.memory.spawning,
            spawnQueue:room.memory.spawnQueue === undefined ? [] : room.memory.spawnQueue,
            defenseMin:room.memory.defenseMin === undefined ? 20000 : room.memory.defenseMin,
            reservations:room.memory.reservations === undefined ? [] : room.memory.reservations,
        }
    },

    run(room){
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
    },

    runTowers(room){
        let towers = room.find(FIND_STRUCTURES,{filter:(s) => s.structureType === STRUCTURE_TOWER});
        for(let j = 0; j < towers.length; j++){
            let target = towers[j].pos.findClosestByRange(FIND_HOSTILE_CREEPS)
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
            for(let i = 0; i < links.length; i++){
                if(links[i].store.getFreeCapacity(RESOURCE_ENERGY) === 0){
                    links[i].transferEnergy(targetLink)
                }
            }
        }
    },

    runTerminal(room){
      if(room.terminal == null){
        return
      }

      if(room.terminal.cooldown > 0){
        return
      }

      if(room.terminal.memory.deals && room.terminal.memory.deals.length > 0){
       let deal = room.terminal.memory.deals.shift()
       let order = Game.market.getOrderById(deal.id)
       let result = -10
       if(order != null && order.remainingAmount >= deal.amount){
         console.log("["+room.name+"] Executing Deal ["+deal.id+"]")
         result = Game.market.deal(deal.id,deal.amount,room.name); 
       }
       if(result != OK){
         console.log("Failed to execute: "+result)
       }
      }
    },

    runFactory(room){

    },

    runMiningCrew(room) {
        if (room.controller == null || room.controller.level < 6) {
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
            let miner = util.getCreepsByRole(room,'miner').filter( (c) => { return c.memory.targetResource === mineral.mineralType })
            if(!miner.length){
                console.log('['+room.name+'] Mining: Extractable Minerals ['+mineral.mineralType+'] Detected in '+room.name+' Deploying Miner')
                this.queCreep(room,'miner',1,{respawn:false,level:4,target:mineral.id,targetResource:mineral.mineralType})
            }else{
                console.log('['+room.name+'] Mining: Mineral Extraction In Progress in '+room.name)
            }
        }
        //Transporter check
        if(container != null && container.store.getUsedCapacity(mineral.mineralType) >= 1000){
            let transporter = util.getCreepsByRole(room,'transporter').filter( (c) => { return c.memory.targetResource === mineral.mineralType })
            if(!transporter.length){
                console.log("["+room.name+"] Mining: Transportable Minerals ["+mineral.mineralType+"] Detected in "+room.name+" Deploying Transporter")
                this.queCreep(room,'transporter',1,{respawn:false,level:3,targetResource:mineral.mineralType})
            }else{
              console.log("["+room.name+"] Mining: Mineral Transport In Progress in "+room.name)
            }
        }
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

    sellResources(room,amount = 10000){
        room = this.checkRoomObj(room)
        
        if(room.terminal == null){ return }

        let resource = this.getMineral(room).mineralType
        let orders = market.getBuyOrdersFor(resource,amount)
        let left = amount
        let cost = 0
        let total = 0
        
        console.log("Selling "+amount+" "+resource+" in "+ room.name+":")
        for(let i = 0; i < orders.length; i++){
            let last = orders[i].remainingAmount >= left
            let transactionAmount = (last?left:orders[i].amount)
            let value = last ? Math.round(left*orders[i].price) : Math.round(orders[i].amount*orders[i].price)
            console.log(room.name+" - Selling "+transactionAmount+" "+resource+" @ $"+orders[i].price+" [$"+value+"]")
            //Game.market.deal(orders[i].id,transactionAmount,room.name)
            room.terminal.addDeal({id:orders[i].id,amount:transactionAmount})
            left -= transactionAmount
            total += value
            cost += Game.market.calcTransactionCost(transactionAmount,room.name,orders[i].roomName)
        }
        console.log("Total Projected Earnings: $"+Math.round(total) +", Total Cost: "+cost+"e")
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

        this.queCreep(room,'miner',1,{respawn:false,level:4,target:container.id,targetResource:mineral.mineralType})
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
        if(typeof room === 'string'){ room = this.getRoomByName(room) }
        return room
    },

    updateSpawning(room){
        if(room.memory.spawning.length === 0){ return; }

        let creeps = room.find(FIND_MY_CREEPS);
        for(let i = 0; i < creeps.length; i++){
            for(let j = 0; j < room.memory.spawning.length; j++){
                if(creeps[i].name === room.memory.spawning[j].name || room.memory.spawning[j].name === undefined){
                    room.memory.spawning.splice(j,1);
                }
            }
        }
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
      this.checkRoomObj(room)
      if(room.memory.spawnQueue[0].memory.level > 1){
        console.log('['+room.name+'] Spawn Queue: Stuck queue detected')
        return this.queCreep(room,"worker",1,{level:1,respawn:false},true)
      }
      return false
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
