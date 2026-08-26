const { mongoose } = require('../db/connect');

const userSchema = new mongoose.Schema(
  {
    // Display casing is preserved; usernameLower carries the uniqueness rule so
    // "Nalaka" and "nalaka" cannot both be registered.
    username: { type: String, required: true, trim: true },
    usernameLower: { type: String, required: true, unique: true, index: true },

    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },

    passwordHash: { type: String, required: true },
    pinHash: { type: String, required: true },

    // Keyed HMAC of the PIN - see services/auth.js. Unique because PIN-only
    // login has nothing else to disambiguate two accounts by.
    pinLookup: { type: String, required: true, unique: true, index: true },
  },
  {
    timestamps: { createdAt: true, updatedAt: true },

    // Defence in depth: even if a raw document is handed to res.json, the
    // hashes and the blind index never leave the process.
    toJSON: {
      transform(doc, ret) {
        delete ret.passwordHash;
        delete ret.pinHash;
        delete ret.pinLookup;
        delete ret.usernameLower;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// mongoose supplies the `id` virtual (_id as a hex string), which is what the
// JWT subject and the public user shape both use.

module.exports = mongoose.model('User', userSchema);
