const { mongoose } = require('../db/connect');

const TEXT_MAX = 200;

// A saved instruction chip. Seeded from config/prompts.js the first time a user
// opens the tool, and theirs to add to or remove after that.
const grammarPresetSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, required: true, trim: true, maxlength: TEXT_MAX },
    order: { type: Number, required: true },
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        delete ret.user;
        return ret;
      },
    },
  }
);

// The same chip twice would be a confusing no-op, so one text per user.
grammarPresetSchema.index({ user: 1, text: 1 }, { unique: true });
grammarPresetSchema.index({ user: 1, order: 1 });

module.exports = mongoose.model('GrammarPreset', grammarPresetSchema);
module.exports.TEXT_MAX = TEXT_MAX;
