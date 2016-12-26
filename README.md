# superagent-bunyan

a plugin for superagent that uses bunyan to log the request and responses

----
<a href="https://nodei.co/npm/superagent-bunyan/"><img src="https://nodei.co/npm/superagent-bunyan.png?downloads=true"></a>

[![Build Status](https://img.shields.io/badge/build-passing-brightgreen.svg?style=flat-square)](https://travis-ci.org/joaquimserafim/superagent-bunyan)![Code Coverage 100%](https://img.shields.io/badge/code%20coverage-100%25-green.svg?style=flat-square)[![ISC License](https://img.shields.io/badge/license-ISC-blue.svg?style=flat-square)](https://github.com/joaquimserafim/superagent-bunyan/blob/master/LICENSE)[![NodeJS](https://img.shields.io/badge/node-6.1.x-brightgreen.svg?style=flat-square)](https://github.com/joaquimserafim/superagent-bunyan/blob/master/package.json#L42)

[![JavaScript Style Guide](https://cdn.rawgit.com/feross/standard/master/badge.svg)](https://github.com/feross/standard)


### api
`const superagentLogger = require('superagent-bunyan')`

```js
superagentLogger(
    bunyans createLogger object or child object[,
    if sends the req id on headers = false][,
    uuid = uses a simple id generator][,
    header name to use = 'X-Request-ID']
)
```

for more options to configure `bunyan.createLogger` or `log.child` check on [bunyan doc](https://github.com/trentm/node-bunyan#introduction)

**Notes:**
* should use a middleware like `express-mw-correlation-id` to generate the `req.id` with your api/ervice and pass onto the `superagent-bunyan` function
* will use `log.info` with http errors (status codes 4xx and 5xx)
* will use `log.error` with socket errors

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

// should print 2 logs entries
// 1 - "msg":"start of the request"
// 2 - "msg":"end of the request", this will print the statusCode and the body
//

{
  "name": "test", // LOG NAME
  "hostname": "local",
  "pid": 54073,
  "origin": "superagent", // LOG ORIGIN
  "id": "ix6btz2q--wyq997", // REQUEST ID
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
  "id": "ix6btz2q--wyq997", // REQUEST ID
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
```

#### ISC License (ISC)
