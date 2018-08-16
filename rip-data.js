
/*
    Block Reader
*/

require('dotenv').config();
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
let start = 520016

//blocks in 10 days
//                                  m   h     d
let blockHeight10DaysAgo = start - (6 * 24 * 1)
log.debug(TAG,"blockHeight10DaysAgo: ",blockHeight10DaysAgo)

//blocks in 90 days
//                                  m   h     d
let blockHeight90DaysAgo = start - (6 * 24 * 90)
log.debug(TAG,"blockHeight90DaysAgo: ",blockHeight90DaysAgo)


// const get_tx_age = async function(txRaw){
//   let tag = TAG + " | get_tx_age | "
//   try{
//     let summary = {}
//
//     let txInfo = await btc.decodeRawTransaction(txRaw)
//     log.info(tag,"txInfo: ",txInfo)
//
//     let inputs = txInfo.vin
//     let outputs = txInfo.vout
//     for(let j = 0; j < inputs.length; j++){
//       let input = inputs[j]
//       log.info(tag,"input: ",input)
//
//       //get input age
//
//     }
//
//   }catch(e){
//     log.error(tag,e)
//     throw e
//   }
// }


const parse_tx = async function(txRaw,blockheight){
  let tag = TAG + " | parse_block | "
  try{
    let summary = {}
    summary.blocksDestroyed = 0
    summary.volume = 0
    log.debug(tag,"blockheight: ",blockheight)
    
    let txInfo = await btc.decodeRawTransaction(txRaw)
    log.debug(tag,"txInfo: ",txInfo)
  
    let inputs = txInfo.vin
    let outputs = txInfo.vout
    for(let j = 0; j < inputs.length; j++){
      let input = inputs[j]
      log.debug(tag,"input: ",input)
      
      if(!input.coinbase){
        let txid = input.txid
        log.debug(tag,"txid: ",txid)
        //get input age
        let inputInfo = await transactions.findOne({txid})
        log.debug(tag,"inputInfo: ",inputInfo)
        if(!inputInfo) {
          //
          //throw Error("101: txid index incomplete!!! "+txid)
        } else {
  
          //blocks destroyed
          let blocksDestroyed = blockheight - inputInfo.height
          log.debug(tag,"blocksDestroyed: ",blocksDestroyed)
          summary.blocksDestroyed = summary.blocksDestroyed + blocksDestroyed
        }

      }

    }
    
    //get volume of block
    for(let j = 0; j < outputs.length; j++) {
      let output = outputs[j]
      log.debug(tag, "output: ", output)
  
      if(output.value){
        summary.volume = summary.volume + output.value
      }
    }
    
    return summary
  }catch(e){
    log.error(tag,e)
    throw e
  }
}


//parse block
const parse_block = async function(block,blockheight){
  let tag = TAG + " | parse_block | "
  try{
    let summary = {}
    log.debug(tag,"block: ",block)
    //for each transaction
  
    summary.blocksDestroyed = 0
    summary.volume = 0
    
    let txs = block.tx
    log.debug(tag,"transactions: ",txs)
    log.debug(tag,"transactions: ",txs.length)
    
    for(let i = 0; i < txs.length; i++){
      let tx = txs[i]
      log.debug(tag,"tx: ",tx)
      //getTxInfo
      let txRaw = await btc.getRawTransaction(tx)
      log.debug(tag,"txRaw: ",txRaw)
      let txSummary = await parse_tx(txRaw,blockheight)
      log.debug(tag,"txSummary: ",txSummary)
  
      summary.blocksDestroyed = summary.blocksDestroyed + txSummary.blocksDestroyed
      summary.volume = summary.volume + txSummary.volume
    }
    
    return summary
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
  
    let daysDestroyed = 0
    let txVolume = 0
    
    //write to file
    for(let i = start; i > end;i--){
      log.info("reading block: ",i)
      
      //get block at height
      let blockHash = await btc.getBlockHash(i)
      log.debug(tag,"blockHash: ",blockHash)
      
      //get block
      //                                       verbosity set at 2 gives FULL block info
      // let blockInfo = await btc.getBlock(blockHash,2)
      let blockInfo = await btc.getBlock(blockHash)
      log.debug(tag,"blockInfo: ",blockInfo)
      
      let blockSummary = {}
      blockSummary.height = i
      blockSummary.hash = blockHash
      blockSummary.time = blockInfo.time
      blockSummary.txCount = blockInfo.tx.length
      let blockInfoSummary = await parse_block(blockInfo,i)
      blockSummary.blocksDestroyed = blockInfoSummary.blocksDestroyed
      blockSummary.volume = blockInfoSummary.volume
      
      log.info(blockSummary)
      logStream.write(JSON.stringify(blockSummary) + ",\n");
      
      // index into mongo
      blockInfo.txCount = blockInfo.tx.length
      blockInfo.blocksDestroyed = blockInfoSummary.blocksDestroyed
      blockInfo.volume = blockInfoSummary.volume
      await blocks.insert(blockInfo)
      
      daysDestroyed = daysDestroyed + blockSummary.daysDestroyed
      txVolume = txVolume + blockSummary.volume
      
      //pause
      //await pause(0.1)
    }
    
    log.info(tag,"daysDestroyed: ",daysDestroyed)
    log.info(tag,"txVolume: ",txVolume)
    
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

read_blocks(start,start-4320,"./data/bitcoin-blocks-destroyed.csv")