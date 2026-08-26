const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';

const SECRET = (() => {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;

  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET must be set in production');
  }

  // Dev fallback: a per-boot random secret. Tokens stop working on restart,
  // which is preferable to shipping a hardcoded secret.
  console.warn('[auth] JWT_SECRET not set - using a random secret for this run only');
  return crypto.randomBytes(32).toString('hex');
})();

function sign(user) {
  return jwt.sign({ sub: user.id, username: user.username }, SECRET, { expiresIn: EXPIRES_IN });
}

function verify(token) {
  return jwt.verify(token, SECRET);
}

module.exports = { sign, verify, EXPIRES_IN };
