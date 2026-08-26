const express = require('express');

const store = require('../store/swatches');
const { NAME_MAX } = require('../models/Swatch');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);

const HEX = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

// Normalises #ABC and #AABBCC to one lowercase 6-digit form, so the palette
// cannot hold the same colour under two spellings.
function readHex(value) {
  const raw = String(value ?? '').trim();
  if (!HEX.test(raw)) return { error: 'Give a colour as a hex value, e.g. #6d28d9' };

  let hex = raw.replace(/^#/, '').toLowerCase();
  if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');

  return { value: `#${hex}` };
}

// GET /api/swatches
router.get('/', async (req, res, next) => {
  try {
    res.json({ data: await store.listFor(req.user._id) });
  } catch (err) {
    next(err);
  }
});

// POST /api/swatches  { hex, name? }
router.post('/', async (req, res, next) => {
  try {
    const { hex, name } = req.body || {};

    const parsed = readHex(hex);
    if (parsed.error) return res.status(400).json({ error: parsed.error });

    const label = String(name ?? '').trim();
    if (label.length > NAME_MAX) {
      return res.status(400).json({ error: `Name must be ${NAME_MAX} characters or fewer` });
    }

    const swatch = await store.create(req.user._id, { hex: parsed.value, name: label });
    if (swatch.duplicate) {
      return res.status(409).json({ error: 'That colour is already in your palette' });
    }

    res.status(201).json({ data: swatch });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/swatches/:id  { name }
router.patch('/:id', async (req, res, next) => {
  try {
    const name = String((req.body || {}).name ?? '').trim();
    if (name.length > NAME_MAX) {
      return res.status(400).json({ error: `Name must be ${NAME_MAX} characters or fewer` });
    }

    const swatch = await store.rename(req.user._id, req.params.id, name);
    if (!swatch) return res.status(404).json({ error: 'No such colour' });

    res.json({ data: swatch });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/swatches/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const swatch = await store.remove(req.user._id, req.params.id);
    if (!swatch) return res.status(404).json({ error: 'No such colour' });

    res.json({ message: 'Colour removed', data: swatch });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
