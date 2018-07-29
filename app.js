
/*
    Circulating supply (part 1)
        Days Destroyed modeled in Bitcoin
                          -Highlander
    
    Goals:
      Repeatable method to find days destroyed measured in blockTime
    
    Strategy:
      Rip-Sample data from daemon
      parse and write to file
      read from file and calculate
    
    --------------
    Overview
    --------------
   
    
    pseudo code:
    
    Get all blocks
    
    for each block
    
    for each tx
    
    find transfer value
      * if > 1 output, remove smallest (change)
    
    [valueTx] = for each uxto
        getTransaction on input
        get age of input
        input size = age (days) * value
    
        
    
     
    
       
 */
const TAG = " | app | "
const fs = require('fs-promise');
require('dotenv').config();
const config = require('./configs/env')
const log = require('dumb-lumberjack')()

/*
    Get volume over blocks
    get days destroyed over blocks

 */

//get blocks
const read_blocks = async function(filename){
  let tag = TAG + " | read_blocks | "
  try{
    let blocks = await fs.readFile("./data/bitcoin.json")
    //blocks = blocks.toString()
    log.debug("blocks: ",blocks.length)
    blocks = JSON.parse(blocks)
    return blocks
  }catch(e){
    log.error(tag,e)
    throw e
  }
}


//parse block
const parse_block = async function(block){
  let tag = TAG + " | parse_block | "
  try{
    log.debug(tag,"block: ",block)
    //for each transaction
    
    let txs = block.tx
    log.debug(tag,"transactions: ",txs)
    log.debug(tag,"transactions: ",txs.length)
    
    for(let i = 0; i < txs.length; i++){
      let tx = txs[i]
      log.debug(tag,"tx: ",tx)
      log.info(tag,"vin: ",tx.vin)
      log.debug(tag,"vout: ",tx.vout)
      //
      
      
    }
    
  }catch(e){
    log.error(tag,e)
    throw e
  }
}

//iterate
let run = async function(){
  let tag = TAG + " | run | "
  try{
      let daysDestroyed = 0
      let txVolume = 0
    
      let blocks = await read_blocks()
      log.debug(tag,"blocks: ",blocks)
      //
      for(let i = 0; i < blocks.length;i++){
          let block = blocks[i]
          log.debug(tag,"block: ",block)
          let summary = parse_block(block)
          daysDestroyed = daysDestroyed + summary.daysDestroyed
          txVolume = txVolume + summary.txVolume
      }
      log.info(tag,"daysDestroyed: ",daysDestroyed)
      log.info(tag,"txVolume: ",txVolume)
  }catch(e){
    throw e
  }
}
run()