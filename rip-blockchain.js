
/*
    Block Reader
*/

require('dotenv').config();
const Redis = require('then-redis')
const redis = Redis.createClient('tcp://localhost:6379');
const config = require('./configs/env')
const log = require('dumb-lumberjack')()
const local_coin_client = require('bitcoin-promise');
const btc = new local_coin_client.Client(config.BTC_DAEMON)

//database
const {transactions,blocks, addresses} = require("./modules/mongo.js")

//log stream
const fs = require('fs');

const TAG = " | rip-data | "
//get blocks

/*
    Hack time estimation
      1 block = 10minutes
 */
//today ( 7-24-18 )
let start = 530015

//blocks in 10 days
//                                  m   h     d
let blockHeight10DaysAgo = start - (6 * 24 * 1)
log.debug(TAG,"blockHeight10DaysAgo: ",blockHeight10DaysAgo)

//blocks in 90 days
//                                  m   h     d
let blockHeight90DaysAgo = start - (6 * 24 * 90)
log.debug(TAG,"blockHeight90DaysAgo: ",blockHeight90DaysAgo)


const parse_tx_info = async function(txInfo,height,block){
  let tag = TAG + " | parse_block | "
  try{
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
        try{
          addresses.update({ address },
            {
              $push: {
                txs: txInfoByaddress
              }
            })
        }catch(e){
          log.error("Why this hitting????3")
        }

      }
      
    }
    
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
    for(let i = 0; i < txs.length; i++){
      
      let tx = txs[i]
      log.debug(tag,"tx: ",tx)
  
      if(i%100 === 0){
        let timeNow = new Date().getTime()
        let txsPerSecond =(timeNow / timeLast )/1000 * 60 * 100
        log.info(tag,"txsPerSecond: " ,txsPerSecond)
        timeLast = timeNow
      }blockInfo
      
      //getTxInfo
      let txRaw = await btc.getRawTransaction(tx)
      log.debug(tag,"txRaw: ",txRaw)
      
      let txInfo = await btc.decodeRawTransaction(txRaw)
      txInfo.raw = txRaw
      txInfo.height = height
      //TODO add more stuffs to index?
      //total in
      //total out
      //fees
      //fees per btye
      //fees per weight unit (segwit)
      //estimate transacted (-change amount)
      log.debug(tag,"txInfo: ",txInfo)
      let summary = await parse_tx_info(txInfo,height,block.hash)
      
      try{
        await transactions.insert(txInfo)
      }catch(e){
        //mute doups errors
      }
      //await pause(0.1)
      
    }
    
  }catch(e){
    log.error(tag,e)
    throw e
  }
}



const read_blocks = async function(start,end, filename){
  let tag = TAG + " | read_blocks | "
  try{
    //TODO flags?? wtf
    const logStream = fs.createWriteStream(filename, {'flags': 'a'});
    
    let allData = []
    log.info("start: ",start)
    log.info("end: ",end)
    let timeStart = new Date().getTime()
    log.info("time start: ",new Date().getTime())
    let daysDestroyed = 0
    let txVolume = 0
    
    //write to file
    for(let i = start; i > end;i--){
      log.info("reading block: ",i)
      let blockHeight = i
      //get block at height
      let blockHash = await btc.getBlockHash(i)
      log.info(tag,"blockHash: ",blockHash)
      
      //get block
      //                                       verbosity set at 2 gives FULL block info
      // let blockInfo = await btc.getBlock(blockHash,2)
      let blockInfo = await btc.getBlock(blockHash)
      log.debug(tag,"blockInfo: ",blockInfo)
      
      let blockSummary = await parse_block(blockInfo,blockHeight)
      log.debug(tag,"blockSummary: ",blockSummary)
      //logStream.write(blockSummary);
      
      
      //pause
      await pause(0.1)
      let timePerBlock = (timeStart - new Date().getTime())/1000
      log.info(tag,"timePerBlock: ",timePerBlock," (seconds)")
      let estimateTimeLeft = (start - i) * timePerBlock
      log.info(tag,"estimateTimeLeft: ",timePerBlock," (seconds)")
    }
    
    
    logStream.write(JSON.stringify(allData));
    
    
    log.debug(tag,"daysDestroyed: ",daysDestroyed)
    log.debug(tag,"txVolume: ",txVolume)
    
    //write to file
    logStream.end();
  }catch(e){
    log.error(tag,e)
    throw e
  }
}

const pause = function(seconds) {
  return new Promise((resolve, reject) => {
    setTimeout(resolve, seconds*1000)
  })
}
//overnight checkpoint
//529780
//TODO multi-thread
read_blocks(529780,1,"./data/bitcoin.json")