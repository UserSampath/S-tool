const express = require('express');

const projects = require('../store/projects');
const { NAME_MAX } = require('../models/Project');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Projects are per-user, so none of these are reachable unauthenticated.
router.use(requireAuth);

function badRequest(res, message) {
  return res.status(400).json({ error: message });
}

function readName(value) {
  const name = String(value ?? '').trim();

  if (!name) return { error: 'name is required' };
  if (name.length > NAME_MAX) return { error: `name must be ${NAME_MAX} characters or fewer` };

  return { value: name };
}

// GET /api/projects
router.get('/', async (req, res, next) => {
  try {
    res.json({ data: await projects.listFor(req.user._id) });
  } catch (err) {
    next(err);
  }
});

// POST /api/projects  { name }
router.post('/', async (req, res, next) => {
  try {
    const name = readName((req.body || {}).name);
    if (name.error) return badRequest(res, name.error);

    const project = await projects.create(req.user._id, { name: name.value });
    res.status(201).json({ data: project });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/projects/:id  { name?, pinned? }
router.patch('/:id', async (req, res, next) => {
  try {
    const { name, pinned } = req.body || {};
    const patch = {};

    if (name !== undefined) {
      const parsed = readName(name);
      if (parsed.error) return badRequest(res, parsed.error);
      patch.name = parsed.value;
    }

    if (pinned !== undefined) {
      if (typeof pinned !== 'boolean') return badRequest(res, 'pinned must be true or false');
      patch.pinned = pinned;
    }

    if (!Object.keys(patch).length) return badRequest(res, 'Nothing to update');

    const project = await projects.update(req.user._id, req.params.id, patch);
    if (!project) return res.status(404).json({ error: 'No such project' });

    res.json({ data: project });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/projects/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const project = await projects.remove(req.user._id, req.params.id);
    if (!project) return res.status(404).json({ error: 'No such project' });

    res.json({ message: 'Project deleted', data: project });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
