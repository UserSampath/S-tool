// MongoDB-backed tree of folders and notes. Every function is scoped to one
// user, so another account's tree can never be read, moved or deleted here.
const { mongoose } = require('../db/connect');
const Node = require('../models/Node');

const asId = (value) => (value ? new mongoose.Types.ObjectId(String(value)) : null);

const validId = (value) => value === null || mongoose.Types.ObjectId.isValid(value);

async function listFor(userId) {
  return Node.find({ user: userId }).sort({ parent: 1, order: 1 });
}

async function findOwned(userId, id) {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  return Node.findOne({ user: userId, _id: id });
}

// Siblings of one parent, in order, optionally leaving one node out.
async function siblings(userId, parent, exceptId = null) {
  const query = { user: userId, parent: asId(parent) };
  if (exceptId) query._id = { $ne: exceptId };

  return Node.find(query).sort({ order: 1 }).select('_id order');
}

// Writes 0..n-1 across a list of ids in one round trip.
async function writeOrder(userId, ids) {
  if (!ids.length) return;

  await Node.bulkWrite(
    ids.map((id, index) => ({
      updateOne: { filter: { _id: id, user: userId }, update: { $set: { order: index } } },
    }))
  );
}

async function create(userId, { kind, title, parent = null, content = '' }) {
  const existing = await siblings(userId, parent);

  return Node.create({
    user: userId,
    kind,
    title,
    parent: asId(parent),
    // New nodes land at the bottom of their folder.
    order: existing.length,
    ...(kind === 'note' ? { content } : {}),
  });
}

async function update(userId, id, patch) {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;

  return Node.findOneAndUpdate({ user: userId, _id: id }, patch, {
    returnDocument: 'after',
    runValidators: true,
  });
}

/**
 * Every id at or below `rootId`, the root included. Used to stop a folder being
 * dropped inside itself and to delete a folder's contents with it.
 *
 * Walked level by level rather than with $graphLookup so it behaves the same on
 * any MongoDB deployment, and because a hand-made note tree is shallow.
 */
async function subtreeIds(userId, rootId) {
  const all = [asId(rootId)];
  let frontier = [asId(rootId)];

  while (frontier.length) {
    const children = await Node.find({ user: userId, parent: { $in: frontier } }).select('_id');
    if (!children.length) break;

    frontier = children.map((child) => child._id);
    all.push(...frontier);
  }

  return all;
}

/**
 * Moves a node into `parent` at position `index`, renumbering both the folder
 * it left and the one it joined.
 *
 * Returns a reason string instead of throwing for the cases the client is
 * allowed to see.
 */
async function move(userId, id, { parent = null, index = 0 }) {
  if (!validId(parent)) return { error: 'parent must be a node id or null' };

  const node = await findOwned(userId, id);
  if (!node) return { error: 'No such note or folder', status: 404 };

  const target = parent === null ? null : String(parent);

  if (target !== null) {
    const destination = await findOwned(userId, target);
    if (!destination) return { error: 'No such destination folder', status: 404 };
    if (destination.kind !== 'folder') return { error: 'Only folders can hold other items' };

    // A folder cannot be moved inside itself or anything it contains - that
    // would cut the branch off from the root and lose it.
    if (node.kind === 'folder') {
      const inside = (await subtreeIds(userId, node._id)).map(String);
      if (inside.includes(target)) {
        return { error: 'A folder cannot be moved inside itself' };
      }
    }
  }

  const from = node.parent ? node.parent.toString() : null;
  const rest = await siblings(userId, target, node._id);

  const at = Math.max(0, Math.min(Number(index) || 0, rest.length));
  const ordered = rest.map((sibling) => sibling._id);
  ordered.splice(at, 0, node._id);

  node.parent = asId(target);
  node.order = at;
  await node.save();

  await writeOrder(userId, ordered);

  // The folder it left now has a gap in its numbering; close it.
  if (from !== target) {
    const left = await siblings(userId, from);
    await writeOrder(userId, left.map((sibling) => sibling._id));
  }

  return { node };
}

// Deleting a folder deletes everything inside it. Anything else would leave
// orphans pointing at a parent that no longer exists.
async function remove(userId, id) {
  const node = await findOwned(userId, id);
  if (!node) return null;

  const ids = node.kind === 'folder' ? await subtreeIds(userId, node._id) : [node._id];
  const result = await Node.deleteMany({ user: userId, _id: { $in: ids } });

  // Close the gap left behind in the parent it was removed from.
  const remaining = await siblings(userId, node.parent ? node.parent.toString() : null);
  await writeOrder(userId, remaining.map((sibling) => sibling._id));

  return { node, removed: result.deletedCount };
}

module.exports = { listFor, findOwned, create, update, move, remove, subtreeIds };
