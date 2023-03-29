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

Game driver module.

## Util

Generic functionality which applies to multiple modules.

## Rooms

The Rooms module enables spawn queues, runs towers and links. Labs are next to be added

### Spawn Queues
    
Each Room has a spawn queue in its memory used to handle auto-respawn, dynamic spawning and managing creeps based on their roles.

## Creeps

The Creeps Module handles creep roles.
