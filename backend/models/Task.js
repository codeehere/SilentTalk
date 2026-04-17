const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 200 },
  description: { type: String, default: '', maxlength: 5000 },
  dueDate: { type: Date },
  alarmAt: { type: Date },          // alarm date/time
  completion: { type: Number, default: 0, min: 0, max: 100 }, // 0-100%
  priority: { type: String, enum: ['low', 'medium', 'high', 'urgent'], default: 'medium' },
  status: { type: String, enum: ['todo', 'inprogress', 'done'], default: 'todo' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  assignedTo: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  groupId: { type: mongoose.Schema.Types.ObjectId, ref: 'Group' },
  tags: [{ type: String, maxlength: 30 }],
  // Rich content attachments stored as URLs (uploaded via existing /api/messages/upload)
  attachments: [{ type: String }],
  voiceNote: { type: String }  // URL to audio file
}, { timestamps: true });

taskSchema.index({ createdBy: 1 });
taskSchema.index({ groupId: 1 });
taskSchema.index({ assignedTo: 1 });
taskSchema.index({ alarmAt: 1 });

const Task = mongoose.model('Task', taskSchema);
module.exports = Task;
