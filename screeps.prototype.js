const protoMisc = require('./misc.prototype')
const protoRoom = require('./room.prototype')
const protoCreep = require('./creep.prototype')

module.exports = {

    load(){
        //Apply prototypes
        protoMisc.load()
        protoRoom.load()
        protoCreep.load()
    }

}
