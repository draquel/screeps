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
                this.memory.sources = newValue.map(source => source.id);
                this._sources = newValue;
            },
            enumerable: false,
            configurable: true
        });

        Object.defineProperty(Room.prototype, 'mineral', {
            get: function () {
                if (!this._mineral) {
                    if (!this.memory.mineral) {
                        let result = this.find(FIND_MINERALS)
                        this.memory.mineral = result != null ? result[0].id : null
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
