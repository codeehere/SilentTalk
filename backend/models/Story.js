const mongoose = require('mongoose');

const viewerSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  viewedAt: { type: Date, default: Date.now }
}, { _id: false });

const storySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  mediaUrl: { type: String, required: true },
  mediaType: { type: String, enum: ['image', 'video'], required: true },
  caption: { type: String, default: '', maxlength: 300 },
  viewers: [viewerSchema],
  privacy: { type: String, enum: ['contacts', 'all', 'private'], default: 'contacts' },
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 24 * 60 * 60 * 1000) // 24h
  }
}, { timestamps: true });

// MongoDB auto-deletes documents when expiresAt passes
storySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const Story = mongoose.model('Story', storySchema);
module.exports = Story;
