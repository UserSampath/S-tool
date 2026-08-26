// MongoDB-backed instruction chips and correction history, scoped to one user.
const { mongoose } = require('../db/connect');
const GrammarPreset = require('../models/GrammarPreset');
const GrammarRun = require('../models/GrammarRun');
const { GRAMMAR_DEFAULT_PRESETS } = require('../config/prompts');

// History is a convenience, not an archive. Older runs are trimmed so a heavy
// week cannot grow the collection without bound.
const HISTORY_KEEP = 100;

/**
 * The user's chips, seeded from config/prompts.js the first time they ask.
 *
 * Seeding on read rather than at registration means accounts made before this
 * feature existed get their defaults too, the next time they open the tool.
 */
async function listPresets(userId) {
  const existing = await GrammarPreset.find({ user: userId }).sort({ order: 1, createdAt: 1 });
  if (existing.length) return existing;

  // A user who deletes every chip should not have them silently reappear, so
  // only seed when they have never had any.
  const everHad = await GrammarRun.countDocuments({ user: userId });
  if (everHad) return existing;

  await GrammarPreset.insertMany(
    GRAMMAR_DEFAULT_PRESETS.map((text, order) => ({ user: userId, text, order }))
  );

  return GrammarPreset.find({ user: userId }).sort({ order: 1, createdAt: 1 });
}

async function createPreset(userId, text) {
  // Checked here as well as by the unique index: on a brand new collection the
  // index can still be building when the first insert lands, which would let a
  // duplicate through. The index stays as the backstop for concurrent writes.
  const clash = await GrammarPreset.findOne({ user: userId, text }).collation({
    locale: 'en',
    strength: 2, // case-insensitive: two chips differing only in case are the same chip
  });
  if (clash) return { duplicate: true };

  const last = await GrammarPreset.findOne({ user: userId }).sort({ order: -1 }).select('order');

  try {
    return await GrammarPreset.create({
      user: userId,
      text,
      order: last ? last.order + 1 : 0,
    });
  } catch (err) {
    // The unique index is what actually enforces "no duplicate chips".
    if (err.code === 11000) return { duplicate: true };
    throw err;
  }
}

async function removePreset(userId, id) {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  return GrammarPreset.findOneAndDelete({ user: userId, _id: id });
}

async function listHistory(userId, limit = 25) {
  return GrammarRun.find({ user: userId }).sort({ createdAt: -1 }).limit(limit);
}

async function recordRun(userId, run) {
  const saved = await GrammarRun.create({ user: userId, ...run });

  // Trim anything past the cap, oldest first.
  const stale = await GrammarRun.find({ user: userId })
    .sort({ createdAt: -1 })
    .skip(HISTORY_KEEP)
    .select('_id');

  if (stale.length) {
    await GrammarRun.deleteMany({ user: userId, _id: { $in: stale.map((entry) => entry._id) } });
  }

  return saved;
}

async function removeRun(userId, id) {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  return GrammarRun.findOneAndDelete({ user: userId, _id: id });
}

async function clearHistory(userId) {
  const result = await GrammarRun.deleteMany({ user: userId });
  return result.deletedCount;
}

module.exports = {
  listPresets,
  createPreset,
  removePreset,
  listHistory,
  recordRun,
  removeRun,
  clearHistory,
  HISTORY_KEEP,
};
