const express = require('express');

const store = require('../store/dayTasks');
const { STATUSES, TITLE_MAX, DATE_RE } = require('../models/DayTask');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);

function badRequest(res, message) {
  return res.status(400).json({ error: message });
}

function readDate(value) {
  const date = String(value ?? '').trim();
  if (!DATE_RE.test(date)) return { error: 'date must look like YYYY-MM-DD' };

  // Catches 2026-02-31 and friends, which match the shape but are not days.
  const [y, m, d] = date.split('-').map(Number);
  const real = new Date(Date.UTC(y, m - 1, d));
  if (real.getUTCFullYear() !== y || real.getUTCMonth() !== m - 1 || real.getUTCDate() !== d) {
    return { error: 'That is not a real date' };
  }

  return { value: date };
}

// A day, or the backlog. null has to be written out by the caller: an absent
// date is a client that forgot one, and silently filing that in the backlog
// would turn a bug into a quietly growing pile of undated tasks.
function readDay(value) {
  if (value === null) return { value: null };
  if (value === undefined) return { error: 'date is required - send null for the backlog' };
  return readDate(value);
}

function readTitle(value) {
  const title = String(value ?? '').trim();

  if (!title) return { error: 'title is required' };
  if (title.length > TITLE_MAX) return { error: `title must be ${TITLE_MAX} characters or fewer` };

  return { value: title };
}

// GET /api/day-tasks/summary?from=&to= - counts per day, for the calendar.
// Declared before the plain list route so the paths cannot be confused.
router.get('/summary', async (req, res, next) => {
  try {
    const from = readDate(req.query.from);
    const to = readDate(req.query.to);
    if (from.error) return badRequest(res, `from: ${from.error}`);
    if (to.error) return badRequest(res, `to: ${to.error}`);
    if (from.value > to.value) return badRequest(res, 'from must not be after to');

    res.json({ data: await store.summary(req.user._id, from.value, to.value) });
  } catch (err) {
    next(err);
  }
});

// GET /api/day-tasks/backlog - everything not promised to a day yet.
router.get('/backlog', async (req, res, next) => {
  try {
    res.json({ data: await store.listFor(req.user._id, null) });
  } catch (err) {
    next(err);
  }
});

// GET /api/day-tasks?date=YYYY-MM-DD
router.get('/', async (req, res, next) => {
  try {
    const date = readDate(req.query.date);
    if (date.error) return badRequest(res, date.error);

    res.json({ data: await store.listFor(req.user._id, date.value) });
  } catch (err) {
    next(err);
  }
});

// POST /api/day-tasks  { date, title }   date: "YYYY-MM-DD" or null for backlog
router.post('/', async (req, res, next) => {
  try {
    const body = req.body || {};

    const date = readDay(body.date);
    if (date.error) return badRequest(res, date.error);

    const title = readTitle(body.title);
    if (title.error) return badRequest(res, title.error);

    const task = await store.create(req.user._id, { date: date.value, title: title.value });
    res.status(201).json({ data: task });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/day-tasks/:id  { title?, status? }
// Where a task sits is a move, not a field edit - see PATCH /:id/move.
router.patch('/:id', async (req, res, next) => {
  try {
    const { title, status } = req.body || {};
    const patch = {};

    if (title !== undefined) {
      const parsed = readTitle(title);
      if (parsed.error) return badRequest(res, parsed.error);
      patch.title = parsed.value;
    }

    if (status !== undefined) {
      if (!STATUSES.includes(status)) {
        return badRequest(res, `status must be one of: ${STATUSES.join(', ')}`);
      }
      patch.status = status;
    }

    if (!Object.keys(patch).length) return badRequest(res, 'Nothing to update');

    // A backlog task has no status to change: it has not started, because there
    // is no day it could have started on. Narrowing the filter keeps the common
    // case a single query - the extra lookup below only runs when it fails.
    const filter = patch.status !== undefined ? { date: { $ne: null } } : {};
    const task = await store.update(req.user._id, req.params.id, patch, filter);

    if (!task) {
      if (patch.status !== undefined && (await store.get(req.user._id, req.params.id))) {
        return badRequest(res, 'A backlog task has no status until it is on a day');
      }
      return res.status(404).json({ error: 'No such task' });
    }

    res.json({ data: task });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/day-tasks/:id/move  { date, index? }
// Drag and drop: onto a day, back to the backlog (date null), or to another
// position in the list it is already in.
router.patch('/:id/move', async (req, res, next) => {
  try {
    const body = req.body || {};

    const date = readDay(body.date);
    if (date.error) return badRequest(res, date.error);

    if (body.index !== undefined && body.index !== null) {
      if (!Number.isInteger(body.index) || body.index < 0) {
        return badRequest(res, 'index must be a whole number, 0 or more');
      }
    }

    const result = await store.move(req.user._id, req.params.id, {
      date: date.value,
      index: body.index,
    });

    if (result.error === 'notfound') return res.status(404).json({ error: 'No such task' });
    if (result.error === 'started') {
      return badRequest(res, 'Only a to-do task can go back to the backlog');
    }

    res.json({ data: result.data });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/day-tasks/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const task = await store.remove(req.user._id, req.params.id);
    if (!task) return res.status(404).json({ error: 'No such task' });

    res.json({ message: 'Task deleted', data: task });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
