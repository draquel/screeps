

module.exports = {

    load() {
        Object.defineProperty(Creep.prototype, 'isFull', {
            get: function(resource = RESOURCE_ENERGY) {
                if (!this._isFull) {
                    this._isFull = this.store.getFreeCapacity(resource) === 0;
                }
                return this._isFull;
            },
            enumerable: false,
            configurable: true
        });

        Object.defineProperty(Creep.prototype, 'work', {
            get: function(resource = RESOURCE_ENERGY) {
                if (!this._work) {
                    this._work = require("./creeps.work");
                }
                return this._work;
            },
            enumerable: false,
            configurable: true
        });
    }
}
