/* eslint-disable no-undef */
// noinspection JSUnresolvedReference

var util = {

    cleanupMemory: function(){
        if(!Memory.creeps && !Memory.rooms){ return; }

        let sourceIds = []
        let terminalIds = []
        //Rooms
        if(Memory.rooms && Object.keys(Memory.rooms).length > Object.keys(Game.rooms).length){
            for(let name in Memory.rooms) {
                if (!Game.rooms[name]) {
                    console.log('['+name+'] Memory: Delete Room Memory');
                    delete Memory.rooms[name];
                }else{
                    Game.rooms[name].sources.forEach((s) => { sourceIds.push(s.id) })
                    if(Game.rooms[name].terminal){ terminalIds.push(Game.rooms[name].terminal.id) }
                }
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
                        if(memory["role"] != "miner" && memory['role'] != "transporter"){
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

    moveToTarget(creep, options = { showPath:creep.room.memory.showPath, pathColor: "#ffffff", reusePath:creep.room.memory.reusePath }, target = creep.memory.target){
        let moveOptions = {reusePath: options.reusePath }
        if(options.showPath) {
            moveOptions.visualizePathStyle = {
                fill: 'transparent',
                stroke: options.pathColor,
                lineStyle: 'dashed',
                strokeWidth: .15,
                opacity: .1
            }
        }
        
        let result

        if(target instanceof Object && !(target instanceof RoomPosition) && target.x && target.y){
          //console.log(creep.name+"'s target is an Object with x&y")
          result = creep.moveTo(target.x,target.y,moveOptions);
        }else{
          result = creep.moveTo(target,moveOptions);
        }
        if(result === ERR_INVALID_ARGS){
            console.log("moveToTarget: Invalid Arguments")
        }else if(result === ERR_NOT_FOUND){
            console.log("moveToTarget: Path Not Found")
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

    // #TODO Externalize build config to json
    getRoleBuild(role,level = 1){
        //console.log('role:'+role+' - '+'level:'+level);
        var buildLib = {
            "scout":{
                1:[MOVE,MOVE,MOVE,MOVE,MOVE,MOVE],
                2:[WORK,CARRY,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE]
            },
            "harvester":{
                1:[WORK,CARRY,CARRY,MOVE,MOVE], //300
                2:[WORK,WORK,CARRY,CARRY,CARRY,MOVE,MOVE,MOVE,MOVE], //550
                3:[WORK,WORK,WORK,CARRY,CARRY,CARRY,CARRY,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE], //800
                4:[WORK,WORK,WORK,WORK,WORK,WORK,CARRY,CARRY,CARRY,CARRY,CARRY,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE], //1200
                5:[WORK,WORK,WORK,WORK,WORK,WORK,WORK,WORK,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE],//1600
                6:[WORK,WORK,WORK,WORK,WORK,WORK,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE], //1800
                7:[WORK,WORK,WORK,WORK,WORK,WORK,WORK,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE] //2100
            },
            "worker":{
                1:[WORK,CARRY,CARRY,MOVE,MOVE], //300
                2:[WORK,WORK,CARRY,CARRY,CARRY,MOVE,MOVE,MOVE,MOVE], //550
                3:[WORK,WORK,WORK,CARRY,CARRY,CARRY,CARRY,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE], //800
                4:[WORK,WORK,WORK,WORK,WORK,WORK,CARRY,CARRY,CARRY,CARRY,CARRY,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE], //1200
                5:[WORK,WORK,WORK,WORK,WORK,WORK,WORK,WORK,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE],//1600
                6:[WORK,WORK,WORK,WORK,WORK,WORK,WORK,WORK,WORK,WORK,WORK,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE], //2000
                7:[WORK,WORK,WORK,WORK,WORK,WORK,WORK,WORK,WORK,WORK,WORK,WORK,WORK,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE] //2400
            },
            "transporter":{
                1:[CARRY,CARRY,CARRY,MOVE,MOVE,MOVE], //300
                2:[CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,MOVE,MOVE,MOVE,MOVE,MOVE], //550
                3:[CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE], //800
                4:[CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE], // 1200
                5:[CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE], //1600
                6:[CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE] //2000
            },
            "transporter2":{
                1:[CARRY,CARRY,CARRY,MOVE,MOVE,MOVE], //300
                2:[CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,MOVE,MOVE,MOVE,MOVE,MOVE], //550
                3:[CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE], //800
                4:[CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE], // 1200
                5:[CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE], //1650
                6:[CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE] //2000
            },
            "miner":{
                1:[WORK,WORK,CARRY,MOVE], //300
                2:[WORK,WORK,WORK,WORK,CARRY,CARRY,MOVE], //550
                3:[WORK,WORK,WORK,WORK,WORK,WORK,CARRY,CARRY,MOVE,MOVE], //800
                4:[WORK,WORK,WORK,WORK,WORK,WORK,WORK,WORK,WORK,CARRY,CARRY,CARRY,MOVE,MOVE,MOVE], //1200
                5:[WORK,WORK,WORK,WORK,WORK,WORK,WORK,WORK,WORK,WORK,WORK,WORK,CARRY,CARRY,CARRY,CARRY,MOVE,MOVE,MOVE,MOVE] //1600
            },
            "defender": {
                1:[TOUGH,TOUGH,TOUGH,TOUGH,MOVE,MOVE,ATTACK,ATTACK],
                2:[TOUGH,TOUGH,TOUGH,TOUGH,TOUGH,TOUGH,MOVE,MOVE,MOVE,MOVE,ATTACK,ATTACK,ATTACK],
                3:[TOUGH,TOUGH,TOUGH,TOUGH,TOUGH,TOUGH,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,ATTACK,ATTACK,ATTACK,ATTACK],
                4:[TOUGH,TOUGH,TOUGH,TOUGH,TOUGH,TOUGH,TOUGH,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK],
                5:[TOUGH,TOUGH,TOUGH,TOUGH,TOUGH,TOUGH,TOUGH,TOUGH,TOUGH,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK]
            },
            "healer": {
                1:[MOVE,HEAL],
                2:[TOUGH,TOUGH,TOUGH,TOUGH,TOUGH,MOVE,MOVE,MOVE,MOVE,HEAL],
                3:[TOUGH,TOUGH,TOUGH,TOUGH,TOUGH,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,HEAL],
                4:[TOUGH,TOUGH,TOUGH,TOUGH,TOUGH,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,HEAL,HEAL],
                5:[TOUGH,TOUGH,TOUGH,TOUGH,TOUGH,TOUGH,TOUGH,TOUGH,TOUGH,TOUGH,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,HEAL,HEAL],
            },
            "attack": {
                1:[TOUGH,TOUGH,MOVE,MOVE,MOVE,MOVE,ATTACK], //300
                2:[TOUGH,TOUGH,TOUGH,TOUGH,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,ATTACK,ATTACK], //550
                3:[TOUGH,TOUGH,TOUGH,TOUGH,TOUGH,TOUGH,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,ATTACK,ATTACK,ATTACK], //800
                4:[TOUGH,TOUGH,TOUGH,TOUGH,TOUGH,TOUGH,TOUGH,TOUGH,TOUGH,TOUGH,TOUGH,TOUGH,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK],// 1200
                5:[TOUGH,TOUGH,TOUGH,TOUGH,TOUGH,TOUGH,TOUGH,TOUGH,TOUGH,TOUGH,TOUGH,TOUGH,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK],
                6:[TOUGH,TOUGH,TOUGH,TOUGH,TOUGH,TOUGH,TOUGH,TOUGH,TOUGH,TOUGH,TOUGH,TOUGH,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK]
            },
            "ranged": {
                1:[TOUGH,TOUGH,TOUGH,TOUGH,TOUGH,MOVE,MOVE,RANGED_ATTACK],
                2:[TOUGH,TOUGH,TOUGH,TOUGH,TOUGH,MOVE,MOVE,MOVE,RANGED_ATTACK,RANGED_ATTACK],
                3:[TOUGH,TOUGH,TOUGH,TOUGH,TOUGH,MOVE,MOVE,MOVE,MOVE,RANGED_ATTACK,RANGED_ATTACK,RANGED_ATTACK],
                4:[TOUGH,TOUGH,TOUGH,TOUGH,TOUGH,MOVE,MOVE,MOVE,MOVE,MOVE,RANGED_ATTACK,RANGED_ATTACK,RANGED_ATTACK,RANGED_ATTACK],
            },
            "claimer": {
                1:[CLAIM,MOVE,MOVE], // 750
                2:[CLAIM,CLAIM,MOVE,MOVE], //1350
                3:[CLAIM,CLAIM,CLAIM,MOVE,MOVE,MOVE,MOVE], //2000
            }
        }
        return buildLib[role.toLowerCase()][level];
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
    }
}

module.exports = util;
