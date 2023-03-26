const util = require('./util');
const rooms = require('./rooms');
const creeps = require('./creeps');

module.exports.loop = function () {
    //Cleanup Memory
    util.cleanupMemory();

    //Run Room Ops
    for(let name in Game.rooms){
        rooms.run(Game.rooms[name]);
    }

    //Run Creep Ops
    for(let name in Game.creeps) {
        creeps.run(Game.creeps[name]);
    }
}
