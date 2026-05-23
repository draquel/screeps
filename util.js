/* eslint-disable no-undef */
// noinspection JSUnresolvedReference

const Traveler = require('./Traveler').Traveler;
const intel = require('./intel');

var util = {

    // Per-role repath probability for Traveler. Combat roles repath every tick
    // (probability 1) so they react to a moving battlefield. Everyone else holds
    // their cached path until it is invalidated or they get stuck.
    REPATH_BY_ROLE: {
        attack: 1,
        defender: 1,
        ranged: 1,
        healer: 1,
    },

    cleanupMemory: function(){
        if(!Memory.creeps && !Memory.rooms){ return; }

        let sourceIds = []
        let terminalIds = []
        //Rooms — drop entries with no vision OR with vision but not mine.
        //The previous gating (Memory.rooms count > Game.rooms count) could hide
        //the sweep when counts happened to balance, leaving foreign residue forever.
        if(Memory.rooms){
            for(let name in Memory.rooms) {
                let gr = Game.rooms[name];
                if (!gr) {
                    console.log('['+name+'] Memory: Delete Room Memory (no vision)');
                    delete Memory.rooms[name];
                    continue;
                }
                if (!gr.controller || !gr.controller.my) {
                    console.log('['+name+'] Memory: Delete Foreign Room Memory');
                    delete Memory.rooms[name];
                    continue;
                }
                gr.sources.forEach((s) => { sourceIds.push(s.id) })
                if (gr.terminal) { terminalIds.push(gr.terminal.id) }
            }
            //Sources
            for(let id in Memory.sources){
                if(!sourceIds.includes(id)){
                    console.log('=>   Source Memory: ', id);
                    delete Memory.sources[id]
                }
            }
            //Terminals
            for(let id in Memory.terminals){
              if(!terminalIds.includes(id)){
                console.log('=>   Terminal Memory: ', id);
                delete Memory.terminals[id]
              }
            }
        }

        //Creeps
        if(Memory.creeps && Object.keys(Memory.creeps).length > Object.keys(Game.creeps).length){
            for(let name in Memory.creeps) {
                if(!Game.creeps[name]) {
                    var memory = Memory.creeps[name];
                    if(memory.level == undefined || memory.role == undefined){
                      delete Memory.creeps[name]
                      continue;
                    }
                    var build = this.getRoleBuild(memory.role,memory.level);
                    var energy = this.calcCreepBuildEnergy(build);
                    var type = (memory['role'] != null ? memory['role'].charAt(0).toUpperCase()+memory['role'].slice(1)+" L"+memory['level'] : 'Creep')+ ' ('+energy+'E)';
                    var room = Game.rooms[Memory.creeps[name].room];
                    if(Memory.creeps[name].respawn && Object.keys(Memory.rooms).includes(Memory.creeps[name].room)){
                        if(memory["role"] != "miner" && memory['role'] != "mineralMiner" && memory['role'] != "transporter"){
                            memory['target'] = null;
                            memory['targetCollect'] = null;
                            memory['targetDeposit'] = null;
                        }
                        if(room === undefined){ continue; }
                        console.log('['+room.name+'] Spawn Queue: Auto-Respawn '+type+' : "' + name + '"');
                        room.memory.spawnQueue.push({name:name, memory:memory})
                    }else{
                        console.log('['+room.name+'] Memory: Delete '+type+' "' + name + '" Memory');
                    }
                    delete Memory.creeps[name];
                }
            }
        }

    },

    moveToTarget(creep, options = {}, target = creep.memory.target){
        if(target == null){ return ERR_INVALID_TARGET; }

        // Normalize {x,y,roomName?} into a RoomPosition so Traveler can consume it.
        if(target instanceof Object && !(target instanceof RoomPosition) && target.x !== undefined && target.y !== undefined){
            target = new RoomPosition(target.x, target.y, target.roomName || creep.room.name);
        }

        let showPath = options.showPath !== undefined ? options.showPath : creep.room.memory.showPath;

        let travelOpts = {
            routeCallback: intel.routeCallback,
            useFindRoute: true,
            ignoreCreeps: options.ignoreCreeps !== undefined ? options.ignoreCreeps : true,
            repath: options.repath !== undefined ? options.repath : (this.REPATH_BY_ROLE[creep.memory.role] || 0),
            visualize: !!showPath,
        };
        if(options.range !== undefined) travelOpts.range = options.range;
        if(options.stuckValue !== undefined) travelOpts.stuckValue = options.stuckValue;
        if(options.maxOps !== undefined) travelOpts.maxOps = options.maxOps;
        if(options.allowHostile) travelOpts.allowHostile = true;

        let result = Traveler.travelTo(creep, target, travelOpts);
        if(result === ERR_INVALID_ARGS){
            console.log("moveToTarget: Invalid Arguments")
        }else if(result === ERR_NO_BODYPART){
            console.log("moveToTarget: Missing required BodyPart")
        }
        return result;
    },

    patrol(creep){
        if(!creep.memory.patrolTarget || creep.memory.patrolTarget >= creep.memory.patrolRoute.length){
          creep.memory.patrolTarget = 0
        }
        if(!creep.memory.patrolRoute || creep.memory.patrolRoute.length === 0){
          let route = []
          let sources = creep.room.find(FIND_SOURCES).map(s => s.pos)
          for(let i = 0; i < sources.length; i++){ route.push(sources[i]) }

          /*
          let exit
          exit = creep.room.find(FIND_EXIT_TOP)
          if(exit.length){
            let eid = exit.length == 1 ? 0 : Math.floor(exit.length/2)
            route.push(exit[eid])
            //route.push(new RoomPosition(exit[eid].x,exit[eid].y,exit[eid].roomName))
          }
          exit = creep.room.find(FIND_EXIT_BOTTOM)
          if(exit.length){
            let eid = exit.length == 1 ? 0 : Math.floor(exit.length/2)
            route.push(exit[eid])
            //route.push(new RoomPosition(exit[eid].x,exit[eid].y,exit[eid].roomName))
          }
          exit = creep.room.find(FIND_EXIT_LEFT)
          if(exit.length){
            let eid = exit.length == 1 ? 0 : Math.floor(exit.length/2)
            route.push(exit[eid])
            //route.push(new RoomPosition(exit[eid].x,exit[eid].y,exit[eid].roomName))
          }
          exit = creep.room.find(FIND_EXIT_RIGHT)
          if(exit.length){
            let eid = exit.length == 1 ? 0 : Math.floor(exit.length/2)
            route.push(exit[eid])
            //route.push(new RoomPosition(exit[eid].x,exit[eid].y,exit[eid].roomName))
          }
          */

          route.push(creep.room.controller.pos)

          //creep.memory.patrolRoute = this.solvePatrol(creep.memory.patrolRoute)
          //console.log(creep.memory.patrolRoute.length)
          
          creep.memory.patrolRoute = route
        }

        let pt = creep.memory.patrolRoute[creep.memory.patrolTarget]
        //console.log(creep.name+" patrol target: "+pt)
        if(!creep.pos.inRangeTo(pt,4)){
          this.moveToTarget(creep,{showPath: creep.room.memory.showPath, pathColor: '#ff8000'},pt)
        }else{
          creep.memory.patrolTarget++
          if(creep.memory.patrolTarget >= creep.memory.patrolRoute.length){
            creep.memory.patrolTarget = 0;
          }
        }
    },

    solvePatrol(locations) {
      if (locations.length === 0) return [];
      
      let path = [locations[0]];
      let unvisited = locations.slice(1);
      
      while (unvisited.length > 0) {
          let lastPos = path[path.length - 1];
          let nearestIndex = 0;
          let minDistance = Infinity;
          
          // Find closest unvisited neighbor
          for (let i = 0; i < unvisited.length; i++) {
              let dist = Math.hypot(unvisited[i].x - lastPos.x, unvisited[i].y - lastPos.y);
              if (dist < minDistance) {
                  minDistance = dist;
                  nearestIndex = i;
              }
          }
          
          path.push(unvisited.splice(nearestIndex, 1)[0]);
      }
      return path;
    },

    getAllCreepsByRole(role){
        var CreepList = [];
        for (var creepname in Game.creeps){
            if (Game.creeps[creepname].memory.role === role){
                CreepList.push(Game.creeps[creepname]);
            }
        }
        return CreepList
    },

    getCreepProp: function(creeps = [],property = 'role',verbose = false){
        if(verbose){
          for(let i = 0; i < creeps.length; i++){
            let value = creeps[i].memory[property]
            let valueOut = (typeof value === "object" ? this.objToString(value) : value)
            console.log("=>   "+creeps[i].name + '[' + property + '] ' + valueOut)
          }
        }
        return creeps.map((c) => c.memory[property]) 
    },

    setCreepProp: function(creeps = Game.creeps,property = null,value = null,verbose = true){
        for(let i = 0; i< creeps.length; i++){
            if(verbose){
              let valueOut = (typeof value === "object" ? this.objToString(value) : value)
              console.log("=>   "+creeps[i].name + '[' + property + '] ' + valueOut)
            }
            creeps[i].memory[property] = value;
        }
    },

    getCreepsByRole: function(room,role){
        if(typeof room === 'string'){
            if(Object.keys(Game.rooms).includes(room)){
                room = Game.rooms[room]
            }
        }
        
        let creeps = room.find(FIND_MY_CREEPS,{filter: (c) => c.memory.role === role});
        let spawning = room.memory.spawning.filter((c) => c.memory.role === role);
        let queued = room.memory.spawnQueue.filter((c) => c.memory.role === role);

        return [...creeps,...spawning,...queued];
    },

    getCreepPropsByRole: function(room,role,property,verbose = false){
        if(verbose) { console.log("getCreepPropsByRole: "+room+" - "+role+"["+property+"]") }
        return this.getCreepProp(this.getCreepsByRole(room,role),property,verbose);
    },

    setCreepPropsByRole: function(room,role,property,value,verbose = true){
        if(verbose) { console.log("setCreepPropsByRole: "+room+" - "+role+"["+property+"] "+(typeof value === 'object' ? this.objToString(value) : value)) }
        return this.setCreepProp(this.getCreepsByRole(room,role),property,value,verbose);
    },

    openSpacesNearPos: function(pos,range = 1,array = false){
        var posDetails = Game.rooms[pos.roomName].lookAtArea(pos.y-range,pos.x-range,pos.y+range,pos.x+range,true);
        var openSpaces = 9;
        var spaces = [];
        for(var i = 0; i < posDetails.length; i++){
            if((posDetails[i].type === "structure" && posDetails[i].structure.structureType === STRUCTURE_WALL) || (posDetails[i].type === "terrain" && posDetails[i].terrain === "wall")){
                openSpaces--;
                continue;
            }
            spaces.push(new RoomPosition(posDetails[i].x,posDetails[i].y,pos.roomName));
        }
        return (array ? spaces : openSpaces);
    },

    calcCreepBuildEnergy: function(build){
        var energy = 0;
        for(var i = 0; i < build.length; i++){
            switch(build[i]){
                case TOUGH: energy += 10; break;
                case MOVE:
                case CARRY: energy += 50; break;
                case ATTACK: energy += 80; break;
                case WORK: energy += 100; break;
                case RANGED_ATTACK: energy += 150; break;
                case HEAL: energy += 250; break;
                case CLAIM: energy += 600; break;
            }
        }
        return energy;
    },

    spawnCreep: function(spawn,name,memory){
        if(!memory.level){ memory.level = null; }
        if(!memory.role){ memory.role = null; }else{ if(!memory.level){ memory.level = 1; } }
        if(name == null){ name = this.nameGenerator(); }
        memory.room = spawn.room.name;

        var build = this.getRoleBuild(memory.role,memory.level);
        var energy = this.calcCreepBuildEnergy(build);
        var type = (memory.role != null ? this.firstToUpperCase(memory.role)+" L"+memory.level : 'Creep')+ ' ('+energy+'E)';
        if(spawn.room.energyAvailable >= energy){
            if(spawn.busy){ return ERR_BUSY; }
            console.log('['+memory.room+'] Spawn Queue: Spawning '+type+' : "' + name + '"');
            spawn.busy = true;
            return spawn.spawnCreep(build,name,{memory:memory});
        }else{
            return ERR_NOT_ENOUGH_ENERGY;
        }
    },

    nameGenerator: function(){
        let names = ['Adam','Al','Alan','Archibald','Buzz','Carson','Chad','Charlie','Chris','Chuck','Dean','Ed','Edan','Edlu','Frank','Franklin','Gus','Hans','Jack','James','Jim','Kirk','Kurt','Lars','Luke','Mac','Matt','Phil','Randall','Scott','Scott','Sean','Steve','Tom','Will'];
        let prefixes = ['Ad','Al','Ald','An','Bar','Bart','Bil','Billy-Bob','Bob','Bur','Cal','Cam','Chad','Cor','Dan','Der','Des','Dil','Do','Don','Dood','Dud','Dun','Ed','El','En','Er','Fer','Fred','Gene','Geof','Ger','Gil','Greg','Gus','Had','Hal','Han','Har','Hen','Her','Hud','Jed','Jen','Jer','Joe','John','Jon','Jor','Kel','Ken','Ker','Kir','Lan','Lem','Len','Lo','Lod','Lu','Lud','Mac','Mal','Mat','Mel','Mer','Mil','Mit','Mun','Ned','Neil','Nel','New','Ob','Or','Pat','Phil','Ray','Rib','Rich','Ro','Rod','Ron','Sam','Sean','See','Shel','Shep','Sher','Sid','Sig','Son','Thom','Thomp','Tom','Wehr','Wil'];
        let suffixes = ['ald','bal','bald','bart','bas','berry','bert','bin','ble','bles','bo','bree','brett','bro','bur','burry','bus','by','cal','can','cas','cott','dan','das','den','din','do','don','dorf','dos','dous','dred','drin','dun','ely','emone','emy','eny','fal','fel','fen','field','ford','fred','frey','frey','frid','frod','fry','furt','gan','gard','gas','gee','gel','ger','gun','hat','ing','ke','kin','lan','las','ler','ley','lie','lin','lin','lo','lock','long','lorf','ly','mal','man','min','ming','mon','more','mund','my','nand','nard','ner','ney','nie','ny','oly','ory','rey','rick','rie','righ','rim','rod','ry','sby','sel','sen','sey','ski','son','sted','ster','sy','ton','top','trey','van','vey','vin','vis','well','wig','win','wise','zer','zon','zor'];
        let algRGN = Math.random();

        let generated;
        if(algRGN <= 0.05){
            generated = names[Math.floor(Math.random()*names.length)];
        }else{
            generated = prefixes[Math.floor(Math.random()*prefixes.length)] + suffixes[Math.floor(Math.random()*suffixes.length)];
        }

        let existing = Object.keys(Game.creeps);
        if(existing.includes(generated)){
            generated = this.nameGenerator();
        }

        return generated;
    },

    objToString(obj){
      if(typeof obj !== 'object'){ return }
      return "{"+Object.entries(obj).map(([k,v]) => k+":"+v).join(",")+"}"
    },

    firstToUpperCase(inString){
      return inString.charAt(0).toUpperCase()+inString.slice(1)
    },

    getRoleBuild(role,level = 1){
      // Build order convention: parts listed first are placed at the front of the
      // body and take damage first. Combat/healer roles use TOUGH -> functional -> MOVE
      // so the creep keeps damage parts longer than its mobility (retreat capable).
      var buildLib = {
        "scout": {
          1:{"MOVE":6},
          2:{"WORK":1,"CARRY":1,"MOVE":6}
        },
        "harvester":{
          1:{"WORK":1,"CARRY":2,"MOVE":2},
          2:{"WORK":2,"CARRY":3,"MOVE":4},
          3:{"WORK":3,"CARRY":4,"MOVE":6},
          4:{"WORK":6,"CARRY":5,"MOVE":7},
          5:{"WORK":8,"CARRY":6,"MOVE":10},
          6:{"WORK":11,"CARRY":6,"MOVE":12},
          7:{"WORK":17,"CARRY":7,"MOVE":17},
          8:{"WORK":22,"CARRY":7,"MOVE":21},
        },
        "worker":{
          1:{"WORK":1,"CARRY":2,"MOVE":2},
          2:{"WORK":2,"CARRY":3,"MOVE":4},
          3:{"WORK":3,"CARRY":4,"MOVE":6},
          4:{"WORK":6,"CARRY":5,"MOVE":7},
          5:{"WORK":8,"CARRY":6,"MOVE":10},
          6:{"WORK":11,"CARRY":6,"MOVE":12},
          7:{"WORK":17,"CARRY":7,"MOVE":17},
          8:{"WORK":22,"CARRY":7,"MOVE":21},
        },
        "transporter":{
          1:{"CARRY":3,"MOVE":3},
          2:{"CARRY":6,"MOVE":5},
          3:{"CARRY":8,"MOVE":8},
          4:{"CARRY":12,"MOVE":12},
          5:{"CARRY":15,"MOVE":15},
          6:{"CARRY":20,"MOVE":15},
          7:{"CARRY":25,"MOVE":19},
          8:{"CARRY":30,"MOVE":20},
        },
        "mineralTransporter": {
            1: {"CARRY":3,  "MOVE":3},
            2: {"CARRY":6,  "MOVE":5},
            3: {"CARRY":8,  "MOVE":8},
            4: {"CARRY":12, "MOVE":12},
            5: {"CARRY":15, "MOVE":15},
            6: {"CARRY":20, "MOVE":15},
            7: {"CARRY":25, "MOVE":19},
            8: {"CARRY":30, "MOVE":20},
        },
        // Source-focused. WORK capped at 6 because a single source caps at 10 E/tick
        // (5 WORK). Extra WORK past 6 is wasted on a source. Use mineralMiner for minerals.
        "miner":{
          1:{"WORK":2,"CARRY":1,"MOVE":1},
          2:{"WORK":4,"CARRY":2,"MOVE":1},
          3:{"WORK":5,"CARRY":2,"MOVE":2},
          4:{"WORK":6,"CARRY":3,"MOVE":3},
          5:{"WORK":6,"CARRY":4,"MOVE":5},
          6:{"WORK":6,"CARRY":5,"MOVE":6},
          7:{"WORK":6,"CARRY":6,"MOVE":7},
          8:{"WORK":6,"CARRY":8,"MOVE":8},
        },
        // Mineral-focused. Max WORK for extractor throughput.
        "mineralMiner":{
          1:{"WORK":2,"CARRY":1,"MOVE":1},
          2:{"WORK":4,"CARRY":2,"MOVE":1},
          3:{"WORK":6,"CARRY":2,"MOVE":2},
          4:{"WORK":9,"CARRY":3,"MOVE":3},
          5:{"WORK":12,"CARRY":4,"MOVE":4},
          6:{"WORK":16,"CARRY":4,"MOVE":5},
          7:{"WORK":25,"CARRY":4,"MOVE":6},
          8:{"WORK":36,"CARRY":5,"MOVE":8},
        },
        "claimer":{
          1:{"CLAIM":1,"MOVE":2},
          2:{"CLAIM":2,"MOVE":3},
          3:{"CLAIM":3,"MOVE":4},
          4:{"CLAIM":4,"MOVE":5},
          5:{"CLAIM":5,"MOVE":6},
        },
        "attack":{
          1:{"ATTACK":2,"MOVE":2},
          2:{"TOUGH":2,"ATTACK":3,"MOVE":5},
          3:{"TOUGH":4,"ATTACK":5,"MOVE":7},
          4:{"TOUGH":6,"ATTACK":7,"MOVE":10},
          5:{"TOUGH":8,"ATTACK":10,"MOVE":12},
          6:{"TOUGH":10,"ATTACK":13,"MOVE":15},
          7:{"TOUGH":12,"ATTACK":16,"MOVE":18},
          8:{"TOUGH":10,"ATTACK":18,"MOVE":22},
        },
        "defender":{
          1:{"ATTACK":2,"MOVE":2},
          2:{"TOUGH":2,"ATTACK":3,"MOVE":5},
          3:{"TOUGH":4,"ATTACK":5,"MOVE":7},
          4:{"TOUGH":6,"ATTACK":7,"MOVE":10},
          5:{"TOUGH":8,"ATTACK":10,"MOVE":12},
          6:{"TOUGH":10,"ATTACK":13,"MOVE":15},
          7:{"TOUGH":12,"ATTACK":16,"MOVE":18},
          8:{"TOUGH":10,"ATTACK":18,"MOVE":22},
        },
        "healer":{
          1:{"HEAL":1,"MOVE":1},
          2:{"HEAL":2,"MOVE":1},
          3:{"TOUGH":1,"HEAL":2,"MOVE":3},
          4:{"HEAL":4,"MOVE":4},
          5:{"HEAL":6,"MOVE":6},
          6:{"TOUGH":5,"HEAL":7,"MOVE":7},
          7:{"TOUGH":5,"HEAL":14,"MOVE":14},
          8:{"TOUGH":10,"HEAL":20,"MOVE":20},
        },
        "ranged":{
          1:{"RANGED_ATTACK":1,"MOVE":3},
          2:{"TOUGH":1,"RANGED_ATTACK":2,"MOVE":4},
          3:{"TOUGH":4,"RANGED_ATTACK":3,"MOVE":5},
          4:{"TOUGH":5,"RANGED_ATTACK":5,"MOVE":7},
          5:{"TOUGH":5,"RANGED_ATTACK":7,"MOVE":10},
          6:{"TOUGH":8,"RANGED_ATTACK":9,"MOVE":13},
          7:{"TOUGH":10,"RANGED_ATTACK":13,"MOVE":18},
          8:{"TOUGH":11,"RANGED_ATTACK":17,"MOVE":22},
        },
      }

      var template = buildLib[role][level]
      //console.log(Object.keys(template).toString())
      const build = []

      const keys = Object.keys(template)
      keys.forEach(key => { for(let i = 0; i < template[key]; i++){ build.push(key.toLowerCase()) } })
      //console.log(build.toString())
      return build
    },

    creepsNearPos: function(pos){
        var creeps = Game.rooms[pos.roomName].find(FIND_MY_CREEPS);
        var count = 0;
        for(var i = 0; i < creeps.length; i++){
            if(pos.isNearTo(creeps[i].pos)){
                count++;
            }
        }
        return count;
    },

    getCountMap(array){
        return array.reduce((acc, e) => acc.set(e, (acc.get(e) || 0) + 1), new Map())
    },

   runTest(creepName){
    // Paste into Screeps console, replace name
    let creep = Game.creeps[creepName];
    let roomMineral = creep.room.mineral ? creep.room.mineral.mineralType : null;
    let work = require('./creeps.work');

    console.log('=== MINERAL TRANSPORTER DEBUG ===');
    console.log('working:', creep.memory.working);
    console.log('store used:', creep.store.getUsedCapacity(), '/ free:', creep.store.getFreeCapacity());
    console.log('roomMineral:', roomMineral);
    console.log('memory:', JSON.stringify(creep.memory));

    // P1: lab drain
    let labs = creep.room.find(FIND_MY_STRUCTURES, {filter: s => s.structureType === STRUCTURE_LAB});
    console.log('--- P1 Lab Drain ---');
    labs.forEach(l => {
        let assigned = l.memory.resource;
        let contents = Object.keys(l.store).filter(r => r !== RESOURCE_ENERGY && l.store[r] > 0);
        console.log('lab', l.id, 'assigned:', assigned, 'contents:', JSON.stringify(contents));
    });

    // P2: lab fill
    console.log('--- P2 Lab Fill ---');
    labs.forEach(l => {
        let resource = l.memory.resource;
        let target = l.memory.amount || 2000;
        let current = l.store[resource] || 0;
        console.log('lab', l.id, 'resource:', resource, 'current:', current, 'target:', target, 'needs fill:', current < target);
    });

    // P3: room mineral terminal top up
    console.log('--- P3 Terminal Top Up ---');
    let terminal = creep.room.terminal;
    let terminalHeld = terminal ? (terminal.store[roomMineral] || 0) : 0;
    let terminalCap = creep.room.memory.mineralTerminalCap || 25000;
    let hasInStorage = creep.room.storage && (creep.room.storage.store[roomMineral] || 0) > 0;
    let containers = creep.room.find(FIND_STRUCTURES, {filter: s => s.structureType === STRUCTURE_CONTAINER});
    let hasInContainers = containers.some(s => (s.store[roomMineral] || 0) > 0);
    console.log('terminalHeld:', terminalHeld, '/ cap:', terminalCap, '/ needs top up:', terminalHeld < terminalCap);
    console.log('hasInStorage:', hasInStorage, 'hasInContainers:', hasInContainers);
    containers.forEach(c => console.log('container', c.id, roomMineral+':', c.store[roomMineral] || 0, 'total used:', c.store.getUsedCapacity()));

    // P4: foreign mineral management
    console.log('--- P4 Foreign Minerals ---');
    if (terminal && creep.room.storage) {
        let foreignSellThreshold = creep.room.memory.foreignMineralSellThreshold || 10000;
        let foreignSellBuffer = creep.room.memory.foreignMineralSellBuffer || 2000;
        Object.keys(terminal.store).forEach(r => {
            if (r === RESOURCE_ENERGY || r === roomMineral) return;
            let tAmt = terminal.store[r] || 0;
            let sAmt = creep.room.storage.store[r] || 0;
            console.log(r+': terminal='+tAmt+' storage='+sAmt+' combined='+(tAmt+sAmt)+' threshold='+foreignSellThreshold+' inbound eligible:'+(tAmt > 0 && (tAmt+sAmt) <= foreignSellThreshold));
        });
        Object.keys(creep.room.storage.store).forEach(r => {
            if (r === RESOURCE_ENERGY || r === roomMineral) return;
            let tAmt = terminal ? (terminal.store[r] || 0) : 0;
            let sAmt = creep.room.storage.store[r] || 0;
            console.log(r+': storage='+sAmt+' terminal='+tAmt+' combined='+(tAmt+sAmt)+' excess eligible:'+((tAmt+sAmt) > foreignSellThreshold+foreignSellBuffer));
        });
    }

    // P5: loose minerals
    console.log('--- P5 Loose Minerals ---');
    let drops = creep.room.find(FIND_DROPPED_RESOURCES, {filter: d => d.resourceType !== RESOURCE_ENERGY && d.resourceType !== roomMineral});
    let tombs = creep.room.find(FIND_TOMBSTONES, {filter: t => Object.keys(t.store).some(r => r !== RESOURCE_ENERGY && r !== roomMineral && t.store[r] > 0)});
    console.log('drops:', drops.length, 'tombs:', tombs.length);

    // collectResource target check
    console.log('--- collectResource target check ---');
    let testTarget = work.getCollectTarget(creep, {
        storages: true, containers: true, relaxedContainers: true,
        terminals: false, drops: false, tombs: false, links: false, sources: false
    }, roomMineral);
    console.log('getCollectTarget for roomMineral:', testTarget ? testTarget.id+' ('+testTarget.structureType+')' : 'NULL');
    console.log('existing targetCollect in memory:', creep.memory.targetCollect);
    let existing = creep.memory.targetCollect ? Game.getObjectById(creep.memory.targetCollect) : null;
    console.log('existing target object:', existing ? existing.id : 'NULL - stale or missing');
   }
}

module.exports = util;
