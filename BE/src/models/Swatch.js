const { mongoose } = require('../db/connect');

const NAME_MAX = 40;

// A saved colour. Stored as a lowercase 6-digit hex so two spellings of the
// same colour (#FFF and #ffffff) cannot both end up in one palette.
const swatchSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    hex: { type: String, required: true, match: /^#[0-9a-f]{6}$/ },
    name: { type: String, trim: true, maxlength: NAME_MAX, default: '' },
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

// The same colour twice in one palette is a confusing no-op.
swatchSchema.index({ user: 1, hex: 1 }, { unique: true });
swatchSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('Swatch', swatchSchema);
module.exports.NAME_MAX = NAME_MAX;
