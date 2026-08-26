// MongoDB-backed plan store. Every function is scoped to one user, so a plan
// belonging to somebody else can never be read or written through here.
const { mongoose } = require('../db/connect');
const Plan = require('../models/Plan');

function ownedBy(userId, extra = {}) {
  return { user: userId, ...extra };
}

async function listFor(userId, horizon) {
  return Plan.find(ownedBy(userId, { horizon })).sort({ order: 1, createdAt: 1 });
}

async function create(userId, { horizon, title, priority }) {
  // New plans land at the bottom, which keeps a hand-ordered list undisturbed.
  const last = await Plan.findOne(ownedBy(userId, { horizon })).sort({ order: -1 }).select('order');

  return Plan.create({
    user: userId,
    horizon,
    title,
    ...(priority === undefined ? {} : { priority }),
    order: last ? last.order + 1 : 0,
  });
}

async function update(userId, id, patch) {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;

  return Plan.findOneAndUpdate(ownedBy(userId, { _id: id }), patch, {
    returnDocument: 'after',
    runValidators: true,
  });
}

async function remove(userId, id) {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  return Plan.findOneAndDelete(ownedBy(userId, { _id: id }));
}

// Rewrites positions from an explicit list of ids. Ids that are not this
// user's plans in this horizon are dropped, so a tampered payload reorders
// nothing it does not own.
async function reorder(userId, horizon, ids) {
  const valid = ids.filter((id) => mongoose.Types.ObjectId.isValid(id));

  const owned = await Plan.find(ownedBy(userId, { horizon, _id: { $in: valid } })).select('_id');
  const ownedIds = new Set(owned.map((p) => p._id.toString()));

  const ordered = valid.filter((id) => ownedIds.has(String(id)));
  if (!ordered.length) return 0;

  await Plan.bulkWrite(
    ordered.map((id, index) => ({
      updateOne: { filter: { _id: id, user: userId }, update: { $set: { order: index } } },
    }))
  );

  return ordered.length;
}

// Drops every completed plan in one horizon, for the "clear done" action.
async function removeDone(userId, horizon) {
  const result = await Plan.deleteMany(ownedBy(userId, { horizon, done: true }));
  return result.deletedCount;
}

module.exports = { listFor, create, update, remove, reorder, removeDone };
