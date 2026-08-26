const { mongoose } = require('../db/connect');

const TEXT_MAX = 2000;

// A quick note is one piece of text and nothing else. The Notepad tool already
// covers folders, rich text and structure; this one exists to be fast, so it
// deliberately has no title, no folder and no formatting to decide about.
const quickNoteSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, required: true, trim: true, maxlength: TEXT_MAX },
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

// Always read newest first.
quickNoteSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('QuickNote', quickNoteSchema);
module.exports.TEXT_MAX = TEXT_MAX;
