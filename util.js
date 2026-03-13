/* eslint-disable no-undef */
// noinspection JSUnresolvedReference

var util = {

    cleanupMemory: function(){
        if(!Memory.creeps && !Memory.rooms){ return; }

        //Rooms
        if(Memory.rooms && Object.keys(Memory.rooms).length > Object.keys(Game.rooms).length){
            let sourceIds = []
            for(let name in Memory.rooms) {
                if (!Game.rooms[name]) {
                    console.log('Clearing Room Memory: ', name);
                    delete Memory.rooms[name];
                }else{
                    Game.rooms[name].sources.forEach((s) => { sourceIds.push(s.id) })
                }
            }
            //Sources
            for(let id in Memory.sources){
                if(!sourceIds.includes(id)){
                    console.log('   Source Memory: ', id);
                    delete Memory.sources[id]
                }
            }
        }

        //Creeps
        if(Memory.creeps && Object.keys(Memory.creeps).length > Object.keys(Game.creeps).length){
            for(let name in Memory.creeps) {
                if(!Game.creeps[name]) {
                    if(Memory.creeps[name].respawn && Object.keys(Memory.rooms).includes(Memory.creeps[name].room)){
                        let room = Game.rooms[Memory.creeps[name].room];
                        let memory = Memory.creeps[name];
                        if(memory["role"] != "miner" && memory['role'] != "transporter"){
                            memory['target'] = null;
                            memory['targetCollect'] = null;
                            memory['targetDeposit'] = null;
                        }
                        if(room === undefined){ continue; }
                        console.log('Auto-Respawn: Queuing '+name+' in '+room.name);
                        room.memory.spawnQueue.push({name:name, memory:memory})
                    }else{
                        console.log('Clearing Creep Memory: ', name);
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

        let result = creep.moveTo(target,moveOptions);
        if(result === ERR_INVALID_ARGS){
            console.log("moveToTarget: Invalid Arguments")
        }else if(result === ERR_NOT_FOUND){
            console.log("moveToTarget: Path Not Found")
        }else if(result === ERR_NO_BODYPART){
            console.log("moveToTarget: Missing required BodyPart")
        }
        return result;
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

    getCreepProp: function(creeps = [],property = 'role'){
        //console.log(creeps[i].name + ' : ' + property + ' : ' + value);
        return creeps.map((c) => c.memory[property]).filter(x => !!x);
    },

    setCreepProp: function(creeps = Game.creeps,property = null,value = null){
        for(let i = 0; i< creeps.length; i++){
            console.log(creeps[i].name + ' : ' + property + ' : ' + value);
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

    getCreepPropsByRole: function(room,role,property){
        return this.getCreepProp(this.getCreepsByRole(room,role),property);
    },

    setCreepPropsByRole: function(room,role,property,value){
        return this.setCreepProp(this.getCreepsByRole(room,role),property,value);
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
        var type = (memory.role != null ? memory.role.charAt(0).toUpperCase()+memory.role.slice(1)+" L"+memory.level : 'Creep')+ ' ('+energy+'E)';
        if(spawn.room.energyAvailable >= energy){
            if(spawn.busy){ return ERR_BUSY; }
            console.log('Spawning '+type+' : \"' + name + '\" in '+memory.room);
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

    computeBuild(role,level = 1){
        let partValues = {
            'TOUGH': 10,
            'CARRY': 50,
            'MOVE': 50,
            'WORK': 100,
            'ATTACK': 80,
            'RANGED_ATTACK': 150,
            'HEAL': 250,
            'CLAIM': 600
        }
        let build = {
            // 'TOUGH': 0,
            // 'CARRY': 0,
            // 'MOVE': 0,
            // 'ATTACK': 0,
            // 'WORK': 0,
            // 'RANGED_ATTACK': 0,
            // 'HEAL': 0,
            // 'CLAIM': 0
        }
        switch(role){
            case "scout":
                build.MOVE = 1
                break;
            case "harvester":
                build.WORK = 0.35
                build.CARRY = 0.35
                build.MOVE = 0.35
                break;
            case "builder":
                build.WORK = 1
                build.CARRY = 1
                build.MOVE = 1
                break;
            case "miner":
                build.WORK = 0.5
                build.CARRY = 0.25
                build.MOVE = 0.25
                break;
            case "maintenance":
                build.WORK = 0.3
                build.CARRY = 0.3
                build.MOVE = 0.4
                break;
            case "transporter":
                build.CARRY = 0.6
                build.MOVE = 0.4
              break;
            case "claimer":
                build.CLAIM =  0.75
                build.MOVE = 0.25
              break;
        }
        console.log(Object.keys(build))
        let energy = level * 300
        let result = []
        // for(let key of Object.keys(build)){
        //     let partLimit = energy * build[key] / partValues[key]
        //     console.log(key + " - " + energy * build[key] +" - "+ partLimit)
        //     let partCount = 1
        //     while(partCount < partLimit){
        //         result.push(key)
        //         partCount++
        //     }
        // }

        for(let key of Object.keys(build)){
            let partCount = Math.round(build[key] * level)
            while(partCount > 0){
                result.push(key)
                partCount--
            }
        }
        console.log("Energy: " + this.calcCreepBuildEnergy(result))
        return result
    },

    // #TODO Externalize build config to json
    getRoleBuild(role,level = 1){
        //console.log('role:'+role+' - '+'level:'+level);
        var buildLib = {
            "scout":{
                1:[MOVE,MOVE,MOVE,MOVE,MOVE],
                2:[WORK,CARRY,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE]
            },
            "harvester":{
                1:[WORK,CARRY,CARRY,MOVE,MOVE], //300
                2:[WORK,WORK,CARRY,CARRY,MOVE,MOVE,MOVE,MOVE], //600
                3:[WORK,WORK,WORK,CARRY,CARRY,CARRY,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE], //900
                4:[WORK,WORK,WORK,WORK,CARRY,CARRY,CARRY,CARRY,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE], //1200
                5:[WORK,WORK,WORK,WORK,WORK,CARRY,CARRY,CARRY,CARRY,CARRY,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE],//1500
                6:[WORK,WORK,WORK,WORK,WORK,WORK,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE], //1800
                7:[WORK,WORK,WORK,WORK,WORK,WORK,WORK,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE] //2100
            },
            "builder":{
                1:[WORK,CARRY,CARRY,MOVE,MOVE], //300
                2:[WORK,WORK,CARRY,CARRY,MOVE,MOVE,MOVE,MOVE], //600
                3:[WORK,WORK,WORK,CARRY,CARRY,CARRY,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE], //900
                4:[WORK,WORK,WORK,WORK,CARRY,CARRY,CARRY,CARRY,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE], //1200
                5:[WORK,WORK,WORK,WORK,WORK,CARRY,CARRY,CARRY,CARRY,CARRY,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE],//1500
                6:[WORK,WORK,WORK,WORK,WORK,WORK,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE], //1800
                7:[WORK,WORK,WORK,WORK,WORK,WORK,WORK,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE] //2100
            },
            "worker":{
                1:[WORK,CARRY,CARRY,MOVE,MOVE], //300
                2:[WORK,WORK,CARRY,CARRY,MOVE,MOVE,MOVE,MOVE], //600
                3:[WORK,WORK,WORK,CARRY,CARRY,CARRY,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE], //900
                4:[WORK,WORK,WORK,WORK,CARRY,CARRY,CARRY,CARRY,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE], //1200
                5:[WORK,WORK,WORK,WORK,WORK,CARRY,CARRY,CARRY,CARRY,CARRY,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE],//1500
                6:[WORK,WORK,WORK,WORK,WORK,WORK,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE], //1800
                7:[WORK,WORK,WORK,WORK,WORK,WORK,WORK,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE] //2100
            },
            "maintenance":{
                1:[WORK,CARRY,CARRY,MOVE,MOVE], //300
                2:[WORK,WORK,CARRY,CARRY,MOVE,MOVE,MOVE,MOVE], //600
                3:[WORK,WORK,WORK,CARRY,CARRY,CARRY,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE], //900
                4:[WORK,WORK,WORK,WORK,CARRY,CARRY,CARRY,CARRY,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE], //1200
                5:[WORK,WORK,WORK,WORK,WORK,CARRY,CARRY,CARRY,CARRY,CARRY,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE],//1500
                6:[WORK,WORK,WORK,WORK,WORK,WORK,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE], //1800
                7:[WORK,WORK,WORK,WORK,WORK,WORK,WORK,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE] //2100
            },
            "d-maintenance":{
                1:[WORK,CARRY,CARRY,MOVE,MOVE], //300
                2:[WORK,WORK,CARRY,CARRY,MOVE,MOVE,MOVE,MOVE], //600
                3:[WORK,WORK,WORK,CARRY,CARRY,CARRY,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE], //900
                4:[WORK,WORK,WORK,WORK,CARRY,CARRY,CARRY,CARRY,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE], //1200
                5:[WORK,WORK,WORK,WORK,WORK,CARRY,CARRY,CARRY,CARRY,CARRY,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE],//1500
                6:[WORK,WORK,WORK,WORK,WORK,WORK,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE], //1800
                7:[WORK,WORK,WORK,WORK,WORK,WORK,WORK,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE] //2100
            },
            "transporter":{
                1:[CARRY,CARRY,CARRY,MOVE,MOVE,MOVE], //300
                2:[CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE], //600
                3:[CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE], //900
                4:[CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE], // 1200
                5:[CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE], //1500
                6:[CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE] //1800
            },
            "miner":{
                1:[WORK,WORK,CARRY,MOVE], //300
                2:[WORK,WORK,WORK,WORK,WORK,CARRY,MOVE], //600
                3:[WORK,WORK,WORK,WORK,WORK,WORK,WORK,CARRY,CARRY,MOVE,MOVE], //900
                4:[WORK,WORK,WORK,WORK,WORK,WORK,WORK,WORK,WORK,CARRY,CARRY,CARRY,MOVE,MOVE,MOVE], //1200
                5:[WORK,WORK,WORK,WORK,WORK,WORK,WORK,WORK,WORK,WORK,WORK,WORK,CARRY,CARRY,CARRY,MOVE,MOVE,MOVE] //1500
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
                2:[TOUGH,TOUGH,TOUGH,TOUGH,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,ATTACK,ATTACK], //500
                3:[TOUGH,TOUGH,TOUGH,TOUGH,TOUGH,TOUGH,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,ATTACK,ATTACK,ATTACK], //750
                4:[TOUGH,TOUGH,TOUGH,TOUGH,TOUGH,TOUGH,TOUGH,TOUGH,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,ATTACK,ATTACK,ATTACK,ATTACK],// 920
                5:[TOUGH,TOUGH,TOUGH,TOUGH,TOUGH,TOUGH,TOUGH,TOUGH,TOUGH,TOUGH,TOUGH,TOUGH,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK]
            },
            "ranged": {
                1:[TOUGH,TOUGH,TOUGH,TOUGH,TOUGH,MOVE,MOVE,RANGED_ATTACK],
                2:[TOUGH,TOUGH,TOUGH,TOUGH,TOUGH,MOVE,MOVE,MOVE,RANGED_ATTACK,RANGED_ATTACK],
                3:[TOUGH,TOUGH,TOUGH,TOUGH,TOUGH,MOVE,MOVE,MOVE,MOVE,RANGED_ATTACK,RANGED_ATTACK,RANGED_ATTACK],
                4:[TOUGH,TOUGH,TOUGH,TOUGH,TOUGH,MOVE,MOVE,MOVE,MOVE,MOVE,RANGED_ATTACK,RANGED_ATTACK,RANGED_ATTACK,RANGED_ATTACK],
            },
            "claimer": {
                1:[CLAIM,MOVE,MOVE,MOVE,MOVE], // 800
                2:[CLAIM,CLAIM,MOVE,MOVE,MOVE,MOVE], //1400
                3:[CLAIM,CLAIM,CLAIM,MOVE,MOVE,MOVE,MOVE],
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
