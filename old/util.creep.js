var _ = require('lodash');
var utils = require('util.root');

var creepUtil = {
    /** @param {Creep} creep */
    collectEnergy: function(creep){
        var sources = creep.room.find(FIND_SOURCES);
        var ruins = creep.room.find(FIND_RUINS,{filter: (ruin) => { return ruin.store.getUsedCapacity(RESOURCE_ENERGY) > 0; }});
        var drops = creep.room.find(FIND_DROPPED_RESOURCES,{filter: (res) => { return res.resourceType == RESOURCE_ENERGY; }});
        var targets = [...sources,...ruins,...drops];

        targets.sort((a,b) => {
            var toA = utils.distBetweenPos(creep.pos,a.pos);
            var toB = utils.distBetweenPos(creep.pos,b.pos);
            if(toA < toB){ return -1; }else if(toA > toB){ return 1;}else{ return 0}
        })
        target = targets[0];

        if(target instanceof Resource){
            if(creep.pickup(target) == ERR_NOT_IN_RANGE) {
                creep.moveTo(target, {visualizePathStyle: {stroke: '#ffaa00'},reusePath:3});
            }
        }else if(target instanceof Ruin){
            if(creep.withdraw(ruins[i],RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                creep.moveTo(ruins[i], {visualizePathStyle: {stroke: '#ffaa00'},reusePath:3});
            }
        }else if(target instanceof Source){
            if(creep.memory.role == "harvester" && utils.openSpacesNearPos(target.pos) == utils.creepsNearPos(target.pos) && utils.distBetweenPos(creep.pos,target.pos) > 1.5){
                for(var i = 0; i < sources.length; i++){
                    if(sources[i].id == target.id){
                        continue;
                    }else{
                        target = sources[i];
                        break;
                    }
                }
            }
            if(creep.harvest(target) == ERR_NOT_IN_RANGE) {
                creep.moveTo(target, {visualizePathStyle: {stroke: '#ffaa00'},reusePath:3});
            }
        }
    },
    /** 
     * @param {Creep} creep
     * @param {String} role
     *  **/
    assignRole: function(creep,role) {
        creep.say('Assigned to '+role.charAt(0).toUpperCase()+role.slice(1));
        creep.memory.role = role;
    },
    setTarget: function(creep,target){
        creep.say('Targeting '+target.name);
        creep.memory.target = target;
    },
    getTargets: function(creeps){
        var targets = [];
        for(var i = 0; i< creeps.length; i++){
            if(creeps[i].memory.target){
                targets.push(creeps[i].memory.target);
            }
        }

        return targets;
    },
    calcBuildEnergy(build){
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
        memory.home = spawn.id;
        var build = this.getRoleBuild(memory.role,memory.level);
        var energy = this.calcBuildEnergy(build);
        var type = (memory.role != null ? memory.role.charAt(0).toUpperCase()+memory.role.slice(1)+" Level "+memory.level : 'Creep');
        if(spawn.room.energyAvailable >= energy){
            if(spawn.busy){ return ERR_BUSY; }
            console.log('Spawning '+type+' ('+energy+'E) : \"' + name + '\"');
            spawn.busy = true;
           return spawn.spawnCreep(build,name,{memory:memory})
        }else{
            return ERR_NOT_ENOUGH_ENERGY;
        }
    },
    getRoleBuild(role,level = 1){
        var buildLib = {
            "harvester":{
                1:[WORK,CARRY,CARRY,MOVE,MOVE],
                2:[WORK,WORK,CARRY,CARRY,CARRY,MOVE,MOVE,MOVE]
            },
            "builder":{
                1:[WORK,CARRY,CARRY,MOVE,MOVE],
                2:[WORK,WORK,CARRY,CARRY,CARRY,MOVE,MOVE,MOVE]
            }
        }
        return buildLib[role][level];
    },
    checkRoleRespawnCount: function(role){
        var creeps = 0;
        for(var name in Memory.creeps) {
            if(!Game.creeps[name]){
                if(Memory.creeps[name].respawn){
                    creeps++;
                }
            }
        }
        return creeps;
    },
    cleanupMemory: function(){
        if(Object.keys(Memory.creeps).length > Object.keys(Game.creeps).length){
            for(var name in Memory.creeps) {
                if(!Game.creeps[name]) {
                    if(Memory.creeps[name].respawn){
                        var spawn = Game.getObjectById(Memory.creeps[name].home);
                        if(!spawn.spawning && spawn.room.energyAvailable >= this.calcBuildEnergy(this.getRoleBuild(Memory.creeps[name].role,Memory.creeps[name].level))){
                            console.log('Auto-Respawning: '+name);
                            this.spawnCreep(spawn,name,Memory.creeps[name]);
                        }
                    }else{
                        delete Memory.creeps[name];
                        console.log('Clearing non-existing creep memory:', name);
                    }
                    
                }
            }
        }
    },
    kill: function(creep){
        creep.memory.respawn = false;
        creep.suicide();
    },
    nameGenerator: function(){
        var names = ['Adam','Al','Alan','Archibald','Buzz','Carson','Chad','Charlie','Chris','Chuck','Dean','Ed','Edan','Edlu','Frank','Franklin','Gus','Hans','Jack','James','Jim','Kirk','Kurt','Lars','Luke','Mac','Matt','Phil','Randall','Scott','Scott','Sean','Steve','Tom','Will'];
        var prefixes = ['Ad','Al','Ald','An','Bar','Bart','Bil','Billy-Bob','Bob','Bur','Cal','Cam','Chad','Cor','Dan','Der','Des','Dil','Do','Don','Dood','Dud','Dun','Ed','El','En','Er','Fer','Fred','Gene','Geof','Ger','Gil','Greg','Gus','Had','Hal','Han','Har','Hen','Her','Hud','Jed','Jen','Jer','Joe','John','Jon','Jor','Kel','Ken','Ker','Kir','Lan','Lem','Len','Lo','Lod','Lu','Lud','Mac','Mal','Mat','Mel','Mer','Mil','Mit','Mun','Ned','Neil','Nel','New','Ob','Or','Pat','Phil','Ray','Rib','Rich','Ro','Rod','Ron','Sam','Sean','See','Shel','Shep','Sher','Sid','Sig','Son','Thom','Thomp','Tom','Wehr','Wil'];
        var suffixes = ['ald','bal','bald','bart','bas','berry','bert','bin','ble','bles','bo','bree','brett','bro','bur','burry','bus','by','cal','can','cas','cott','dan','das','den','din','do','don','dorf','dos','dous','dred','drin','dun','ely','emone','emy','eny','fal','fel','fen','field','ford','fred','frey','frey','frid','frod','fry','furt','gan','gard','gas','gee','gel','ger','gun','hat','ing','ke','kin','lan','las','ler','ley','lie','lin','lin','lo','lock','long','lorf','ly','mal','man','min','ming','mon','more','mund','my','nand','nard','ner','ney','nie','ny','oly','ory','rey','rick','rie','righ','rim','rod','ry','sby','sel','sen','sey','ski','son','sted','ster','sy','ton','top','trey','van','vey','vin','vis','well','wig','win','wise','zer','zon','zor'];
        var algRGN = Math.random();
        
        var generated = "";
        if(algRGN <= 0.05){
            generated = names[Math.floor(Math.random()*names.length)];
        }else{
            generated = prefixes[Math.floor(Math.random()*prefixes.length)] + suffixes[Math.floor(Math.random()*suffixes.length)];
        }
        
        var existing = Object.keys(Game.creeps);
        if(existing.includes(generated)){
            generated = this.nameGenerator();
        }

        return generated;
    }
}

module.exports = creepUtil;