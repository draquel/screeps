//const util = require("./util");

function compareOrderPrice(a,b){
    return a.price - b.price
}

module.exports =  {

    logOrderDetails(o){
        console.log(o.id + ' - ' + o.roomName + " - "+ o.amount +" x $"+ o.price + " [$" + Math.round(o.price * o.amount) + "]")
    },

    getOrders(type = ORDER_BUY,resource = RESOURCE_ENERGY, amount = 1){
        let orders = Game.market.getAllOrders(o => o.type === type && o.resourceType === resource && o.amount >= amount).sort(compareOrderPrice)
        return type === ORDER_BUY ? orders.reverse() : orders
    },

    getTopOrders(type= ORDER_BUY,resource= RESOURCE_ENERGY,limit = 10){
        let orders = this.getOrders(type,resource);

        console.log("Type: "+type+", Resource: "+resource+", Order Count: "+orders.length)
        orders = orders.slice(0,limit)
        orders.forEach((o) => { this.logOrderDetails(o) })

        return orders
    },

    getOrdersForAmount(type = ORDER_BUY, resource = RESOURCE_ENERGY, amount = 1000){
        let orders = this.getOrders(type,resource)
        let filled = 0
        let ordersFilled = []

        for(let i = 0; i < orders.length; i++){
            if(filled >= amount){
                break
            }
            filled += orders[i].amount
            ordersFilled.push(orders[i])
        }

        console.log("Type: "+type+", Resource: "+resource+", Amount: "+amount+", Order Count: "+ordersFilled.length)
        ordersFilled.forEach((o) => { this.logOrderDetails(o) })

        return ordersFilled
    },

    getBuyOrdersFor(resource = RESOURCE_ENERGY, amount = 1000){
        return this.getOrdersForAmount(ORDER_BUY,resource,amount)
    },

    getSellOrdersFor(resource = RESOURCE_ENERGY, amount = 1000){
        return this.getOrdersForAmount(ORDER_SELL,resource,amount)
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
