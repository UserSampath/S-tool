// MongoDB-backed quick notes, scoped to one user.
const { mongoose } = require('../db/connect');
const QuickNote = require('../models/QuickNote');

async function listFor(userId) {
  return QuickNote.find({ user: userId }).sort({ createdAt: -1 });
}

async function create(userId, text) {
  return QuickNote.create({ user: userId, text });
}

async function update(userId, id, text) {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;

  return QuickNote.findOneAndUpdate(
    { user: userId, _id: id },
    { text },
    { returnDocument: 'after', runValidators: true }
  );
}

async function remove(userId, id) {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  return QuickNote.findOneAndDelete({ user: userId, _id: id });
}

module.exports = { listFor, create, update, remove };
