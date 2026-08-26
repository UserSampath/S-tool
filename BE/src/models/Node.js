const { mongoose } = require('../db/connect');

const KINDS = ['folder', 'note'];
const TITLE_MAX = 120;

// Folders and notes are the same kind of thing to the tree - both have a
// parent, both sit in an order, both can be dragged - so they share one
// collection. Splitting them would mean two queries and two id spaces for
// every move.
const nodeSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    kind: { type: String, enum: KINDS, required: true },

    title: { type: String, required: true, trim: true, maxlength: TITLE_MAX },

    // null means the node sits at the root of the tree.
    parent: { type: mongoose.Schema.Types.ObjectId, ref: 'Node', default: null },

    // Position among its siblings. Only meaningful within one parent.
    order: { type: Number, required: true },

    // Notes only. Sanitised html, never raw input - see utils/richText.js.
    content: { type: String, default: '' },

    // Folders only. Persisted so the shape of the tree survives a reload.
    collapsed: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        ret.id = ret._id.toString();
        ret.parent = ret.parent ? ret.parent.toString() : null;
        delete ret._id;
        delete ret.__v;
        delete ret.user;
        return ret;
      },
    },
  }
);

// Every read is "this user's tree", and every move re-sorts one parent.
nodeSchema.index({ user: 1, parent: 1, order: 1 });

module.exports = mongoose.model('Node', nodeSchema);
module.exports.KINDS = KINDS;
module.exports.TITLE_MAX = TITLE_MAX;
