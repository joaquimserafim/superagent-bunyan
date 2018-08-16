/*
eslint
no-multi-spaces: ["error", {exceptions: {"VariableDeclarator": true}}]
padded-blocks: ["error", {"classes": "always"}]
max-len: ["error", 80]
*/
'use strict'

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

    req.id = requestId || getXRequestIdValueFromReq(req) || id()

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
      if (!endTime) {
        endTime = getTimeMs(process.hrtime(startTime))
        err = Object.assign(err, {opDuration: endTime})
      }

      log.error(
        {
          res: appendRes,
          err: err,
          duration: endTime
        },
        'end of the request'
      )
    }

    // in case of res.error should fallback to the error emitter
    // and should pass the res object
    function onResponse (res) {
      endTime = getTimeMs(endTime)

      res = Object.assign(res, {opDuration: endTime})

      if (res.error) {
        appendRes = res
      } else {
        log.info(
          {
            res: res,
            duration: endTime
          },
          'end of the request'
        )
      }
    }
  }
}

//
// help functions
//

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
    qs: getQs(req),
    path: req.url && url.parse(req.url).pathname,
    body: req._data,
    headers: req.header
  }
}

function getTimeMs (endTime) {
  return endTime[0] * 1e3 + endTime[1] * 1e-6
}

function getQs (req) {
  return objectSize(req.qs)
    ? req.qs
    : getRawQs(req)
}

function getRawQs (req) {
  return req.qsRaw && req.qsRaw.length
    ? req.qsRaw.join('&')
    : undefined
}

function getXRequestIdValueFromReq (req) {
  if (!isObject(req) || !isObject(req.header)) {
    return undefined
  }

  let headerName

  for (const h in req.header) {
    if (h.toLowerCase() === 'x-request-id') {
      headerName = h
      break
    }
  }

  if (!headerName) {
    return undefined
  }

  return req.header[headerName]
}
