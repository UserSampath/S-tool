const express = require('express');

const store = require('../store/quickNotes');
const { TEXT_MAX } = require('../models/QuickNote');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);

function readText(value) {
  const text = String(value ?? '').trim();

  if (!text) return { error: 'Write something first' };
  if (text.length > TEXT_MAX) return { error: `A note must be ${TEXT_MAX} characters or fewer` };

  return { value: text };
}

// GET /api/quick-notes - newest first.
router.get('/', async (req, res, next) => {
  try {
    res.json({ data: await store.listFor(req.user._id) });
  } catch (err) {
    next(err);
  }
});

// POST /api/quick-notes  { text }
router.post('/', async (req, res, next) => {
  try {
    const text = readText((req.body || {}).text);
    if (text.error) return res.status(400).json({ error: text.error });

    res.status(201).json({ data: await store.create(req.user._id, text.value) });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/quick-notes/:id  { text }
router.patch('/:id', async (req, res, next) => {
  try {
    const text = readText((req.body || {}).text);
    if (text.error) return res.status(400).json({ error: text.error });

    const note = await store.update(req.user._id, req.params.id, text.value);
    if (!note) return res.status(404).json({ error: 'No such note' });

    res.json({ data: note });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/quick-notes/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const note = await store.remove(req.user._id, req.params.id);
    if (!note) return res.status(404).json({ error: 'No such note' });

    res.json({ message: 'Note deleted', data: note });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
