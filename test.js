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
      const resBody = {statusCode: 200, header: {}, body: 'hello'}

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
        expect(req.headers['x-request-id']).to.exist
        res.send('Hello World!')
      })

      app.get('/json', (req, res) => {
        res.send({msg: 'Hello World!'})
      })

      app.get('/someuuid', (req, res) => {
        expect(req.query).to.be.deep.equal({a: '123'})
        expect(req.headers['x-request-id']).to.exist
        expect(req.headers['x-request-id'])
          .to.be.equal('Quite an experience to live in fear, isn\'t it?')
        res.send('Hello World!')
      })

      app.get('/someuuidbutdontsend', (req, res) => {
        expect(req.headers['x-request-id']).to.not.exist
        res.send('Hello World!')
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

          testLogRecords(getRecords(), (log1, log2) => {
            expect(log2.err).to.not.exist
            expect(log2.res).to.be.an('object')
            expect(log2.res.statusCode).to.be.equal(200)
            done()
          })
        })
    })

    it('send a request with payload', (done) => {
      request
        .post('http://localhost:3000')
        .send({msg: 'More human than human is our motto'})
        .use(superagentLogger(logger))
        .end((err, res) => {
          expect(err).to.be.a('null')
          expect(res).to.be.an('object')

          testLogRecords(getRecords(), (log1, log2) => {
            expect(log2.err).to.not.exist
            expect(log2.res).to.be.an('object')
            expect(log2.res.statusCode).to.be.equal(200)
            done()
          })
        })
    })

    it('receive a response with a JSON payload', (done) => {
      request
        .get('http://localhost:3000/json')
        .use(superagentLogger(logger))
        .end((err, res) => {
          expect(err).to.be.a('null')
          expect(res).to.be.an('object')
          expect(res.body).to.be.deep.equal({msg: 'Hello World!'})

          testLogRecords(getRecords(), (log1, log2) => {
            expect(log2.err).to.not.exist
            expect(log2.res).to.be.an('object')
            expect(log2.res.statusCode).to.be.equal(200)
            expect(log2.res.body).to.be.deep.equal({msg: 'Hello World!'})
            done()
          })
        })
    })

    it('pick the X-Request-ID from the headers', (done) => {
      request
        .get('http://localhost:3000/someuuid')
        .query({a: 123})
        .set('X-Request-ID', 'Quite an experience to live in fear, isn\'t it?')
        .use(superagentLogger(logger))
        .end((err, res) => {
          expect(err).to.be.a('null')
          expect(res).to.be.an('object')

          testLogRecords(getRecords(), (log1, log2) => {
            expect(log2.err).to.not.exist
            expect(log2.res).to.be.an('object')
            expect(log2.res.statusCode).to.be.equal(200)
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
          expect(err).to.be.a('null')
          expect(res).to.be.an('object')

          testLogRecords(getRecords(), (log1, log2) => {
            expect(log2.err).to.not.exist
            expect(log2.res).to.be.an('object')
            expect(log2.res.statusCode).to.be.equal(200)
            done()
          })
        })
    })

    it('request with a http error', (done) => {
      request
        .get('http://localhost:3000/not_found')
        .use(superagentLogger(logger))
        .end((err, res) => {
          expect(err).to.exist

          testLogRecords(getRecords(3), (log1, log2) => {
            expect(log2.err).to.be.an('object')
            expect(log2.res).to.be.an('object')
            expect(log2.res.statusCode).to.be.equal(404)
            expect(log2.err.name).to.be.equal('Error')
            done()
          })
        })
    })

    it('request with connection error', (done) => {
      request
        .get('http://localhost:3001')
        .use(superagentLogger(logger))
        .end((err, res) => {
          expect(err).to.exist

          testLogRecords(getRecords(), (log1, log2) => {
            expect(log2.res).to.be.an('object')
            expect(log2.err).to.be.an('object')
            expect(log2.err.name).to.be.equal('Error')
            done()
          })
        })
    })
  })
})

//
// generic tests
//

function testLogRecords (records, runExtraExpections) {

  records.forEach(each)

  runExtraExpections(records[0], records[1])

  function each (record, index) {
    expect(record.name).to.be.equal('superagent-bunyan')
    expect(record.id).to.exist
    expect(record.hostname).to.exist
    expect(record.pid).to.be.a('number')
    expect(record.level).to.be.a('number')
    expect(record.origin).to.be.equal('superagent')
    expect(record.time).to.exist

    if (!index) {
      expect(record.msg).to.be.equal('start of the request')
      expect(record.req).to.be.an('object')
      expect(record.req.method).to.be.a('string')
      expect(record.req.url).to.be.a('string')
      expect(record.req.headers).to.be.an('object')
      expect(record.qs).to.be.an('object')
    } else {
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
