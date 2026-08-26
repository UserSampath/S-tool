const { mongoose } = require('../db/connect');

const NAME_MAX = 120;

const projectSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    // A project is just its name for now.
    name: { type: String, required: true, trim: true, maxlength: NAME_MAX },

    // Pinned projects are pulled to the top of the list. There is no manual
    // ordering beyond that, so pinning is the only lever the user has.
    pinned: { type: Boolean, default: false },
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

// Every read is "this user's projects, pinned first, newest first".
projectSchema.index({ user: 1, pinned: -1, createdAt: -1 });

module.exports = mongoose.model('Project', projectSchema);
module.exports.NAME_MAX = NAME_MAX;
