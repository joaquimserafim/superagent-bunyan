/*
eslint
no-multi-spaces: ["error", {exceptions: {"VariableDeclarator": true}}]
padded-blocks: ["error", {"classes": "always"}]
max-len: ["error", 80]
*/
'use strict'

const express       = require('express')
const request       = require('superagent')
const bunyan        = require('bunyan')
const mocha         = require('mocha')
const expect        = require('chai').expect

const it        = mocha.it
const describe  = mocha.describe
const before    = mocha.before

const superagentLogger = require('./')

const app = express()
const logger = bunyan.createLogger({name: 'superagent-bunyan'})
let server

describe('superagent-bunyan', () => {

  before((done) => {
    logger.info('initializing server')

    app.get('/', (req, res) => {
      res.send('Hello World!')
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

    server = app.listen(3000, done)
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

  it('request sends the X-Request-ID header', (done) => {
    request
      .get('http://localhost:3000/whitrequestid')
      .use(superagentLogger(logger, true))
      .end((err, res) => {
        expect(err).to.be.a('null')
        expect(res).to.be.an('object')
        done()
      })
  })

  it('request with a JSON payload', (done) => {
    request
      .get('http://localhost:3000/json')
      .use(superagentLogger(logger))
      .end((err, res) => {
        expect(err).to.be.a('null')
        expect(res).to.be.an('object')
        done()
      })
  })

  it('set the req.id for the request', (done) => {
    request
      .get('http://localhost:3000')
      .use(
        superagentLogger(
          logger,
          true,
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

  it('teardown server', (done) => {
    server.close(done)
  })
})
