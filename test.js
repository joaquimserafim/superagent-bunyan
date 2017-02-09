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

const logger = bunyan.createLogger({name: 'superagent-bunyan'})

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
          done()
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
          done()
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
          done()
        })
    })

    it('pick the request Id from the headers', (done) => {
      request
        .get('http://localhost:3000/someuuid')
        .set('X-Request-ID', 'Quite an experience to live in fear, isn\'t it?')
        .use(superagentLogger(logger))
        .end((err, res) => {
          expect(err).to.be.a('null')
          expect(res).to.be.an('object')
          done()
        })
    })

    it('pick the request Id from the headers', (done) => {
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
          done()
        })
    })

    it('request with a http error', (done) => {
      request
        .get('http://localhost:3000/not_found')
        .use(superagentLogger(logger))
        .end((err, res) => {
          expect(err).to.exist
          done()
        })
    })

    it('request with timeout error', (done) => {
      request
        .get('http://localhost:3001')
        .use(superagentLogger(logger))
        .end((err, res) => {
          expect(err).to.exist
          done()
        })
    })
  })
})
