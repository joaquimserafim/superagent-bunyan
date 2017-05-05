# superagent-bunyan

a plugin for superagent that uses bunyan to log the request and responses

----
<a href="https://nodei.co/npm/superagent-bunyan/"><img src="https://nodei.co/npm/superagent-bunyan.png?downloads=true"></a>

[![Build Status](https://img.shields.io/badge/build-passing-brightgreen.svg?style=flat-square)](https://travis-ci.org/joaquimserafim/superagent-bunyan)![Code Coverage 100%](https://img.shields.io/badge/code%20coverage-100%25-green.svg?style=flat-square)[![ISC License](https://img.shields.io/badge/license-ISC-blue.svg?style=flat-square)](https://github.com/joaquimserafim/superagent-bunyan/blob/master/LICENSE)[![NodeJS](https://img.shields.io/badge/node-6.1.x-brightgreen.svg?style=flat-square)](https://github.com/joaquimserafim/superagent-bunyan/blob/master/package.json#L42)

[![JavaScript Style Guide](https://cdn.rawgit.com/feross/standard/master/badge.svg)](https://github.com/feross/standard)


### api
`const superagentLogger = require('superagent-bunyan')`

```js
superagentLogger(bunyan_logger[, requestId, extra])
```

* **bunyan logger** should be a bunyan createLogger or child object
* **requestId** uuid, by default will try to pick up from the headers injected in superagent, or can be set by using a module/function to generate the requestId, by default will use an internal id generator
* **extra** an object that you can use to add extra info int the log entry

**some notes:**
* should use the plugin after the definiton of the http method to use
* to capture the `X-Request-ID` should use this plugin after setting the `X-Request-ID` header
* for more options to configure `bunyan.createLogger` or `log.child` check with [bunyan doc](https://github.com/trentm/node-bunyan#introduction)
* will use `log.error` with http errors (status codes 4xx and 5xx) and socket errors but for the http errors `res` will have the statusCode

### example
```js
const request = require('superagent')
const bunyan  = require('bunyan')

const superagentLogger = require('superagent-bunyan')

const logger = bunyan.createLogger({name: 'my_log'})

logger.info('Hey!')

request
  .get('http://localhost:3000')
  .use(superagentLogger(logger)))
  .end((err, res) => {})

//
// should print 2 log entries
// 1 - "msg":"start of the request"
// 2 - "msg":"end of the request", this will print the statusCode and the body
//

{
  "name": "test", // LOG NAME
  "hostname": "local",
  "pid": 54073,
  "origin": "superagent", // LOG ORIGIN
  "req_id": "ix6btz2q--wyq997", // REQUEST ID
  "level": 30,
  "req": { // REQUEST
    "method": "GET",
    "url": "http://localhost:3000",
    "headers": {
      "user-agent": "node-superagent/3.3.1"
    }
  },
  "msg": "start of the request",
  "time": "2016-12-26T16:57:22.132Z",
  "v": 0
}

{
  "name": "test", // LOG NAME
  "hostname": "local",
  "pid": 54073,
  "origin": "superagent",// LOG ORIGIN
  "req_id": "ix6btz2q--wyq997", // REQUEST ID
  "level": 30,
  "res": {  // RESPONSE STATUS AND PAYLOAD
    "statusCode": 200,
    "body": "Hello World!"
  },
  "duration": 27.22063, // REQUETS DURATION
  "msg": "end of the request",
  "time": "2016-12-26T16:57:22.159Z",
  "v": 0
}

//
// setting the X-Request-ID with superagent
// and superagent-bunyan will use to set the req.id
//

request
  .get('http://localhost:3000')
  .set('X-Request-ID', uuid)
  .use(superagentLogger(logger)))
  .end((err, res) => {})
```

#### ISC License (ISC)
