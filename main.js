
const proto = require('./screeps.prototype')
const rooms = require('./rooms');
const creeps = require('./creeps');

module.exports.loop = function () {
    Game.util = require('./util');
    Game.cmd = require('./cmd');

    //Apply prototypes
    proto.load();

    //Cleanup Memory
    Game.util.cleanupMemory();

    //Run Room Ops
    for(let name in Game.rooms){
        rooms.run(Game.rooms[name]);
    }

    //Run Creep Ops
    for(let name in Game.creeps) {
        creeps.run(Game.creeps[name]);
    }
}
