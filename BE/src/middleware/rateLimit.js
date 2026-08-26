// Fixed-window rate limiting, keyed by client IP.
//
// Two stores, same behaviour. A long-running server counts in memory, which is
// exact and free. A serverless deployment cannot: requests are spread over many
// short-lived instances that share nothing, so an in-memory counter would give
// each instance its own private allowance and the limit would mean very little.
// There the count lives in MongoDB, which every instance already talks to.
const { mongoose } = require('../db/connect');

const COLLECTION = 'ratelimits';

// Vercel sets VERCEL on every deployment. RATE_LIMIT_STORE overrides it either
// way, which is what makes both paths testable on one machine.
function useSharedStore() {
  const override = process.env.RATE_LIMIT_STORE;
  if (override) return override === 'mongo';
  return Boolean(process.env.VERCEL);
}

function memoryStore() {
  const hits = new Map();

  // Drop expired buckets so the map does not grow without bound.
  const sweeper = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits) {
      if (entry.resetAt <= now) hits.delete(key);
    }
  }, 60_000);
  sweeper.unref();

  return async function hit(key, windowMs) {
    const now = Date.now();
    let entry = hits.get(key);

    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(key, entry);
    }

    entry.count += 1;
    return { count: entry.count, resetAt: entry.resetAt };
  };
}

function mongoStore() {
  let indexReady = null;

  async function collection() {
    const col = mongoose.connection.collection(COLLECTION);

    // A TTL index lets MongoDB clear expired buckets, so nothing here needs a
    // sweeper. Created once per process; a repeat with the same definition is
    // a no-op, and a failure is forgotten so a later request can try again.
    if (!indexReady) {
      indexReady = col.createIndex({ resetAt: 1 }, { expireAfterSeconds: 0 }).catch((err) => {
        indexReady = null;
        throw err;
      });
    }

    await indexReady;
    return col;
  }

  return async function hit(key, windowMs) {
    const now = new Date();
    const col = await collection();

    // One atomic round trip. The pipeline form of update lets the reset
    // decision happen inside the database, so two instances incrementing the
    // same bucket at the same moment cannot both decide to start a new window.
    const result = await col.findOneAndUpdate(
      { _id: key },
      [
        {
          $set: {
            count: {
              $cond: [{ $gt: ['$resetAt', now] }, { $add: ['$count', 1] }, 1],
            },
            resetAt: {
              $cond: [
                { $gt: ['$resetAt', now] },
                '$resetAt',
                new Date(now.getTime() + windowMs),
              ],
            },
          },
        },
      ],
      { upsert: true, returnDocument: 'after' }
    );

    // Driver 6 returns the document; older drivers wrap it in { value }.
    const doc = result && result.value !== undefined ? result.value : result;
    return { count: doc.count, resetAt: doc.resetAt.getTime() };
  };
}

// One shared store for every limiter, so they all reuse the same index check.
let shared = null;

function storeFor() {
  if (!useSharedStore()) return memoryStore();
  if (!shared) shared = mongoStore();
  return shared;
}

/**
 * @param {string} name  Namespaces the bucket. Two limiters on the same IP must
 *                       not share a counter - the PIN route allows 5 attempts
 *                       and the login route 20, and with a shared store they
 *                       would otherwise be counting into the same document.
 */
function rateLimit({ name, windowMs = 60_000, max = 10, message = 'Too many requests' } = {}) {
  if (!name) throw new Error('rateLimit needs a name to namespace its bucket');

  const hit = storeFor();

  return function limiter(req, res, next) {
    hit(`${name}:${req.ip}`, windowMs)
      .then(({ count, resetAt }) => {
        if (count <= max) return next();

        const retryAfter = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
        res.set('Retry-After', String(retryAfter));
        res.status(429).json({ error: message, retryAfter });
      })
      .catch((err) => {
        // Fail open. Every limited route needs the database anyway - to look up
        // the user, or to read the account being logged into - so a store that
        // cannot be reached is about to fail the request on its own merits.
        // Refusing here would only turn a clear error into a misleading 429.
        console.error('[rateLimit] store unavailable, allowing request:', err.message);
        next();
      });
  };
}

module.exports = { rateLimit };
