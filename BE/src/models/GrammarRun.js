const { mongoose } = require('../db/connect');

// One past correction: what went in, what came back, and how it was asked for.
const grammarRunSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    input: { type: String, required: true },
    output: { type: String, required: true },

    // The instruction chips and free text that were in effect for this run.
    instructions: { type: [String], default: [] },
    format: { type: String, default: 'plain' },
    model: { type: String, default: '' },
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

// History is always read newest first.
grammarRunSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('GrammarRun', grammarRunSchema);
