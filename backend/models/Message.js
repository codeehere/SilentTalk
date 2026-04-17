const mongoose = require('mongoose');

const reactionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  emoji: { type: String, required: true, maxlength: 10 }
}, { _id: false });

const messageSchema = new mongoose.Schema({
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  receiverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  groupId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group',
    index: true
  },
  // E2E encrypted payload — server never knows plain text
  ciphertext: { type: String, default: '' },
  nonce: { type: String, default: '' },
  // Plaintext fallback / non-encrypted content
  text: { type: String, default: '' },
  // Optional media
  mediaUrl: { type: String, default: '' },
  mediaType: { type: String, enum: ['image', 'video', 'audio', 'file', 'event', 'task', 'contact', 'document', 'store', 'order_update', ''], default: '' },
  orderData: { type: String, default: '' }, // JSON: { orderId, status, productName, productImg, total, sellerName, saasLink, isDigital }
  // Message metadata
  status: {
    type: String,
    enum: ['sent', 'delivered', 'read'],
    default: 'sent'
  },
  reactions: [reactionSchema],
  replyTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Message' },
  deletedFor: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  deletedForEveryone: { type: Boolean, default: false },
  isSystemMsg: { type: Boolean, default: false }
}, { timestamps: true });

// Compound index for efficient conversation queries
messageSchema.index({ senderId: 1, receiverId: 1, createdAt: -1 });
messageSchema.index({ groupId: 1, createdAt: -1 });

const Message = mongoose.model('Message', messageSchema);
module.exports = Message;
