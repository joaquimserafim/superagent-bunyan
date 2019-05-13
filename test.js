/*
eslint
no-multi-spaces: ["error", {exceptions: {"VariableDeclarator": true}}]
padded-blocks: ["error", {"classes": "always"}]
max-len: ["error", 80]
*/
'use strict'

const express = require('express')
const request = require('superagent')
const bunyan  = require('bunyan')
const mocha   = require('mocha')
const expect  = require('chai').expect
const spy     = require('fn-spy')
const EE      = require('events')

const it        = mocha.it
const describe  = mocha.describe
const before    = mocha.before
const after     = mocha.after

const superagentLogger = require('.')

const app = express()

// keep in memory
const ringbuffer = new bunyan.RingBuffer({ limit: 100 })

const logger = bunyan.createLogger(
  {
    name: 'superagent-bunyan',
    streams: [
      {
        level: 'trace',
        type: 'raw',
        stream: ringbuffer
      }
    ]
  }
)

var server

describe('superagent-bunyan', () => {

  describe('unit', () => {

    it('when follows the normal path', (done) => {
      const resBody = { statusCode: 200, header: {}, body: 'hello' }

      let requestEmitter = new EE()

      superagentLogger(logger)(requestEmitter)

      let spyEnd = spy.emitter()
      let spyResponse = spy.emitter()
      let spyError = spy.emitter()

      requestEmitter.on('end', spyEnd)
      requestEmitter.on('response', spyResponse)
      requestEmitter.on('error', spyError)

      requestEmitter.emit('end')
      requestEmitter.emit('response', resBody)

      expect(spyEnd.calledCount()).to.be.deep.equal(1)
      expect(spyResponse.calledCount()).to.be.deep.equal(1)
      expect(spyError.calledCount()).to.be.deep.equal(0)

      expect(spyEnd.calledWith()).to.be.deep.equal([[]])
      expect(spyResponse.calledWith()).to.be.deep.equal([[resBody]])
      expect(spyError.calledWith()).to.be.deep.equal([])

      done()
    })

    it('when a http error happens', (done) => {
      const error = 'We\'re not computers, Sebastian, we\'re physical'

      let requestEmitter = new EE()

      superagentLogger(logger)(requestEmitter)

      let spyEnd = spy.emitter()
      let spyResponse = spy.emitter()
      let spyError = spy.emitter()

      requestEmitter.on('end', spyEnd)
      requestEmitter.on('response', spyResponse)
      requestEmitter.on('error', spyError)

      requestEmitter.emit('end')
      requestEmitter.emit('error', error)

      expect(spyEnd.calledCount()).to.be.deep.equal(1)
      expect(spyResponse.calledCount()).to.be.deep.equal(0)
      expect(spyError.calledCount()).to.be.deep.equal(1)

      expect(spyEnd.calledWith()).to.be.deep.equal([[]])
      expect(spyResponse.calledWith()).to.be.deep.equal([])
      expect(spyError.calledWith()).to.be.deep.equal([[error]])

      done()
    })

    it('when an error happens with a http timeout', (done) => {
      const error = 'Error: Can the maker repair what he makes?'

      let requestEmitter = new EE()

      superagentLogger(logger)(requestEmitter)

      let spyEnd = spy.emitter()
      let spyResponse = spy.emitter()
      let spyError = spy.emitter()

      requestEmitter.on('end', spyEnd)
      requestEmitter.on('response', spyResponse)
      requestEmitter.on('error', spyError)

      requestEmitter.emit('error', error)

      expect(spyEnd.calledCount()).to.be.deep.equal(0)
      expect(spyResponse.calledCount()).to.be.deep.equal(0)
      expect(spyError.calledCount()).to.be.deep.equal(1)

      expect(spyEnd.calledWith()).to.be.deep.equal([])
      expect(spyResponse.calledWith()).to.be.deep.equal([])
      expect(spyError.calledWith()).to.be.deep.equal([[error]])

      done()
    })
  })

  describe('integration', () => {

    before((done) => {
      // reset `ringbuffer.records`
      ringbuffer.records = []

      app.get('/', (req, res) => {
        res.send('Hello World!')
      })

      app.post('/', (req, res) => {
        res.send('ok')
      })

      app.get('/whitrequestid', (req, res) => {
        expect(req.headers).to.have.deep.property('x-request-id')
        res.send('Hello World!')
      })

      app.get('/json', (req, res) => {
        res.send({ msg: 'Hello World!' })
      })

      app.get('/someuuid', (req, res) => {
        expect(req.query).to.be.deep.equal({ a: '123' })
        expect(req.headers).to.have.deep.property('x-request-id')
        expect(req.headers['x-request-id'])
          .to.be.equal('Quite an experience to live in fear, isn\'t it?')
        res.send('Hello World!')
      })

      app.get('/someuuidbutdontsend', (req, res) => {
        expect(req.headers['x-request-id']).to.be.deep.equal(undefined)
        res.send('Hello World!')
      })

      app.get('/5xx-error', (req, res) => {
        res.status(500).json({ error: true })
      })

      server = app.listen(3000, done)
    })

    after((done) => {
      server.close(done)
    })

    it('normal request', (done) => {
      request
        .get('http://localhost:3000')
        .use(superagentLogger(logger))
        .end((err, res) => {
          expect(err).to.be.a('null')
          expect(res).to.be.an('object')
          expect(res.opDuration).to.be.a('number')

          testLogRecords(getRecords(), (log1, log2) => {
            expect(log1.req.qs).to.be.deep.equal(undefined)
            expect(log2.err).to.be.deep.equal(undefined)
            expect(log2.res).to.be.an('object')
            expect(log2.res.statusCode).to.be.equal(200)
            expect(log2.res.headers).to.be.an('object')
            done()
          })
        })
    })

    it('request with query string', (done) => {
      request
        .get('http://localhost:3000')
        .query({ a: 1, b: 2 })
        .use(superagentLogger(logger))
        .end((err, res) => {
          expect(err).to.be.deep.equal(null)
          expect(res).to.be.an('object')
          expect(res.opDuration).to.be.a('number')

          testLogRecords(getRecords(), (log1, log2) => {
            expect(log1.req.qs).to.be.an('object')
            expect(log2.err).to.be.deep.equal(undefined)
            expect(log2.res).to.be.an('object')
            expect(log2.res.statusCode).to.be.equal(200)
            expect(log2.res.headers).to.be.an('object')
            done()
          })
        })
    })

    it('request with raw query string', (done) => {
      request
        .get('http://localhost:3000')
        .query('a=1&b=2')
        .use(superagentLogger(logger))
        .end((err, res) => {
          expect(err).to.be.deep.equal(null)
          expect(res).to.be.an('object')
          expect(res.opDuration).to.be.a('number')

          testLogRecords(getRecords(), (log1, log2) => {
            expect(log1.req.qs).to.equal('a=1&b=2')
            expect(log2.err).to.be.deep.equal(undefined)
            expect(log2.res).to.be.an('object')
            expect(log2.res.statusCode).to.be.equal(200)
            expect(log2.res.headers).to.be.an('object')
            done()
          })
        })
    })

    it('send a request with payload', (done) => {
      request
        .post('http://localhost:3000')
        .send({ msg: 'More human than human is our motto' })
        .use(superagentLogger(logger))
        .end((err, res) => {
          expect(err).to.be.deep.equal(null)
          expect(res).to.be.an('object')
          expect(res.opDuration).to.be.a('number')

          testLogRecords(getRecords(), (log1, log2) => {
            expect(log1.req.qs).to.be.deep.equal(undefined)
            expect(log1.req.method).to.be.equal('POST')
            expect(log1.req.url).to.be
              .equal('http://localhost:3000')
            expect(log1.req.body).to.be.deep
              .equal({ msg: 'More human than human is our motto' })
            expect(log2.err).to.be.deep.equal(undefined)
            expect(log2.res).to.be.an('object')
            expect(log2.res.statusCode).to.be.deep.equal(200)
            expect(log2.res.headers).to.be.an('object')
            done()
          })
        })
    })

    it('receive a response with a JSON payload', (done) => {
      request
        .get('http://localhost:3000/json')
        .use(superagentLogger(logger))
        .end((err, res) => {
          expect(err).to.be.deep.equal(null)
          expect(res).to.be.an('object')
          expect(res.body).to.be.deep.equal({ msg: 'Hello World!' })
          expect(res.opDuration).to.be.a('number')

          testLogRecords(getRecords(), (log1, log2) => {
            expect(log1.req.qs).to.be.an('undefined')
            expect(log1.req.path).to.be.equal('/json')
            expect(log2.err).to.be.deep.equal(undefined)
            expect(log2.res).to.be.an('object')
            expect(log2.res.statusCode).to.be.equal(200)
            expect(log2.res.body).to.be.deep.equal({ msg: 'Hello World!' })
            expect(log2.res.headers).to.be.an('object')
            done()
          })
        })
    })

    it('pick the X-Request-ID from the headers', (done) => {
      request
        .get('http://localhost:3000/someuuid')
        .query({ a: 123 })
        .set('X-Request-ID', 'Quite an experience to live in fear, isn\'t it?')
        .use(superagentLogger(logger))
        .end((err, res) => {
          expect(err).to.be.deep.equal(null)
          expect(res).to.be.an('object')
          expect(res.opDuration).to.be.a('number')

          testLogRecords(getRecords(), (log1, log2) => {
            expect(log1.req.qs).to.be.an('object')
            expect(log1.req.path).to.be.equal('/someuuid')
            expect(log2.err).to.be.deep.equal(undefined)
            expect(log2.res).to.be.an('object')
            expect(log2.res.statusCode).to.be.equal(200)
            expect(log2.res.headers).to.be.an('object')
            done()
          })
        })
    })

    it('passing the request id directly to `superagent-bunyan`', (done) => {
      request
        .get('http://localhost:3000/someuuidbutdontsend')
        .use(
          superagentLogger(
            logger,
            'Quite an experience to live in fear, isn\'t it?'
          )
        )
        .end((err, res) => {
          expect(err).to.be.deep.equal(null)
          expect(res).to.be.an('object')
          expect(res.opDuration).to.be.a('number')

          testLogRecords(getRecords(), (log1, log2) => {
            expect(log1.req.qs).to.be.an('undefined')
            expect(log2.err).to.be.deep.equal(undefined)
            expect(log2.res).to.be.an('object')
            expect(log2.res.statusCode).to.be.equal(200)
            expect(log2.res.headers).to.be.an('object')
            done()
          })
        })
    })

    it('using `extra` to pass extra info in the log entry', (done) => {
      request
        .get('http://localhost:3000/someuuidbutdontsend')
        .use(
          superagentLogger(
            logger,
            { extra: 'But then again, who does?' }
          )
        )
        .end((err, res) => {
          expect(err).to.be.deep.equal(null)
          expect(res).to.be.an('object')
          expect(res.opDuration).to.be.a('number')

          testLogRecords(getRecords(), (log1, log2) => {
            expect(log1.req.qs).to.be.an('undefined')
            expect(log1.extra).to.be.equal('But then again, who does?')
            expect(log2.err).to.be.deep.equal(undefined)
            expect(log2.res).to.be.an('object')
            expect(log2.res.statusCode).to.be.equal(200)
            expect(log2.res.headers).to.be.an('object')
            expect(log2.extra).to.be.equal('But then again, who does?')
            done()
          })
        })
    })

    it('passing the request id and using `extra` arg', (done) => {
      request
        .get('http://localhost:3000/someuuidbutdontsend')
        .use(
          superagentLogger(
            logger,
            1234,
            { extra: 'But then again, who does?' }
          )
        )
        .end((err, res) => {
          expect(err).to.be.deep.equal(null)
          expect(res).to.be.an('object')
          expect(res.opDuration).to.be.a('number')

          testLogRecords(getRecords(), (log1, log2) => {
            expect(log1.req.qs).to.be.an('undefined')
            expect(log1.extra).to.be.equal('But then again, who does?')
            expect(log2.err).to.be.deep.equal(undefined)
            expect(log2.res).to.be.an('object')
            expect(log2.res.statusCode).to.be.equal(200)
            expect(log2.res.headers).to.be.an('object')
            expect(log2.extra).to.be.equal('But then again, who does?')
            done()
          })
        })
    })

    it('request with a http error', (done) => {
      request
        .get('http://localhost:3000/not_found')
        .use(superagentLogger(logger))
        .end((err, res) => {
          expect(err).to.be.an('error')
          expect(res.opDuration).to.be.a('number')

          testLogRecords(getRecords(3), (log1, log2) => {
            expect(log1.req.qs).to.be.deep.equal(undefined)
            expect(log2.err).to.be.an('object')
            expect(log2.res).to.be.an('object')
            expect(log2.res.statusCode).to.be.equal(404)
            expect(log2.res.headers).to.be.an('object')
            expect(log2.err.name).to.be.equal('Error')
            done()
          })
        })
    })

    it('request with connection error', (done) => {
      request
        .get('http://localhost:3001')
        .use(superagentLogger(logger))
        .end((err) => {
          expect(err).to.be.an('error')
          expect(err.opDuration).to.be.a('number')

          testLogRecords(getRecords(), (log1, log2) => {
            expect(log1.req.qs).to.be.deep.equal(undefined)
            expect(log2.res).to.equal(undefined)
            expect(log2.err).to.be.an('object')
            expect(log2.err.name).to.be.equal('Error')
            done()
          })
        })
    })

    it('receive a 500 error', (done) => {
      request
        .get('http://localhost:3000/5xx-error')
        .use(superagentLogger(logger))
        .end((err, res) => {
          expect(err).to.be.an('error')
          expect(res.opDuration).to.be.a('number')

          testLogRecords(getRecords(), (log1, log2) => {
            expect(log1.req.qs).to.be.deep.equal(undefined)
            expect(log2.err).to.be.an('object')
            expect(log2.res).to.be.an('object')
            expect(log2.res.body).to.deep.equal({ error: true })
            expect(log2.res.statusCode).to.be.equal(500)
            expect(log2.res.headers).to.be.an('object')
            expect(log2.err.name).to.be.equal('Error')
            done()
          })
        })
    })

    it('using custom origin in the log entry', (done) => {
      request
        .get('http://localhost:3000/someuuidbutdontsend')
        .use(
          superagentLogger(
            logger.child({ origin: 'custom' }),
            { extra: 'But then again, who does?' }
          )
        )
        .end((err, res) => {
          expect(err).to.be.deep.equal(null)
          expect(res).to.be.an('object')
          expect(res.opDuration).to.be.a('number')

          const records = getRecords()
          expect(records[0].origin).to.be.equal('custom')
          expect(records[1].origin).to.be.equal('custom')
          done()
        })
    })
  })
})

//
// test some of the props that should exist with the `log`
//

function testLogRecords (records, runExtraExpections) {

  records.forEach(each)

  runExtraExpections(records[0], records[1])

  function each (record, index) {
    // default values for both entries
    expect(record.name).to.be.equal('superagent-bunyan')
    expect(record.origin).to.be.equal('superagent')

    expect(record).to.have.deep.property('req_id')
    expect(record).to.have.deep.property('hostname')
    expect(record).to.have.deep.property('pid')
    expect(record).to.have.deep.property('level')
    expect(record).to.have.deep.property('time')

    // the initial request
    if (!index) {
      expect(record.msg).to.be.equal('start of the request')
      expect(record.req).to.be.an('object')
      expect(record.req.method).to.be.a('string')
      expect(record.req.url).to.be.a('string')
      expect(record.req.headers).to.be.an('object')
    } else { // the response
      expect(record.msg).to.be.equal('end of the request')
      expect(record.duration).to.be.a('number')
    }
  }
}

//
// should return an array with the two entries
// 'start of the request and 'end of the request'
//

function getRecords (n) {
  n = n || 2

  return ringbuffer.records.splice(0, n).map(parse)

  function parse (record) {
    return JSON.parse(JSON.stringify(record))
  }
}
