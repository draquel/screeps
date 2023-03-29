var util = {

    cleanupMemory: function(){
        if(!Memory.creeps && !Memory.rooms){ return; }

        if(Object.keys(Memory.rooms).length > Object.keys(Game.rooms).length){
            for(let name in Memory.rooms) {
                if (!Game.rooms[name]) {
                    console.log('Clearing Room Memory: ', name);
                    delete Memory.rooms[name];
                }
            }
        }

        if(Object.keys(Memory.creeps).length > Object.keys(Game.creeps).length){
            for(let name in Memory.creeps) {
                if(!Game.creeps[name]) {
                    if(Memory.creeps[name].respawn && Object.keys(Memory.rooms).includes(Memory.creeps[name].room)){
                        let room = Game.rooms[Memory.creeps[name].room];
                        let memory = Memory.creeps[name];
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

    getCreepProp: function(creeps = [],property = 'role'){
        return creeps.map((c) => c.memory[property]);
    },

    setCreepProp: function(creeps = Game.creeps,property = null,value = null){
        for(let i = 0; i< creeps.length; i++){
            console.log(creeps[i].name + ' : ' + property + ' : ' + value);
            creeps[i].memory[property] = value;
        }
    },

    getCreepsByRole: function(room,role){
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
        var type = (memory.role != null ? memory.role.charAt(0).toUpperCase()+memory.role.slice(1)+" Level "+memory.level : 'Creep');
        if(spawn.room.energyAvailable >= energy){
            if(spawn.busy){ return ERR_BUSY; }
            console.log('Spawning '+type+' ('+energy+'E) : \"' + name + '\"');
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

    // #TODO Externalize build config to json
    getRoleBuild(role,level = 1){
        //console.log('role:'+role+' - '+'level:'+level);
        var buildLib = {
            "scout":{
                1:[MOVE,MOVE,MOVE,MOVE,MOVE],
                2:[WORK,CARRY,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE]
            },
            "harvester":{
                1:[WORK,CARRY,CARRY,MOVE,MOVE],
                2:[WORK,WORK,CARRY,CARRY,CARRY,MOVE,MOVE,MOVE]
            },
            "r-harvester":{
                1:[WORK,CARRY,CARRY,MOVE,MOVE],
                2:[WORK,WORK,CARRY,CARRY,MOVE,MOVE,MOVE,MOVE],
                3:[WORK,WORK,CARRY,CARRY,CARRY,CARRY,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE],
                4:[WORK,WORK,WORK,CARRY,CARRY,CARRY,CARRY,CARRY,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE],
            },
            "builder":{
                1:[WORK,CARRY,CARRY,MOVE,MOVE],
                2:[WORK,WORK,CARRY,CARRY,CARRY,MOVE,MOVE,MOVE],
                3:[WORK,WORK,WORK,CARRY,CARRY,CARRY,MOVE,MOVE,MOVE,MOVE,MOVE],
                4:[WORK,WORK,WORK,WORK,CARRY,CARRY,CARRY,CARRY,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE]
            },
            "maintenance":{
                1:[WORK,CARRY,CARRY,MOVE,MOVE],
                2:[WORK,WORK,CARRY,CARRY,MOVE,MOVE,MOVE,MOVE],
                3:[WORK,WORK,CARRY,CARRY,CARRY,CARRY,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE],
                4:[WORK,WORK,WORK,CARRY,CARRY,CARRY,CARRY,CARRY,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE]
            },
            "d-maintenance":{
                1:[WORK,CARRY,CARRY,MOVE,MOVE],
                2:[WORK,WORK,CARRY,CARRY,MOVE,MOVE,MOVE,MOVE],
                3:[WORK,WORK,CARRY,CARRY,CARRY,CARRY,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE],
                4:[WORK,WORK,WORK,CARRY,CARRY,CARRY,CARRY,CARRY,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE]
            },
            "e-maintenance":{
                1:[CARRY,CARRY,CARRY,MOVE,MOVE,MOVE],
                2:[CARRY,CARRY,CARRY,CARRY,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE],
                3:[CARRY,CARRY,CARRY,CARRY,CARRY,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE],
                4:[CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE]
            },
            "c-miner":{
                1:[WORK,WORK,CARRY,MOVE],
                2:[WORK,WORK,WORK,WORK,CARRY,MOVE],
                3:[WORK,WORK,WORK,WORK,WORK,WORK,CARRY,MOVE],
                4:[WORK,WORK,WORK,WORK,WORK,WORK,WORK,CARRY,CARRY,MOVE,MOVE]
            },
            "defender": {
                1:[ATTACK,ATTACK,MOVE,MOVE,TOUGH,TOUGH,TOUGH,TOUGH],
                2:[ATTACK,ATTACK,ATTACK,MOVE,MOVE,MOVE,MOVE,TOUGH,TOUGH,TOUGH,TOUGH,TOUGH,TOUGH],
                3:[ATTACK,ATTACK,ATTACK,ATTACK,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,TOUGH,TOUGH,TOUGH,TOUGH],
                4:[ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,TOUGH,TOUGH,TOUGH,TOUGH,TOUGH,TOUGH],
            },
            "healer": {
                1:[HEAL,MOVE],
                2:[HEAL,MOVE,MOVE,MOVE,MOVE,TOUGH,TOUGH,TOUGH,TOUGH,TOUGH],
                3:[HEAL,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,TOUGH,TOUGH,TOUGH,TOUGH,TOUGH],
                4:[HEAL,HEAL,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,TOUGH,TOUGH,TOUGH,TOUGH,TOUGH],
                5:[HEAL,HEAL,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,TOUGH,TOUGH,TOUGH,TOUGH,TOUGH,TOUGH,TOUGH,TOUGH,TOUGH,TOUGH],
            },
            "attack": {
                1:[ATTACK,ATTACK,MOVE,MOVE,TOUGH,TOUGH,TOUGH,TOUGH],
                2:[ATTACK,ATTACK,ATTACK,MOVE,MOVE,MOVE,MOVE,TOUGH,TOUGH,TOUGH,TOUGH,TOUGH,TOUGH],
                3:[ATTACK,ATTACK,ATTACK,ATTACK,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,TOUGH,TOUGH,TOUGH,TOUGH],
                4:[ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,TOUGH,TOUGH,TOUGH,TOUGH,TOUGH,TOUGH,TOUGH],
                5:[ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,TOUGH,TOUGH,TOUGH,TOUGH,TOUGH,TOUGH,TOUGH,TOUGH,TOUGH],
            },
            "ranged": {
                1:[RANGED_ATTACK,MOVE,MOVE,TOUGH,TOUGH,TOUGH,TOUGH,TOUGH],
                2:[RANGED_ATTACK,ATTACK,RANGED_ATTACK,MOVE,MOVE,MOVE,TOUGH,TOUGH,TOUGH,TOUGH,TOUGH],
                3:[RANGED_ATTACK,RANGED_ATTACK,RANGED_ATTACK,MOVE,MOVE,MOVE,MOVE,TOUGH,TOUGH,TOUGH,TOUGH,TOUGH],
                4:[RANGED_ATTACK,RANGED_ATTACK,RANGED_ATTACK,RANGED_ATTACK,MOVE,MOVE,MOVE,MOVE,MOVE,TOUGH,TOUGH,TOUGH,TOUGH,TOUGH],
            },
            "claimer": {
                1:[CLAIM,MOVE,MOVE,MOVE,MOVE],
                2:[CLAIM,CLAIM,MOVE,MOVE,MOVE,MOVE]
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
    }
}

module.exports = util;
