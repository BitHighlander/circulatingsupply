

/*
 Since there are different user types, config requires an order of precedence
 1st: setupConfig,
 2nd: environment,
 3rd: hard-coded URLs
*/



let config = {
  //api settings
  PORT     : process.env['PORT']     || 18300,
  NODE_ENV : process.env['NODE_ENV'] || 'dev',
  SECRET   : process.env['SECRET:']  || '1234',
  
  // db settings
  MONGO_IP: process.env['MONGO_IP'] || '127.0.0.1',
  REDIS_IP: process.env['REDIS_IP'] || '127.0.0.1',
  REDIS_PORT: process.env['REDIS_PORT'] || 6379,
  
  MONGO: {
    HOSTS: [{
      ip: process.env['MONGO_IP'] || '127.0.0.1',
      port: process.env['MONGO_PORT'] || 27017
      // }, {
      //     ip: '127.0.0.1',
      //     port: 27017
    }],
    DB: process.env['MONGO_DB_NAME'] || 'bitcoin',
    OPTIONS: {
      // abc: 123,
      // replicaSet: 'rs01'
    }
  },
  
  
  //coins
  COINS:["BTC","LTC","ETH"],
  
  BTC_DAEMON: {
    host: process.env['BTC_DAEMON_HOST'],
    port: process.env['BTC_DAEMON_PORT'],
    user: process.env['BTC_DAEMON_USER'],
    pass: process.env['BTC_DAEMON_PASS']
  },
  
  LTC_DAEMON: {
    host: process.env['LTC_DAEMON_HOST'],
    port: process.env['LTC_DAEMON_PORT'],
    user: process.env['LTC_DAEMON_USER'],
    pass: process.env['LTC_DAEMON_PASS']
  },
  


}

module.exports = config
