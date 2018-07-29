
const monk = require('monk')
const config = require('../configs/env.js')
const log = require('dumb-lumberjack')()

const hosts =  config.MONGO.HOSTS
const db = config.MONGO.DB
const options = config.MONGO.OPTIONS
function _buildConnectionString (hosts, db) {
  if (!hosts && hosts.length > 0) {
    throw new Error('No mongo hosts configured! See config/example_dbConfig.js')
  }
  
  let str = hosts.map(host => host.ip + ':' + host.port).join(',')
  str += '/' + (db || '')
  
  return str
}

const connectionString = _buildConnectionString(hosts, db)

const connection = monk(connectionString, options, err => {
  if (err) {
    console.error(`Error connecting to mongo!`, err)
    throw new Error(err)
  } else {
    console.log(`Successfully connected to mongo`)
}
})

// collections
let transactions = connection.get('transactions-height-index')
let blocks = connection.get('blocks')
let addresses = connection.get('addresses')

//indexes
transactions.createIndex({ txid: 1 }, { unique : true })
addresses.createIndex({ address: 1 }, { unique : true })
//blocks.ensureIndex({ txid: 1 }, { unique : true })


module.exports = exports = { transactions, blocks, addresses }
