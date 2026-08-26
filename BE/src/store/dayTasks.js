// MongoDB-backed day plans, scoped to one user.
//
// A task's `date` is either a YYYY-MM-DD day or null, and null is the product
// backlog. Both live in one collection because they are the same thing at
// different stages of commitment, and moving between them is then a field
// change rather than a copy between two tables.
const { mongoose } = require('../db/connect');
const DayTask = require('../models/DayTask');

// `date` is null for the backlog. Passing it straight into the query works:
// { date: null } matches documents whose date is null.
async function listFor(userId, date) {
  return DayTask.find({ user: userId, date }).sort({ order: 1, createdAt: 1 });
}

async function create(userId, { date, title }) {
  const last = await DayTask.findOne({ user: userId, date }).sort({ order: -1 }).select('order');

  return DayTask.create({
    user: userId,
    date,
    title,
    order: last ? last.order + 1 : 0,
  });
}

async function get(userId, id) {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  return DayTask.findOne({ user: userId, _id: id });
}

// `extraFilter` lets a caller narrow what it is willing to update - the status
// routes use it to refuse a task that is sitting in the backlog.
async function update(userId, id, patch, extraFilter = {}) {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;

  return DayTask.findOneAndUpdate({ user: userId, _id: id, ...extraFilter }, patch, {
    returnDocument: 'after',
    runValidators: true,
  });
}

async function remove(userId, id) {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  return DayTask.findOneAndDelete({ user: userId, _id: id });
}

/**
 * Move a task to a day, to the backlog (date null), or to a new position in the
 * list it is already in. `index` is the position among the destination's tasks
 * with the moved one taken out, which is what a drag actually describes.
 *
 * Returns { error } rather than throwing, so the route can choose the status
 * code without unpicking an exception.
 */
async function move(userId, id, { date, index }) {
  if (!mongoose.Types.ObjectId.isValid(id)) return { error: 'notfound' };

  const task = await DayTask.findOne({ user: userId, _id: id });
  if (!task) return { error: 'notfound' };

  // Only unstarted work goes back to the backlog. Once a task is in progress or
  // done it is a record of a day that happened, and un-dating it would erase
  // that: the calendar would quietly lose a day it had already counted.
  if (date === null && task.status !== 'todo') {
    return { error: 'started' };
  }

  const siblings = await DayTask.find({ user: userId, date, _id: { $ne: task._id } })
    .sort({ order: 1, createdAt: 1 })
    .select('_id');

  const ids = siblings.map((row) => row._id);
  const at = index === null || index === undefined
    ? ids.length
    : Math.max(0, Math.min(Number(index), ids.length));

  ids.splice(at, 0, task._id);

  // Rewrite the whole destination list as 0..n-1 rather than nudging one row:
  // positions stay dense however many drags have happened, and the moved task
  // and its new neighbours are settled in a single round trip.
  await DayTask.bulkWrite(
    ids.map((docId, order) => ({
      updateOne: { filter: { _id: docId, user: userId }, update: { $set: { date, order } } },
    }))
  );

  return { data: await DayTask.findOne({ user: userId, _id: id }) };
}

/**
 * Per-day counts across a date range, for the calendar indicators.
 *
 * Aggregated in the database rather than by fetching every task in the month
 * and counting in the client - the calendar only needs four numbers per day.
 *
 * Backlog tasks never appear here: null sorts below every string in BSON, so
 * the range match excludes them without needing to say so.
 */
async function summary(userId, from, to) {
  const rows = await DayTask.aggregate([
    { $match: { user: new mongoose.Types.ObjectId(String(userId)), date: { $gte: from, $lte: to } } },
    {
      $group: {
        _id: '$date',
        total: { $sum: 1 },
        done: { $sum: { $cond: [{ $eq: ['$status', 'done'] }, 1, 0] } },
        doing: { $sum: { $cond: [{ $eq: ['$status', 'doing'] }, 1, 0] } },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  return rows.map((row) => ({
    date: row._id,
    total: row.total,
    done: row.done,
    doing: row.doing,
    todo: row.total - row.done - row.doing,
  }));
}

module.exports = { listFor, get, create, update, remove, move, summary };
