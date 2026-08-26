// Minimal in-memory fixed-window rate limiter, keyed by client IP.
// Good enough for a single process; use Redis (or a proxy-level limiter)
// once the app runs on more than one instance.
function rateLimit({ windowMs = 60_000, max = 10, message = 'Too many requests' } = {}) {
  const hits = new Map();

  // Drop expired buckets so the map does not grow without bound.
  const sweeper = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits) {
      if (entry.resetAt <= now) hits.delete(key);
    }
  }, windowMs);
  sweeper.unref();

  return function limiter(req, res, next) {
    const key = req.ip;
    const now = Date.now();
    let entry = hits.get(key);

    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(key, entry);
    }

    entry.count += 1;

    if (entry.count > max) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      res.set('Retry-After', String(retryAfter));
      return res.status(429).json({ error: message, retryAfter });
    }

    next();
  };
}

module.exports = { rateLimit };
