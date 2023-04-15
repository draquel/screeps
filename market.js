//const util = require("./util");

module.exports =  {

    getOrders(type = ORDER_BUY,resource = RESOURCE_ENERGY, amount = 1){
        let orders = Game.market.getAllOrders(o => o.type === type && o.resourceType === resource && o.amount >= amount).sort(o => o.price)
        return type === ORDER_BUY ? orders.reverse() : orders
    },

    listTopOrders(type= ORDER_BUY,resource= RESOURCE_ENERGY){
        let orders = this.getOrders(type,resource);
        console.log("Type: "+type+", Resource: "+resource+", Order Count: "+orders.length)
        while(orders.length > 10){ orders.pop() }
        orders.forEach((o) => {
            console.log(o.id + ' - ' + o.roomName + " - "+ o.amount +" x $"+ o.price + " [$" + Math.round(o.price * o.amount) + "]")
        })
    },

    createSellOrder(resource = RESOURCE_ENERGY,price= 1,amount = 1,room){
        let result = Game.market.createOrder({type:ORDER_SELL, resourceType:resource, price:price, totalAmount:amount,roomName:room.name})

        if(result === ERR_NOT_ENOUGH_RESOURCES){
            console.log('Create Sell Order: Error - Not enough resources in terminal')
        }
        if(result === ERR_FULL){
            console.log('Create Sell Order: Error - Full')
        }
        if(result === ERR_NOT_OWNER){
            console.log('Create Sell Order: Error - Not room Owner')
        }
        if(result === ERR_INVALID_ARGS){
            console.log('Create Sell Order: Error - Invalid Args')
        }
    }

}
