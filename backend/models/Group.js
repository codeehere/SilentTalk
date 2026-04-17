const mongoose = require('mongoose');
const crypto = require('crypto');

const memberSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  role: { type: String, enum: ['member', 'admin', 'owner'], default: 'member' },
  joinedAt: { type: Date, default: Date.now }
}, { _id: false });

const groupSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  description: { type: String, default: '', maxlength: 500 },
  avatarUrl: { type: String, default: '' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  members: [memberSchema],
  inviteCode: {
    type: String,
    default: () => crypto.randomBytes(8).toString('hex'),
    unique: true
  },
  settings: {
    onlyAdminsCanMessage: { type: Boolean, default: false },
    onlyAdminsCanEditInfo: { type: Boolean, default: false }
  }
}, { timestamps: true });

groupSchema.index({ inviteCode: 1 });

const Group = mongoose.model('Group', groupSchema);
module.exports = Group;
