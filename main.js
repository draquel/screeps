/* eslint-disable no-undef */

const proto = require('./screeps.prototype')
const rooms = require('./rooms');
const creeps = require('./creeps');
const traffic = require('./traffic');
const intel = require('./intel');
const logistics = require('./logistics');
const production = require('./production');
const power = require('./power');

module.exports.loop = function () {
    Game.util = require('./util');
    Game.cmd = require('./cmd');

  //Apply prototypes
    proto.load();
    traffic.install();

    //Cleanup Memory
    Game.util.cleanupMemory();
    if(Game.time % 1000 === 0){ intel.cleanup(); }

    //Update room intelligence (for Traveler routeCallback)
    intel.update();

    //Run Room Ops
    for(let name in Game.rooms){
        rooms.run(Game.rooms[name]);
    }

    //Empire production planner (lab jobs + booster labs), every N ticks.
    //Before logistics so new lab assignments show up as needs this tick.
    production.run();

    //Power mining ops (observer scan every tick, ops every N ticks)
    power.run();

    //Empire resource sharing (terminal sends + overflow sells), every N ticks
    logistics.run();

    //Run Creep Ops
    for(let name in Game.creeps) {
        creeps.run(Game.creeps[name]);
    }

    //Resolve queued movement intents (shoves, etc.)
    traffic.resolve();
}
