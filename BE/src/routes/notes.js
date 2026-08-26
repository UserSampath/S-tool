const express = require('express');

const notes = require('../store/notes');
const { KINDS, TITLE_MAX } = require('../models/Node');
const { sanitize } = require('../utils/richText');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// The whole tree is per-user, so none of these are reachable unauthenticated.
router.use(requireAuth);

function badRequest(res, message) {
  return res.status(400).json({ error: message });
}

function readTitle(value) {
  const title = String(value ?? '').trim();

  if (!title) return { error: 'title is required' };
  if (title.length > TITLE_MAX) return { error: `title must be ${TITLE_MAX} characters or fewer` };

  return { value: title };
}

// GET /api/notes - the whole tree, flat. The client assembles it; there is one
// tree per user and it is small, so paging it would cost more than it saves.
router.get('/', async (req, res, next) => {
  try {
    res.json({ data: await notes.listFor(req.user._id) });
  } catch (err) {
    next(err);
  }
});

// POST /api/notes  { kind, title, parent?, content? }
router.post('/', async (req, res, next) => {
  try {
    const { kind, title, parent = null, content } = req.body || {};

    if (!KINDS.includes(kind)) return badRequest(res, `kind must be one of: ${KINDS.join(', ')}`);

    const parsed = readTitle(title);
    if (parsed.error) return badRequest(res, parsed.error);

    if (parent !== null) {
      const destination = await notes.findOwned(req.user._id, parent);
      if (!destination) return res.status(404).json({ error: 'No such parent folder' });
      if (destination.kind !== 'folder') return badRequest(res, 'Only folders can hold other items');
    }

    const node = await notes.create(req.user._id, {
      kind,
      title: parsed.value,
      parent,
      content: kind === 'note' ? sanitize(content) : '',
    });

    res.status(201).json({ data: node });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/notes/:id/move  { parent, index }
// Declared before /:id so "move" is not read as a node id.
router.patch('/:id/move', async (req, res, next) => {
  try {
    const { parent = null, index = 0 } = req.body || {};

    const result = await notes.move(req.user._id, req.params.id, { parent, index });
    if (result.error) return res.status(result.status || 400).json({ error: result.error });

    res.json({ data: result.node });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/notes/:id  { title?, content?, collapsed? }
router.patch('/:id', async (req, res, next) => {
  try {
    const { title, content, collapsed } = req.body || {};

    const existing = await notes.findOwned(req.user._id, req.params.id);
    if (!existing) return res.status(404).json({ error: 'No such note or folder' });

    const patch = {};

    if (title !== undefined) {
      const parsed = readTitle(title);
      if (parsed.error) return badRequest(res, parsed.error);
      patch.title = parsed.value;
    }

    if (content !== undefined) {
      if (existing.kind !== 'note') return badRequest(res, 'Only notes have content');
      // Never trust what the editor sends; store only what survives the allowlist.
      patch.content = sanitize(content);
    }

    if (collapsed !== undefined) {
      if (typeof collapsed !== 'boolean') return badRequest(res, 'collapsed must be true or false');
      if (existing.kind !== 'folder') return badRequest(res, 'Only folders can be collapsed');
      patch.collapsed = collapsed;
    }

    if (!Object.keys(patch).length) return badRequest(res, 'Nothing to update');

    res.json({ data: await notes.update(req.user._id, req.params.id, patch) });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/notes/:id - a folder takes everything inside it.
router.delete('/:id', async (req, res, next) => {
  try {
    const result = await notes.remove(req.user._id, req.params.id);
    if (!result) return res.status(404).json({ error: 'No such note or folder' });

    res.json({ message: 'Deleted', removed: result.removed, data: result.node });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
