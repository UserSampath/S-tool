const express = require('express');

const plans = require('../store/plans');
const { HORIZONS, PRIORITY_MIN, PRIORITY_MAX } = require('../models/Plan');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Every plan route is per-user, so none of them are reachable unauthenticated.
router.use(requireAuth);

const TITLE_MAX = 200;

function readHorizon(value) {
  return HORIZONS.includes(value) ? value : null;
}

function badRequest(res, message) {
  return res.status(400).json({ error: message });
}

// Returns { value } on success or { error } on failure, so a valid 0 is not
// confused with "not provided".
function readPriority(value) {
  const number = Number(value);

  if (!Number.isInteger(number) || number < PRIORITY_MIN || number > PRIORITY_MAX) {
    return { error: `priority must be a whole number from ${PRIORITY_MIN} to ${PRIORITY_MAX}` };
  }

  return { value: number };
}

function readTitle(value) {
  const title = String(value ?? '').trim();

  if (!title) return { error: 'title is required' };
  if (title.length > TITLE_MAX) return { error: `title must be ${TITLE_MAX} characters or fewer` };

  return { value: title };
}

// GET /api/plans?horizon=short
router.get('/', async (req, res, next) => {
  try {
    const horizon = readHorizon(req.query.horizon);
    if (!horizon) return badRequest(res, `horizon must be one of: ${HORIZONS.join(', ')}`);

    const list = await plans.listFor(req.user._id, horizon);
    res.json({ data: list });
  } catch (err) {
    next(err);
  }
});

// POST /api/plans  { horizon, title, priority? }
router.post('/', async (req, res, next) => {
  try {
    const { horizon: rawHorizon, title: rawTitle, priority } = req.body || {};

    const horizon = readHorizon(rawHorizon);
    if (!horizon) return badRequest(res, `horizon must be one of: ${HORIZONS.join(', ')}`);

    const title = readTitle(rawTitle);
    if (title.error) return badRequest(res, title.error);

    let level;
    if (priority !== undefined) {
      const parsed = readPriority(priority);
      if (parsed.error) return badRequest(res, parsed.error);
      level = parsed.value;
    }

    const plan = await plans.create(req.user._id, { horizon, title: title.value, priority: level });
    res.status(201).json({ data: plan });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/plans/reorder  { horizon, ids: [...] }
// Declared before /:id so "reorder" is not read as a plan id.
router.patch('/reorder', async (req, res, next) => {
  try {
    const { horizon: rawHorizon, ids } = req.body || {};

    const horizon = readHorizon(rawHorizon);
    if (!horizon) return badRequest(res, `horizon must be one of: ${HORIZONS.join(', ')}`);

    if (!Array.isArray(ids)) return badRequest(res, 'ids must be an array of plan ids');

    const moved = await plans.reorder(req.user._id, horizon, ids);
    res.json({ message: 'Order saved', moved });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/plans/done?horizon=short - clears completed plans in one horizon.
router.delete('/done', async (req, res, next) => {
  try {
    const horizon = readHorizon(req.query.horizon);
    if (!horizon) return badRequest(res, `horizon must be one of: ${HORIZONS.join(', ')}`);

    const removed = await plans.removeDone(req.user._id, horizon);
    res.json({ message: 'Completed plans cleared', removed });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/plans/:id  { title?, done?, priority? }
router.patch('/:id', async (req, res, next) => {
  try {
    const { title, done, priority } = req.body || {};
    const patch = {};

    if (title !== undefined) {
      const parsed = readTitle(title);
      if (parsed.error) return badRequest(res, parsed.error);
      patch.title = parsed.value;
    }

    if (done !== undefined) {
      if (typeof done !== 'boolean') return badRequest(res, 'done must be true or false');
      patch.done = done;
    }

    if (priority !== undefined) {
      const parsed = readPriority(priority);
      if (parsed.error) return badRequest(res, parsed.error);
      patch.priority = parsed.value;
    }

    if (!Object.keys(patch).length) return badRequest(res, 'Nothing to update');

    const plan = await plans.update(req.user._id, req.params.id, patch);
    if (!plan) return res.status(404).json({ error: 'No such plan' });

    res.json({ data: plan });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/plans/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const plan = await plans.remove(req.user._id, req.params.id);
    if (!plan) return res.status(404).json({ error: 'No such plan' });

    res.json({ message: 'Plan deleted', data: plan });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
