const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const users = require('../store/users');
const { requireSecret } = require('../utils/secrets');
const { sign } = require('../utils/token');

const BCRYPT_ROUNDS = 10;
const PIN_INDEX_SECRET = requireSecret('PIN_INDEX_SECRET');

// A real hash of a value nobody can supply, compared against when the account
// is missing so the work done is the same either way. Must be a genuine bcrypt
// hash: comparing against a malformed string returns immediately and would
// reintroduce the timing difference.
const DUMMY_HASH = bcrypt.hashSync(crypto.randomBytes(32).toString('hex'), BCRYPT_ROUNDS);

// PIN-only login has no username to look the user up by. Hashing the PIN with
// bcrypt alone would force a bcrypt compare against every user on each attempt,
// so we also store a keyed HMAC of the PIN as a "blind index": it gives an O(1)
// lookup and lets us enforce PIN uniqueness, while the server-side key keeps a
// leaked database from being reversed offline. bcrypt still does the actual
// verification.
function pinIndex(pin) {
  return crypto.createHmac('sha256', PIN_INDEX_SECRET).update(String(pin)).digest('hex');
}

// Raised for any failure the client is allowed to see.
class AuthError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

// Maps a MongoDB unique-index violation onto the message for the field that
// actually collided. Returns null for anything that is not a duplicate key.
const DUPLICATE_MESSAGES = {
  email: 'Email is already registered',
  usernameLower: 'Username is already taken',
  pinLookup: 'That PIN is already in use, please choose another',
};

function duplicateKeyError(err) {
  if (!err || err.code !== 11000) return null;

  const field = Object.keys(err.keyPattern || err.keyValue || {})[0];
  return new AuthError(DUPLICATE_MESSAGES[field] || 'That account already exists', 409);
}

async function register({ username, email, password, pin }) {
  if (await users.findByEmail(email)) {
    throw new AuthError('Email is already registered', 409);
  }

  if (await users.findByUsername(username)) {
    throw new AuthError('Username is already taken', 409);
  }

  const pinLookup = pinIndex(pin);
  if (await users.findByPinLookup(pinLookup)) {
    throw new AuthError('That PIN is already in use, please choose another', 409);
  }

  const [passwordHash, pinHash] = await Promise.all([
    bcrypt.hash(password, BCRYPT_ROUNDS),
    bcrypt.hash(String(pin), BCRYPT_ROUNDS),
  ]);

  let user;
  try {
    user = await users.create({ username, email, passwordHash, pinHash, pinLookup });
  } catch (err) {
    // The checks above lose to a concurrent registration; the unique indexes
    // are what actually enforce this, so translate their error the same way.
    throw duplicateKeyError(err) || err;
  }

  return { user: users.toPublic(user), token: sign(user) };
}

async function loginWithPassword({ email, password }) {
  const user = await users.findByEmail(email);

  // Hash even when the user is missing so a wrong email and a wrong password
  // take about the same time, and the response cannot be used to enumerate accounts.
  const ok = await bcrypt.compare(password, user ? user.passwordHash : DUMMY_HASH);

  if (!user || !ok) {
    throw new AuthError('Invalid email or password', 401);
  }

  return { user: users.toPublic(user), token: sign(user) };
}

async function loginWithPin({ pin }) {
  const user = await users.findByPinLookup(pinIndex(pin));

  if (!user || !(await bcrypt.compare(String(pin), user.pinHash))) {
    throw new AuthError('Invalid PIN', 401);
  }

  return { user: users.toPublic(user), token: sign(user) };
}

module.exports = { register, loginWithPassword, loginWithPin, AuthError };
