require('dotenv').config({path:"../.env"});

const local_coin_client = require('bitcoin-promise');
const config = require('../configs/env')
const btc = new local_coin_client.Client(config.BTC_DAEMON)

const {transactions, blocks, addresses} = require("../modules/mongo.js")

// btc.getWalletInfo()
//     .then(function(resp){
//         console.log(resp)
//     })

transactions.find()
    .then(function(resp){
        console.log(resp)
    })
