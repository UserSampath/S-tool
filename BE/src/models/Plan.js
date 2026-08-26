const { mongoose } = require('../db/connect');

const HORIZONS = ['short', 'long'];

const PRIORITY_MIN = 0;
const PRIORITY_MAX = 10;

const planSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    // Short and long term plans are the same shape with different lifetimes,
    // so one collection serves both tools.
    horizon: { type: String, enum: HORIZONS, required: true },

    title: { type: String, required: true, trim: true, maxlength: 200 },
    done: { type: Boolean, default: false },

    priority: {
      type: Number,
      default: 5,
      min: PRIORITY_MIN,
      max: PRIORITY_MAX,
      validate: {
        validator: Number.isInteger,
        message: 'priority must be a whole number',
      },
    },

    // Manual position within its horizon. Priority is deliberately separate:
    // dragging a row must not be undone by a priority edit, so order is the
    // one thing that decides how the list reads.
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

// Every query is "this user's plans for this horizon, in order".
planSchema.index({ user: 1, horizon: 1, order: 1 });

module.exports = mongoose.model('Plan', planSchema);
module.exports.HORIZONS = HORIZONS;
module.exports.PRIORITY_MIN = PRIORITY_MIN;
module.exports.PRIORITY_MAX = PRIORITY_MAX;
