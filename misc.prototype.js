/* eslint-disable no-undef */
const _l = require('lodash');
module.exports =  {

    load(){
        Object.defineProperty(Source.prototype, 'memory', {
            configurable: true,
            get: function() {
                if(_l.isUndefined(Memory.sources)) {
                    Memory.sources = {};
                }
                if(!_l.isObject(Memory.sources)) {
                    return undefined;
                }
                return Memory.sources[this.id] =
                    Memory.sources[this.id] || {};
            },
            set: function(value) {
                if(_l.isUndefined(Memory.sources)) {
                    Memory.sources = {};
                }
                if(!_l.isObject(Memory.sources)) {
                    throw new Error('Could not set source memory');
                }
                Memory.sources[this.id] = value;
            }
        });

        Object.defineProperty(StructureTower.prototype, 'memory', {
            configurable: true,
            get: function() {
                if(_l.isUndefined(Memory.towers)) {
                    Memory.towers = {};
                }
                if(!_l.isObject(Memory.towers)) {
                    return undefined;
                }
                return Memory.towers[this.id] =
                    Memory.towers[this.id] || {};
            },
            set: function(value) {
                if(_l.isUndefined(Memory.towers)) {
                    Memory.towers = {};
                }
                if(!_l.isObject(Memory.towers)) {
                    throw new Error('Could not set tower memory');
                }
                Memory.towers[this.id] = value;
            }
        });

        Object.defineProperty(StructureLab.prototype, 'memory', {
            configurable: true,
            get: function() {
                if(_l.isUndefined(Memory.labs)) {
                    Memory.labs = {};
                }
                if(!_l.isObject(Memory.labs)) {
                    return undefined;
                }
                return Memory.labs[this.id] =
                    Memory.labs[this.id] || {};
            },
            set: function(value) {
                if(_l.isUndefined(Memory.labs)) {
                    Memory.labs = {};
                }
                if(!_l.isObject(Memory.labs)) {
                    throw new Error('Could not set lab memory');
                }
                Memory.labs[this.id] = value;
            }
        });

        Object.defineProperty(StructureTerminal.prototype, 'memory', {
            configurable: true,
            get: function() {
                if(_l.isUndefined(Memory.terminals)) {
                    Memory.terminals = {};
                }
                if(!_l.isObject(Memory.terminals)) {
                    return undefined;
                }
                return Memory.terminals[this.id] =
                    Memory.terminals[this.id] || {};
            },
            set: function(value) {
                if(_l.isUndefined(Memory.terminals)) {
                    Memory.terminals = {};
                }
                if(!_l.isObject(Memory.terminals)) {
                    throw new Error('Could not set terminal memory');
                }
                Memory.terminals[this.id] = value;
            },
        });

        StructureTerminal.prototype.addDeal = function(deal){
          let order = Game.market.getOrderById(deal.id);
          if(Memory.terminals[this.id].deals == undefined) { Memory.terminals[this.id].deals = [] }
          if(order && deal.amount > 0){
            console.log("Queuing Deal in "+this.room.name+": ["+order.id+"] - "+order.resourceType+" x "+deal.amount+" @ "+order.price+ " ["+(deal.amount*order.price)+"]")
            Memory.terminals[this.id].deals.push(deal)
          }
        }

        Object.defineProperty(StructureFactory.prototype, 'memory', {
            configurable: true,
            get: function() {
                if(_l.isUndefined(Memory.factories)) {
                    Memory.factories = {};
                }
                if(!_l.isObject(Memory.factories)) {
                    return undefined;
                }
                return Memory.factories[this.id] =
                    Memory.factories[this.id] || {};
            },
            set: function(value) {
                if(_l.isUndefined(Memory.factories)) {
                    Memory.factories = {};
                }
                if(!_l.isObject(Memory.factories)) {
                    throw new Error('Could not set factory memory');
                }
                Memory.factories[this.id] = value;
            }
        });

        Object.defineProperty(Source.prototype, 'openSpaces', {
            get: function () {
                if (this._lopenSpaces == undefined) {
                    if (this.memory.openSpaces == undefined) {
                        let openSpaces = 0;
                        [this.pos.x - 1, this.pos.x, this.pos.x + 1].forEach(x => {
                            [this.pos.y - 1, this.pos.y, this.pos.y + 1].forEach(y => {
                                if (Game.map.getRoomTerrain(this.pos.roomName).get(x, y) !== TERRAIN_MASK_WALL)
                                    openSpaces++;
                            }, this);
                        }, this);
                        this.memory.openSpaces = openSpaces;
                    }
                    this._lopenSpaces = this.memory.openSpaces;
                }
                return this._lopenSpaces;
            },
            enumerable: false,
            configurable: true
        });
    }

}


