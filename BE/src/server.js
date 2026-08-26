// Must run before anything else: utils/token.js and services/auth.js both read
// their secrets from the environment at require time.
require('dotenv').config();

const app = require('./app');
const { connect, disconnect } = require('./db/connect');

const PORT = process.env.PORT || 3000;

async function start() {
  // Connect first so the server never accepts a request it cannot serve.
  await connect();

  const server = app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
  });

  const shutdown = async (signal) => {
    console.log(`\n${signal} received, shutting down`);
    server.close(async () => {
      await disconnect();
      process.exit(0);
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

start().catch((err) => {
  console.error('[startup] failed:', err.message);
  process.exit(1);
});
