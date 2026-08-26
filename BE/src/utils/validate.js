const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_RE = /^[a-zA-Z0-9_]{3,30}$/;
const PIN_RE = /^\d{4}$/;

// Returns an array of error strings; empty means the payload is valid.
function validateRegistration({ username, email, password, pin }) {
  const errors = [];

  if (!username || !USERNAME_RE.test(username)) {
    errors.push('username must be 3-30 characters, letters, numbers or underscore');
  }

  if (!email || !EMAIL_RE.test(email)) {
    errors.push('email must be a valid email address');
  }

  if (!password || password.length < 8) {
    errors.push('password must be at least 8 characters');
  }

  if (!pin || !PIN_RE.test(String(pin))) {
    errors.push('pin must be exactly 4 digits');
  }

  return errors;
}

module.exports = { validateRegistration, EMAIL_RE, PIN_RE };
