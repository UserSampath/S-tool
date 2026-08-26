const mongoose = require('mongoose');

// Fail fast on a bad URI or an unreachable cluster instead of letting queries
// pile up in mongoose's buffer and time out one by one later.
mongoose.set('bufferCommands', false);
mongoose.set('strictQuery', true);

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

async function connect() {
  mongoose.connection.on('error', (err) => console.error('[db] connection error:', err.message));
  mongoose.connection.on('disconnected', () => console.warn('[db] disconnected'));

  await mongoose.connect(uri(), {
    serverSelectionTimeoutMS: 10_000,
    // Index builds are declared on the schemas; let mongoose create them on
    // connect so the unique constraints actually exist on a fresh database.
    autoIndex: true,
  });

  console.log(`[db] connected to ${mongoose.connection.name}`);
  return mongoose.connection;
}

async function disconnect() {
  await mongoose.disconnect();
}

module.exports = { connect, disconnect, mongoose };
