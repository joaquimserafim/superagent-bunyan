/*
eslint
no-multi-spaces: ["error", {exceptions: {"VariableDeclarator": true}}]
padded-blocks: ["error", {"classes": "always"}]
max-len: ["error", 80]
*/
'use strict'

module.exports = logger

function logger (log, sendId = false, reqId = id(), header = 'X-Request-ID') {
  let endTime = 0

  log.constructor.stdSerializers.res = resSerializer

  return setLogger

  function setLogger (req) {
    const startTime = process.hrtime()

    req.id = reqId
    sendId && req.set(header, req.id)

    req.log = log.child(
      {
        origin: 'superagent',
        id: req.id,
        serializers: log.constructor.stdSerializers
      }
    )

    req.log.info({req: req, payload: req.body}, 'start of the request')

    req.once('end', onEnd)
    req.once('error', onError)
    req.once('response', onResponse)

    return req

    function onEnd () {
      endTime = process.hrtime(startTime)
    }

    function onError (err) {
      req.log.error(err, 'end of the request')
    }

    function onResponse (res) {
      req.log.info(
        {
          res: res,
          duration: endTime[0] * 1e3 + endTime[1] * 1e-6
        },
        'end of the request'
      )
    }
  }
}

function id () {
  return new Date().getTime().toString(36) +
    '-' +
    (Math.random() * Math.pow(36, 8) << 0).toString(36)
}

function resSerializer (res = {}) {
  return {
    statusCode: res.statusCode,
    header: res._header,
    body: Object.keys(res.body).length ? res.body : res.text
  }
}
