const express = require('express');

const gemini = require('../services/gemini');
const { PR_OUTPUTS, PR_OUTPUT_IDS } = require('../config/prompts');
const { requireAuth } = require('../middleware/auth');
const { rateLimit } = require('../middleware/rateLimit');

const router = express.Router();

const DETAILS_MAX = 12_000;

router.use(requireAuth);

// Every call spends Gemini quota, same as the grammar helper.
const limiter = rateLimit({
  name: 'pr',
  windowMs: 15 * 60_000,
  max: 40,
  message: 'Too many generations. Wait a few minutes and try again.',
});

// GET /api/pr/outputs - the checkboxes, so the UI never offers something the
// server does not know how to produce.
router.get('/outputs', (req, res) => {
  res.json({
    data: PR_OUTPUT_IDS.map((id) => ({ id, label: PR_OUTPUTS[id].label })),
    // Everything is ticked to begin with; opening a PR usually needs all three.
    default: PR_OUTPUT_IDS,
  });
});

// POST /api/pr  { details, outputs: ['branch', 'commit', 'description'] }
router.post('/', limiter, async (req, res, next) => {
  try {
    const { details, outputs } = req.body || {};

    const source = String(details ?? '').trim();
    if (!source) return res.status(400).json({ error: 'Describe your changes first' });
    if (source.length > DETAILS_MAX) {
      return res.status(400).json({ error: `Details must be ${DETAILS_MAX} characters or fewer` });
    }

    // Default to everything, which is what the UI starts with.
    const wanted = outputs === undefined ? PR_OUTPUT_IDS : outputs;
    if (!Array.isArray(wanted)) {
      return res.status(400).json({ error: 'outputs must be an array' });
    }

    const chosen = PR_OUTPUT_IDS.filter((id) => wanted.includes(id));
    if (!chosen.length) {
      return res.status(400).json({ error: 'Choose at least one thing to generate' });
    }

    const result = await gemini.pullRequest({ details: source, outputs: chosen });
    res.json({ data: result });
  } catch (err) {
    if (err instanceof gemini.GeminiError) {
      return res.status(err.status).json({ error: err.message });
    }
    next(err);
  }
});

module.exports = router;
