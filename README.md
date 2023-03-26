# Screeps

Modules are designed around game objects and contain run functions 
    to deliver their functionality through the passed game object.

Example:
```javascript
    const rooms = require('./rooms');
    for(let name in Game.rooms){
        rooms.run(Game.rooms[name]);
    }
```

# Modules

## Main

## Util

## Rooms

The Rooms module enables spawn queues, runs towers and links. Labs are next to be added

### Spawn Queues

## Creeps

