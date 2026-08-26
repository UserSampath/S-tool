const { verify } = require('../utils/token');
const users = require('../store/users');

// Rejects the request unless a valid bearer token is present.
// On success attaches the user to req.user.
async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Missing or malformed Authorization header' });
  }

  let payload;
  try {
    payload = verify(token);
  } catch (err) {
    const expired = err.name === 'TokenExpiredError';
    return res.status(401).json({ error: expired ? 'Token expired' : 'Invalid token' });
  }

  let user;
  try {
    user = await users.findById(payload.sub);
  } catch (err) {
    return next(err);
  }

  if (!user) {
    return res.status(401).json({ error: 'User no longer exists' });
  }

  req.user = user;
  next();
}

module.exports = { requireAuth };
