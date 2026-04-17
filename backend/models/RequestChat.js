const mongoose = require('mongoose');
const crypto = require('crypto');

const requestChatSchema = new mongoose.Schema({
  requesterId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  targetId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  // Duration in minutes the requester wants to grant
  accessDuration: {
    type: Number,
    required: true,
    min: 1,
    max: 1440 // max 24 hours
  },
  message: { type: String, default: '', maxlength: 300 },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'denied', 'revoked', 'expired'],
    default: 'pending'
  },
  // Hashed version of the shadow JWT token stored so we can revoke it
  shadowTokenHash: { type: String, select: false },
  grantedAt: { type: Date },
  expiresAt: { type: Date }
}, { timestamps: true });

requestChatSchema.index({ requesterId: 1, targetId: 1 });
requestChatSchema.index({ expiresAt: 1 });

const RequestChat = mongoose.model('RequestChat', requestChatSchema);
module.exports = RequestChat;
