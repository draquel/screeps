/* eslint-disable no-undef */

module.exports = {

    load() {

        Object.defineProperty(Room.prototype, 'sources', {
            get: function () {
                if (!this._sources) {
                    if (!this.memory.sourceIds) {
                        this.memory.sourceIds = this.find(FIND_SOURCES).map(source => source.id);
                    }
                    this._sources = this.memory.sourceIds.map(id => Game.getObjectById(id));
                }
                return this._sources;
            },
            set: function (newValue) {
                this.memory.sourceIds = newValue.map(source => source.id);
                this._sources = newValue;
            },
            enumerable: false,
            configurable: true
        });

        Object.defineProperty(Room.prototype, 'mineral', {
            get: function () {
                if (!this._mineral) {
                    if (this.memory.mineral === undefined) {
                        let result = this.find(FIND_MINERALS)
                        this.memory.mineral = result.length ? result[0].id : null
                    }
                    this._mineral = this.memory.mineral != null ? Game.getObjectById(this.memory.mineral) : null;
                }
                return this._mineral;
            },
            set: function (newValue) {
                this.memory.mineral = newValue.id;
                this._mineral = newValue;
            },
            enumerable: false,
            configurable: true
        });

        Object.defineProperty(Room.prototype, 'factory', {
            get: function () {
                if (!this._factory) {
                    // A cached "no factory" (null) is rechecked every 100 ticks so a
                    // newly built factory is picked up; a cached id whose structure
                    // is gone is cleared and rechecked next access.
                    if (this.memory.factoryId === undefined || (this.memory.factoryId === null && Game.time % 100 === 0)) {
                        let result = this.find(FIND_MY_STRUCTURES, {filter: s => s.structureType === STRUCTURE_FACTORY});
                        this.memory.factoryId = result.length ? result[0].id : null;
                    }
                    this._factory = this.memory.factoryId != null ? Game.getObjectById(this.memory.factoryId) : null;
                    if (this.memory.factoryId != null && !this._factory) delete this.memory.factoryId;
                }
                return this._factory;
            },
            set: function (newValue) {
                this.memory.factoryId = newValue ? newValue.id : null;
                this._factory = newValue;
            },
            enumerable: false,
            configurable: true
        });

        Object.defineProperty(Room.prototype, 'deposit', {
          //get: function () {},
            set: function (newValue) {
                this.memory.sources = newValue.id;
                this._sources = newValue;
            },
            enumerable: false,
            configurable: true
        });

    }
}
