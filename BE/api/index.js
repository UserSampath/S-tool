// Vercel entry point.
//
// Every file under api/ becomes a serverless function, and vercel.json routes
// the whole site here - so this is the only function, and it hands each request
// to the same Express app that src/server.js runs locally. There is one
// implementation of the API, not two that drift apart.
//
// The difference from server.js is where the database connection happens.
// server.js connects once, before it starts listening. Here there is no boot:
// a request can arrive at a container that has never connected, so every
// invocation waits for the shared connection promise first. On a warm container
// that promise is already resolved and the wait costs nothing.
const app = require('../src/app');
const { connect } = require('../src/db/connect');

module.exports = async function handler(req, res) {
  try {
    await connect();
  } catch (err) {
    // Reported here rather than left to Express: without a database the app
    // cannot answer anything, and a 503 says that more honestly than the 500
    // each individual query would produce on its way out.
    console.error('[api] database unavailable:', err.message);
    res.statusCode = 503;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ error: 'Database unavailable' }));
    return;
  }

  return app(req, res);
};
