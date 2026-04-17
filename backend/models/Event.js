const mongoose = require('mongoose');

const participantSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  rsvp: { type: String, enum: ['pending', 'going', 'not_going', 'maybe'], default: 'pending' }
}, { _id: false });

const eventSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 200 },
  description: { type: String, default: '', maxlength: 5000 },
  date: { type: Date, required: true },
  endDate: { type: Date },
  location: { type: String, default: '', maxlength: 300 },
  organizer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  groupId: { type: mongoose.Schema.Types.ObjectId, ref: 'Group' },
  participants: [participantSchema],
  color: { type: String, default: '#6366f1' },
  alarmAt: { type: Date },              // alarm reminder date/time
  completion: { type: Number, default: 0, min: 0, max: 100 }, // 0-100%
  attachments: [{ type: String }]       // rich attachment URLs
}, { timestamps: true });

eventSchema.index({ organizer: 1 });
eventSchema.index({ groupId: 1 });
eventSchema.index({ date: 1 });
eventSchema.index({ alarmAt: 1 });

const Event = mongoose.model('Event', eventSchema);
module.exports = Event;
