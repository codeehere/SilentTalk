const express = require('express');
const { body, validationResult } = require('express-validator');
const Task = require('../models/Task');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/', protect, async (req, res) => {
  try {
    const tasks = await Task.find({
      $or: [
        { createdBy: req.user._id },
        { assignedTo: req.user._id }
      ]
    })
      .populate('createdBy', 'username avatar')
      .populate('assignedTo', 'username avatar uniqueId')
      .sort({ createdAt: -1 });
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', protect, [
  body('title').trim().notEmpty().isLength({ max: 200 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  try {
    const { title, description, dueDate, priority, assignedTo, groupId, tags, alarmAt, completion } = req.body;
    const task = await Task.create({
      title, description, dueDate, priority, groupId, tags,
      alarmAt: alarmAt || null,
      completion: completion || 0,
      createdBy: req.user._id,
      assignedTo: Array.isArray(assignedTo) ? assignedTo : []
    });
    await task.populate('createdBy assignedTo', 'username avatar uniqueId');
    res.status(201).json(task);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.patch('/:id', protect, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Not found' });
    const isCreator = task.createdBy.toString() === req.user._id.toString();
    const isAssignee = task.assignedTo.some(id => id.toString() === req.user._id.toString());
    if (!isCreator && !isAssignee) return res.status(403).json({ message: 'Not authorized' });

    const allowed = ['title', 'description', 'dueDate', 'priority', 'status', 'assignedTo', 'tags', 'alarmAt', 'completion', 'attachments', 'voiceNote'];
    allowed.forEach(f => { if (req.body[f] !== undefined) task[f] = req.body[f]; });
    await task.save();
    res.json(task);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/:id', protect, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Not found' });
    if (task.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only creator can delete' });
    }
    await task.deleteOne();
    res.json({ message: 'Task deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
