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
      actions.push({insertOne:{txid,height}})
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
        let blockInfo = await btc.getBlock(blockHash)
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