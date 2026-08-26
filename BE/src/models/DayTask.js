const { mongoose } = require('../db/connect');

const STATUSES = ['todo', 'doing', 'done'];
const TITLE_MAX = 200;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const dayTaskSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    // A calendar day as the user sees it, not an instant in time. Stored as
    // YYYY-MM-DD because a Date would be an absolute moment: a task added at
    // 11pm would land on the next or previous day depending on the timezone
    // the server happened to be in.
    //
    // null is the product backlog: work that is real but not yet promised to a
    // day. It is a date the user has not chosen, which is exactly what null
    // means, so the backlog needs no separate collection or flag.
    date: {
      type: String,
      default: null,
      validate: {
        validator: (value) => value === null || DATE_RE.test(value),
        message: 'date must be YYYY-MM-DD, or null for the backlog',
      },
    },

    title: { type: String, required: true, trim: true, maxlength: TITLE_MAX },
    status: { type: String, enum: STATUSES, default: 'todo' },

    // Position within its day - or within the backlog. Tasks are added one by
    // one, so new ones append, and a drag rewrites the destination list.
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

// Every read is "this user's tasks for this day, in order", a range scan for
// the calendar indicators, or the same lookup with date: null for the backlog.
dayTaskSchema.index({ user: 1, date: 1, order: 1 });

module.exports = mongoose.model('DayTask', dayTaskSchema);
module.exports.STATUSES = STATUSES;
module.exports.TITLE_MAX = TITLE_MAX;
module.exports.DATE_RE = DATE_RE;
