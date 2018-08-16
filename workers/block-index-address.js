
/*
    True balance sheet
    
    mongo collection indexed on nounce
    
    A global balance object
    
    every event triggers a nonce
    
    events are credits/debit
    
    events are scored by time
    
    
    task
    get balance at any time
    
    nearest nonce to time
    
    
    {
    address:
    (txCount)nonce:
    total In:
    total Out:
    balance:
    balance (unconfirmed):
    txids:[
        txid1,
        txid2
    ]
    
    history: [
        {
        credit:true
        amount:1
        nonce:0
        time:1231232131231
        total In:1
        total Out:0
        balance:1
        txid
        },
        {
        debit:true
        amount:1
        nonce:1
        time:1231232131231
        total In:1
        total Out:1
        balance:0
        txid
        },
        ...
       
    ]
    }

    
    audit history stratigy
    
    index all txids by address
    
    get all txids by address
    
    if txid NOT found in history
    
    history is bogous
    
    toss and REBUILD!
    
    
    
    find balance at any given time per address
    
    https://stackoverflow.com/questions/23553922/mongodb-find-inside-sub-array
    
    db.infos.aggregate([
        // Still match the document
        { "$match": {
            "info": {
                "$elemMatch": { "0": {"$gte": 1399583285000} }
            }
        }},

        // unwind the array for the matched documents
        { "$unwind": "$info" },

        // Match only the elements
        { "$match": { "info.0": { "$gte": 1399583285000 } } },

        // Group back to the original form if you want
        { "$group": {
            "_id": "$_id",
            "info": { "$push": "$info" }
        }}

    ])
    
    find first element greater in time
    
    get nounce
    
    nounce - 1 get element
    
    this is balance at time
    
 */


require('dotenv').config({path:"../.env"});
const TAG = ' | index_worker | '
const log = require('dumb-lumberjack')()

const config = require('../configs/env')
const local_coin_client = require('bitcoin-promise');
const btc = new local_coin_client.Client(config.BTC_DAEMON)

const Redis = require('then-redis')

const redis = Redis.createClient('tcp://' + config.REDIS_IP + ':' + config.REDIS_PORT);

//database
const {transactions,blocks, addresses} = require("../modules/mongo.js")




const pause = function(seconds) {
    return new Promise((resolve, reject) => {
        setTimeout(resolve, seconds*1000)
    })
}


const parse_tx_info = async function(txInfo,height,block){
    let tag = TAG + " | parse_block | "
    try{
        let actions = []
        /*
            Valid actions:
                insertOne
                updateOne
                updateMany
                deleteOne
                deleteMany
                replaceOne
         */
        
        //actions.push({insertOne:{txid,height}})
        
        let inputs = txInfo.vin
        let outputs = txInfo.vout
        for(let j = 0; j < inputs.length; j++){
            let input = inputs[j]
            
            log.debug(tag,"input: ",input)
            if(input.txid){
                let txRaw = await btc.getRawTransaction(input.txid)
                log.debug(tag,"txRaw: ",txRaw)
                
                let txInfo = await btc.decodeRawTransaction(txRaw)
                
                let vouts = txInfo.vout
                for(let j = 0; j < vouts.length; j++){
                    let output = outputs[j]
                    
                    //get output value TO address
                    let addys = []
                    if(output && output.scriptPubKey && output.scriptPubKey.addresses)addys = output.scriptPubKey.addresses
                    //addys
                    for(let k = 0;k < addys.length;k++){
                        let address = addys[k]
                        
                        try{
                            //use redis to speed this up (dont error on duplicates)
                            let isUnknown = redis.sadd("UTXO:ADDRESSES",address)
                            if(isUnknown){
                                await addresses.insert({address,firstBlock:height,firstTx:txInfo.txid,txs:[]})
                            }
                            
                        }catch(e){
                        }
                        
                        try{
                            //debits
                            let txInfoByaddress = {
                                address,
                                height,
                                block,
                                txid:txInfo.txid,
                                value:output.value * -1,
                                debit:true,
                                amount:output.value
                            }
                            addresses.update({ address },
                                {
                                    $push: {
                                        txs: txInfoByaddress
                                    }
                                })
    
                            actions.push({updateOne:{ address },{$push: {txs: txInfoByaddress}}})
                            
                        }catch(e){
                            log.error("Why this hitting????")
                        }
                        
                    }
                }
            }
            
        }
        
        for(let j = 0; j < outputs.length; j++){
            let output = outputs[j]
            
            log.debug(tag,"output: ",output)
            log.debug(tag,"output: ",output.scriptPubKey)
            //get input age
            let addys = []
            if(output && output.scriptPubKey && output.scriptPubKey.addresses)addys = output.scriptPubKey.addresses
            //addys
            for(let k = 0;k < addys.length;k++){
                let address = addys[k]
                
                try{
                    let isUnknown = redis.sadd("UTXO:ADDRESSES",address)
                    if(isUnknown){
                        await addresses.insert({address,firstBlock:height,firstTx:txInfo.txid,txs:[]})
                    }
                }catch(e){
                }
                
                let txInfoByaddress = {
                    address,
                    height,
                    block,
                    txid:txInfo.txid,
                    value:output.value,
                    credit:true,
                    amount:output.value
                }
                
                
            }
            
        }
        
        
        return actions
    }catch(e){
        log.error(tag,e)
        throw e
    }
}


//parse block
const parse_block = async function(block,height){
    let tag = TAG + " | parse_block | "
    try{
        let summary = {}
        log.debug(tag,"height: ",height)
        log.debug(tag,"block: ",block)
        //for each transaction
        
        let txs = block.tx
        log.debug(tag,"transactions: ",txs)
        log.debug(tag,"transactions: ",txs.length)
        
        let timeLast = new Date().getTime()
        
        // TODO optimize with BULK update mongo for entire block in one mongo call
        let actions = []
        for(let i = 0; i < txs.length; i++){
            let txid = txs[i]
            
            //
            
            //actions.push({insertOne:{txid,height}})
        }
        
        let saved = await transactions.bulkWrite(actions)
        log.debug(tag,"saved: ",saved)
        
    }catch(e){
        log.error(tag,e)
        throw e
    }
}




let do_work = async function () {
    let tag = TAG + ' | do_work | '
    try {
        // TODO nerf any user turned off!
        let blockHeight = await redis.blpop('blocks:index:blockheight',5)
        log.debug(tag,"blockHeight: ",blockHeight)
        try {
            if (blockHeight) {
                blockHeight = parseInt(blockHeight[1])
                log.debug(tag,"blockHeight: ",blockHeight)
                //get block at height
                let blockHash = await btc.getBlockHash(blockHeight)
                log.debug(tag,"blockHash: ",blockHash)
                
                log.debug(tag, 'blockHash: ', blockHash)
                let blockInfo = await btc.getBlock(blockHash,2)
                log.debug(tag,"blockInfo: ",blockInfo)
                
                let blockSummary = await parse_block(blockInfo,blockHeight)
                log.debug(tag,"blockSummary: ",blockSummary)
                
                let workLeft = await redis.llen('blocks:index:blockheight')
                log.debug('orders left in queue: ', workLeft)
            } else {
                log.debug('idle!')
            }
        } catch (ex) {
            log.error(tag,` Error: `, ex)
            await redis.publish("deadletter",JSON.stringify({blockHeight, tag, ex}))
            await redis.lpush("deadletter:blocks:index:blockheight",blockHeight)
        }
    } catch (e) {
        log.error(tag, 'Error conneting to redis: ', e)
    }
    
    do_work()
}

log.info(TAG," Doing work! ")
do_work()