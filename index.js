/*
eslint
no-multi-spaces: ["error", {exceptions: {"VariableDeclarator": true}}]
padded-blocks: ["error", {"classes": "always"}]
max-len: ["error", 80]
*/
'use strict'

const getPropValue  = require('get-property-value')
const objectSize    = require('object.size')

module.exports = logger

function logger (bunyan, requestId) {

  return runLogger

  function runLogger (req) {
    let appendRes   = {}
    let endTime     = 0
    const startTime = process.hrtime()

    req.id = requestId || getPropValue(req.header, 'X-Request-ID') || id()

    bunyan.constructor.stdSerializers.res = serializer

    const log = bunyan.child(
      {
        origin: 'superagent',
        id: req.id,
        serializers: bunyan.constructor.stdSerializers
      }
    )

    log.info({req: req, payload: req.body, qs: req.qs}, 'start of the request')

    req.once('end', onEnd)
    req.once('error', onError)
    req.once('response', onResponse)

    return req

    function onEnd () {
      endTime = process.hrtime(startTime)
    }

    function onError (err) {
      // if isn't a http error the onend will not be called
      endTime = endTime || process.hrtime(startTime)

      log.error(
        {
          res: appendRes,
          err: err,
          duration: endTime[0] * 1e3 + endTime[1] * 1e-6
        },
        'end of the request'
      )
    }

    // in case of res.error should fallback to the error emitter
    // and should pass the res object
    function onResponse (res) {
      if (res.error) {
        appendRes = res
      } else {
        log.info(
          {
            res: res,
            duration: endTime[0] * 1e3 + endTime[1] * 1e-6
          },
          'end of the request'
        )
      }
    }
  }
}

function id () {
  return new Date().getTime().toString(36) +
    '-' +
    (Math.random() * Math.pow(36, 8) << 0).toString(36)
}

function serializer (res) {
  return {
    statusCode: res.statusCode,
    header: res._header,
    body: objectSize(res.body) ? res.body : res.text
  }
}
