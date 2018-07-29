

require('dotenv').config({path:"../.env"});
const TAG = ' | index_worker | '
const log = require('dumb-lumberjack')()

const config = require('../configs/env')
const local_coin_client = require('bitcoin-promise');
const btc = new local_coin_client.Client(config.BTC_DAEMON)

const Redis = require('then-redis')

const redis = Redis.createClient('tcp://' + config.REDIS_IP + ':' + config.REDIS_PORT);

let timeStart = new Date().getTime()

let depthLast
let look_at_queue = async function(){
  let depth = await redis.llen("blocks:index:blockheight")
  console.log("depth: ",depth)
  if(!depthLast) {
    depthLast = depth
    log.info("estimating time remaining! ...")
  } else {
    let processed = depthLast - depth
    log.info("processed: ",processed)
  
    //work per second
    let workPerSecond = processed/15
  
    //work left
    let secondsLeft = depth / workPerSecond
    let minutesLeft = secondsLeft / 60
    if(minutesLeft < 60){
      log.info("time left (minutes): ",minutesLeft)
    } else {
      let hoursLeft = minutesLeft / 60
      log.info("time left (hours): ",hoursLeft)
    }

    //Todo eta
    depthLast = depth
  }

}

look_at_queue()
setInterval(look_at_queue,15000)