const express = require('express');

const gemini = require('../services/gemini');
const store = require('../store/grammar');
const { TEXT_MAX: PRESET_MAX } = require('../models/GrammarPreset');
const { GRAMMAR_FORMATS, DEFAULT_FORMAT } = require('../config/prompts');
const { requireAuth } = require('../middleware/auth');
const { rateLimit } = require('../middleware/rateLimit');

const router = express.Router();

const TEXT_MAX = 12_000;
const INSTRUCTIONS_MAX = 500;
const MAX_INSTRUCTIONS = 12;
const HISTORY_LIMIT = 25;

// Signed in only. Reading history and chips is cheap; only the correction
// route spends Gemini quota, so only that one is rate limited.
router.use(requireAuth);

const limiter = rateLimit({
  name: 'grammar',
  windowMs: 15 * 60_000,
  max: 40,
  message: 'Too many grammar checks. Wait a few minutes and try again.',
});

function badRequest(res, message) {
  return res.status(400).json({ error: message });
}

/* ---------- formats ---------- */

// GET /api/grammar/formats - so the UI never hardcodes a list the server does
// not actually support.
router.get('/formats', (req, res) => {
  res.json({
    data: Object.entries(GRAMMAR_FORMATS).map(([id, entry]) => ({
      id,
      label: entry.label,
      extension: entry.extension,
    })),
    default: DEFAULT_FORMAT,
  });
});

/* ---------- instruction chips ---------- */

// GET /api/grammar/presets
router.get('/presets', async (req, res, next) => {
  try {
    res.json({ data: await store.listPresets(req.user._id) });
  } catch (err) {
    next(err);
  }
});

// POST /api/grammar/presets  { text }
router.post('/presets', async (req, res, next) => {
  try {
    const text = String((req.body || {}).text ?? '').trim();

    if (!text) return badRequest(res, 'Instruction text is required');
    if (text.length > PRESET_MAX) {
      return badRequest(res, `Instruction must be ${PRESET_MAX} characters or fewer`);
    }

    const preset = await store.createPreset(req.user._id, text);
    if (preset.duplicate) return res.status(409).json({ error: 'You already have that instruction' });

    res.status(201).json({ data: preset });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/grammar/presets/:id
router.delete('/presets/:id', async (req, res, next) => {
  try {
    const removed = await store.removePreset(req.user._id, req.params.id);
    if (!removed) return res.status(404).json({ error: 'No such instruction' });

    res.json({ message: 'Instruction removed', data: removed });
  } catch (err) {
    next(err);
  }
});

/* ---------- history ---------- */

// GET /api/grammar/history
router.get('/history', async (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit) || HISTORY_LIMIT, 100);
    res.json({ data: await store.listHistory(req.user._id, limit) });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/grammar/history - clears the lot. Declared before /history/:id.
router.delete('/history', async (req, res, next) => {
  try {
    res.json({ message: 'History cleared', removed: await store.clearHistory(req.user._id) });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/grammar/history/:id
router.delete('/history/:id', async (req, res, next) => {
  try {
    const removed = await store.removeRun(req.user._id, req.params.id);
    if (!removed) return res.status(404).json({ error: 'No such history entry' });

    res.json({ message: 'Entry removed', data: removed });
  } catch (err) {
    next(err);
  }
});

/* ---------- the correction itself ---------- */

// POST /api/grammar  { text, instructions?: string[], format? }
router.post('/', limiter, async (req, res, next) => {
  try {
    const { text, instructions, format } = req.body || {};

    const source = String(text ?? '').trim();
    if (!source) return badRequest(res, 'Enter some text to correct');
    if (source.length > TEXT_MAX) {
      return badRequest(res, `Text must be ${TEXT_MAX} characters or fewer`);
    }

    // Accepts a list of chips, or a single string for a one-off instruction.
    const list = (Array.isArray(instructions) ? instructions : [instructions])
      .map((entry) => String(entry ?? '').trim())
      .filter(Boolean);

    if (list.length > MAX_INSTRUCTIONS) {
      return badRequest(res, `Use at most ${MAX_INSTRUCTIONS} instructions at once`);
    }
    if (list.some((entry) => entry.length > INSTRUCTIONS_MAX)) {
      return badRequest(res, `Each instruction must be ${INSTRUCTIONS_MAX} characters or fewer`);
    }

    const chosen = format === undefined || format === null ? DEFAULT_FORMAT : String(format);
    if (!GRAMMAR_FORMATS[chosen]) {
      return badRequest(res, `format must be one of: ${Object.keys(GRAMMAR_FORMATS).join(', ')}`);
    }

    const result = await gemini.correct({ text: source, instructions: list, format: chosen });

    // Saved after the fact: a failed call is not worth remembering, and a
    // history write that fails should not lose the user their correction.
    let run = null;
    try {
      run = await store.recordRun(req.user._id, {
        input: source,
        output: result.text,
        instructions: list,
        format: chosen,
        model: result.model,
      });
    } catch (err) {
      console.error('[grammar] could not save history:', err.message);
    }

    res.json({ data: { ...result, id: run?.id ?? null, createdAt: run?.createdAt ?? new Date() } });
  } catch (err) {
    if (err instanceof gemini.GeminiError) {
      return res.status(err.status).json({ error: err.message });
    }
    next(err);
  }
});

module.exports = router;
