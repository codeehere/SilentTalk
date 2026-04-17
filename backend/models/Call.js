const mongoose = require('mongoose');

const callSchema = new mongoose.Schema({
  caller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  receiver: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  callType: { type: String, enum: ['audio', 'video'], required: true },
  status: { type: String, enum: ['completed', 'missed', 'rejected', 'ongoing'], default: 'ongoing' },
  duration: { type: Number, default: 0 }, // in seconds
}, { timestamps: true });

module.exports = mongoose.model('Call', callSchema);
