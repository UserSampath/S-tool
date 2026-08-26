// MongoDB-backed saved colours, scoped to one user.
const { mongoose } = require('../db/connect');
const Swatch = require('../models/Swatch');

async function listFor(userId) {
  return Swatch.find({ user: userId }).sort({ createdAt: -1 });
}

async function create(userId, { hex, name }) {
  // Checked here as well as by the unique index: on a new collection the index
  // can still be building when the first insert lands.
  const clash = await Swatch.findOne({ user: userId, hex });
  if (clash) return { duplicate: true, existing: clash };

  try {
    return await Swatch.create({ user: userId, hex, name: name || '' });
  } catch (err) {
    if (err.code === 11000) return { duplicate: true };
    throw err;
  }
}

async function rename(userId, id, name) {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;

  return Swatch.findOneAndUpdate(
    { user: userId, _id: id },
    { name },
    { returnDocument: 'after', runValidators: true }
  );
}

async function remove(userId, id) {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  return Swatch.findOneAndDelete({ user: userId, _id: id });
}

module.exports = { listFor, create, rename, remove };
