

const log = require('dumb-lumberjack')()
const TAG = " RIP-TXIDS "


require('dotenv').config();

const local_coin_client = require('bitcoin-promise');
const config = require('./configs/env')
const btc = new local_coin_client.Client(config.BTC_DAEMON)
const {transactions, blocks, addresses} = require("./modules/mongo.js")

const read_blocks = async function(start,end){
    let tag = TAG + " | read_blocks | "
    try{

        log.info("start: ",start)
        log.info("end: ",end)


        //write to file
        for(let i = start; i < end;i++){
            log.info("reading block: ",i)

            //get block at height
            let blockHash = await btc.getBlockHash(i)
            //log.info(tag,"blockHash: ",blockHash)

            let blockInfo = await btc.getBlock(blockHash)
            //log.info(tag,"blockInfo: ",blockInfo)

            //get raw tx info
            let txs = blockInfo.tx
            let actions = []
            //store in mongo
            for(let i = 0; i < txs.length; i++){
                let txid = txs[i]
                log.info("txid:",txid)
                let txHex = await btc.getRawTransaction(txid)
                //log.info("txHex:",txHex)

                let decoded = await btc.decodeRawTransaction(txHex)
                //log.info("decoded:",decoded)

                actions.push({insertOne:decoded})
            }

            // let actions = []
            // for(let i = 0; i < txs.length; i++){
            //     let txid = txs[i]
            //     actions.push({insertOne:{txid,height}})
            // }
            //
            let saved = await transactions.bulkWrite(actions)
            log.debug(tag,"saved: ",saved)

        }

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

read_blocks(8581,500000)