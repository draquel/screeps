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

### Towers & Links

### Spawn Queues
Each Room has a spawn queue in its memory used to handle auto-respawn, dynamic spawning and managing creeps based on their roles.

### Mining Crews



## Creeps
The Creeps Module handles creep roles and supports creep actions with logic for obtaining targets for resource management or combat.

### Roles
The roles use various memory attributes to achieve and optimize their actions. There are two classes of roles, Worker and Combat. 


#### Scout
Simple test unit and scout that only has move parts.
#### Harvester
The first unit which can harvest resources, restore base energy and upgrade the controller. Unit can be given a targetRoom which will turn it into a remote harvester which has the same priorities.
#### Builder
Construction unit which will prioritize construction sites and fall back to upgrading the controller.
#### Maintenance
Repair unit which will prioritize the restoration of base energy, then repair of room structures and will fall back to upgrading the controller.
#### Miner
Standard container miner. targets a container in the room and attempts to mine the targetResource (defaults to energy) from a source or mineral within range of the container.
#### Transport
Resource manager which will prioritize collection and delivery of its targetResource. These are used to move resources from mining containers to Storages or Terminals. It will participate in refilling base energy when its targetResource is energy (default)
