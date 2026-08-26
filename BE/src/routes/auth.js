const express = require('express');

const authService = require('../services/auth');
const users = require('../store/users');
const { validateRegistration } = require('../utils/validate');
const { requireAuth } = require('../middleware/auth');
const { rateLimit } = require('../middleware/rateLimit');

const router = express.Router();

// PIN-only login is the weakest entry point: the PIN is the whole credential,
// so it gets a tighter limit than the email + password route.
const pinLimiter = rateLimit({
  windowMs: 15 * 60_000,
  max: 5,
  message: 'Too many PIN attempts, try again later',
});

const loginLimiter = rateLimit({ windowMs: 15 * 60_000, max: 20 });

// A public URL means anyone who finds it can open an account, and every
// account can spend the Gemini quota. When SIGNUP_CODE is set, registration
// needs it; with the variable unset - local development - sign-up stays open.
const SIGNUP_CODE = process.env.SIGNUP_CODE || '';

// Sign-up had no limit at all, which also made the invite code guessable at
// whatever rate the network allowed.
const registerLimiter = rateLimit({
  windowMs: 60 * 60_000,
  max: 5,
  message: 'Too many sign-up attempts, try again later',
});

// POST /api/auth/register  { username, email, password, pin, signupCode? }
router.post('/register', registerLimiter, async (req, res, next) => {
  try {
    const { username, email, password, pin, signupCode } = req.body || {};

    if (SIGNUP_CODE && String(signupCode || '') !== SIGNUP_CODE) {
      return res.status(403).json({ error: 'That invite code is not right' });
    }

    const errors = validateRegistration({ username, email, password, pin });
    if (errors.length) {
      return res.status(400).json({ error: 'Validation failed', details: errors });
    }

    const result = await authService.register({ username, email, password, pin });
    res.status(201).json({ message: 'Account created', ...result });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/login
// Accepts either { email, password } or { pin }.
router.post('/login', loginLimiter, async (req, res, next) => {
  try {
    const { email, password, pin } = req.body || {};

    if (pin !== undefined) {
      return pinLimiter(req, res, async () => {
        try {
          const result = await authService.loginWithPin({ pin });
          res.json({ message: 'Logged in with PIN', ...result });
        } catch (err) {
          next(err);
        }
      });
    }

    if (email !== undefined || password !== undefined) {
      if (!email || !password) {
        return res.status(400).json({ error: 'Both email and password are required' });
      }

      const result = await authService.loginWithPassword({ email, password });
      return res.json({ message: 'Logged in', ...result });
    }

    res.status(400).json({ error: 'Provide either a pin, or an email and password' });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/me - example of a protected route
router.get('/me', requireAuth, (req, res) => {
  res.json({ data: users.toPublic(req.user) });
});

module.exports = router;
