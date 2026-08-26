const mongoose = require('mongoose');

// Fail fast on a bad URI or an unreachable cluster instead of letting queries
// pile up in mongoose's buffer and time out one by one later.
mongoose.set('bufferCommands', false);
mongoose.set('strictQuery', true);

// Registered once at module load rather than inside connect(). A serverless
// deployment calls connect() on every request, and re-registering here would
// stack listeners on the same connection until Node warned about a leak.
mongoose.connection.on('error', (err) => console.error('[db] connection error:', err.message));
mongoose.connection.on('disconnected', () => console.warn('[db] disconnected'));

function uri() {
  const value = process.env.MONGODB_URI;

  if (!value) {
    throw new Error('MONGODB_URI must be set - copy .env.example to .env and fill it in');
  }

  if (value.includes('<db_username>') || value.includes('<db_password>')) {
    throw new Error('MONGODB_URI still contains a placeholder - put the real Atlas credentials in .env');
  }

  return value;
}

/*
 * One connection per process, shared by every request that process handles.
 *
 * A long-running server calls this once at boot. A serverless function calls it
 * on every invocation - the same warm container serves many - so the in-flight
 * promise is cached on globalThis, which outlives module state across
 * invocations. Caching the *promise* rather than the finished connection also
 * means two requests arriving together share one handshake instead of racing
 * into two.
 */
const cache = (globalThis.__myToolsMongo ??= { promise: null });

async function connect() {
  if (!cache.promise) {
    cache.promise = mongoose
      .connect(uri(), {
        serverSelectionTimeoutMS: 10_000,

        // Every serverless instance opens its own pool, and Atlas M0 allows 500
        // connections across the whole cluster. Keeping each pool small means a
        // burst of instances cannot exhaust it.
        maxPoolSize: 5,

        // Index builds are declared on the schemas; let mongoose create them on
        // connect so the unique constraints actually exist on a fresh database.
        autoIndex: true,
      })
      .then((m) => {
        // Logged here, not below: connect() is called per request on a
        // serverless platform, and only the real handshake is worth a line.
        console.log(`[db] connected to ${mongoose.connection.name}`);
        return m;
      })
      .catch((err) => {
        // A failed attempt must not stay cached, or the process would never
        // retry and every later request would fail for the same stale reason.
        cache.promise = null;
        throw err;
      });
  }

  await cache.promise;
  return mongoose.connection;
}

async function disconnect() {
  cache.promise = null;
  await mongoose.disconnect();
}

module.exports = { connect, disconnect, mongoose };
