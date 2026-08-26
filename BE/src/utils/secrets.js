const crypto = require('crypto');

// Reads a secret from the environment. In production a missing secret is fatal;
// in development we generate a random one per boot so nothing is hardcoded.
function requireSecret(name) {
  if (process.env[name]) return process.env[name];

  if (process.env.NODE_ENV === 'production') {
    throw new Error(`${name} must be set in production`);
  }

  console.warn(`[auth] ${name} not set - using a random value for this run only`);
  return crypto.randomBytes(32).toString('hex');
}

module.exports = { requireSecret };
