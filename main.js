const roleHarvester = require('role.harvester');
const roleBuilder = require('role.builder');
// const roleUpgrader = require('role.upgrader');
// const roleMaintenance = require('role.maintenance');
const utilRooms = require('util.room');
const utilCreeps = require('util.creep');
const util = require('./util.root');


module.exports.loop = function () {

    util.initGlobals();

    //Cleanup Creep Memory
    utilCreeps.cleanupMemory();

    //Room Operations
    var roomNames = Object.keys(Game.rooms);
    for(var i = 0; i < roomNames.length; i++){
        let room = Game.rooms[roomNames[i]];
        utilRooms.initData(room);
        utilRooms.run(room);
    }

    //Run Creep Roles
    for(var name in Game.creeps) {
        var creep = Game.creeps[name];
        if(creep.memory.role == 'harvester') {
            roleHarvester.run(creep);
        }
        if(creep.memory.role == 'builder') {
            roleBuilder.run(creep);
        }
        // if(creep.memory.role == 'upgrader') {
        //     roleUpgrader.run(creep);
        // }
        // 
        // if(creep.memory.role == 'maintenance') {
        //     roleMaintenance.run(creep);
        // }
    }
}