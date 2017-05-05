/*
eslint
no-multi-spaces: ["error", {exceptions: {"VariableDeclarator": true}}]
padded-blocks: ["error", {"classes": "always"}]
max-len: ["error", 80]
*/
'use strict'

const getPropValue  = require('get-property-value')
const objectSize    = require('object.size')
const url           = require('url')
const isObject      = require('is.object')

module.exports = logger

function logger (bunyan, requestId, extra) {

  if (isObject(requestId)) {
    extra = requestId
    requestId = null
  }

  return runLogger

  function runLogger (req) {
    let appendRes   = {}
    let endTime     = 0
    const startTime = process.hrtime()

    req.id = requestId || getPropValue(req.header, 'X-Request-ID') || id()

    const log = bunyan
      .child(Object
          .assign({
            origin: 'superagent',
            req_id: req.id,
            serializers: {
              err: bunyan.constructor.stdSerializers.err,
              req: reqSerializer,
              res: resSerializer
            }
          },
          isObject(extra) ? extra : {}
        )
      )

    log.info({req: req}, 'start of the request')

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

function resSerializer (res) {

  return {
    statusCode: res.statusCode,
    headers: res.headers,
    body: objectSize(res.body) ? res.body : res.text
  }
}

function reqSerializer (req) {

  return {
    method: req.method,
    url: req.url,
    qs: objectSize(req.qs) ? req.qs : undefined,
    path: req.url && url.parse(req.url).pathname,
    body: req._data,
    headers: req.header
  }
}
