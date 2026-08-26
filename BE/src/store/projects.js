// MongoDB-backed project store. Every function is scoped to one user, so a
// project belonging to somebody else can never be read or written through here.
const { mongoose } = require('../db/connect');
const Project = require('../models/Project');

// Pinned first, then newest. Applied on the server so every client agrees on
// the order without having to sort it themselves.
const ORDER = { pinned: -1, createdAt: -1 };

async function listFor(userId) {
  return Project.find({ user: userId }).sort(ORDER);
}

async function create(userId, { name }) {
  return Project.create({ user: userId, name });
}

async function update(userId, id, patch) {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;

  return Project.findOneAndUpdate({ user: userId, _id: id }, patch, {
    returnDocument: 'after',
    runValidators: true,
  });
}

async function remove(userId, id) {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  return Project.findOneAndDelete({ user: userId, _id: id });
}

module.exports = { listFor, create, update, remove };
