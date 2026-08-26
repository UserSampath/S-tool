// MongoDB-backed user store. Every lookup is async; callers must await.
const { mongoose } = require('../db/connect');
const User = require('../models/User');

async function create({ username, email, passwordHash, pinHash, pinLookup }) {
  return User.create({
    username,
    usernameLower: username.toLowerCase(),
    email: email.toLowerCase(),
    passwordHash,
    pinHash,
    pinLookup, // blind index, see services/auth.js
  });
}

// The id comes from a JWT the client controls, so it is not necessarily a
// valid ObjectId. Treat a malformed one as "no such user" rather than letting
// the CastError bubble up as a 500.
async function findById(id) {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  return User.findById(id);
}

async function findByEmail(email) {
  return User.findOne({ email: String(email).toLowerCase() });
}

async function findByUsername(username) {
  return User.findOne({ usernameLower: String(username).toLowerCase() });
}

async function findByPinLookup(pinLookup) {
  return User.findOne({ pinLookup });
}

async function all() {
  return User.find();
}

// Strips secrets before a user object is sent over the wire.
function toPublic(user) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    createdAt: user.createdAt,
  };
}

module.exports = {
  create,
  findById,
  findByEmail,
  findByUsername,
  findByPinLookup,
  all,
  toPublic,
};
