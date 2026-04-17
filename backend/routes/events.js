const express = require('express');
const { body, validationResult } = require('express-validator');
const Event = require('../models/Event');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/', protect, async (req, res) => {
  try {
    const events = await Event.find({
      $or: [
        { organizer: req.user._id },
        { 'participants.userId': req.user._id }
      ]
    })
      .populate('organizer', 'username avatar')
      .populate('participants.userId', 'username avatar')
      .sort({ date: 1 });
    res.json(events);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', protect, [
  body('title').trim().notEmpty().isLength({ max: 200 }),
  body('date').isISO8601()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  try {
    const { title, description, date, endDate, location, groupId, participantIds, color, alarmAt, completion } = req.body;
    const participants = [{ userId: req.user._id, rsvp: 'going' }];
    if (Array.isArray(participantIds)) {
      participantIds.forEach(id => {
        if (id !== req.user._id.toString()) participants.push({ userId: id });
      });
    }
    const event = await Event.create({
      title, description, date, endDate, location, groupId, participants,
      organizer: req.user._id,
      color: color || '#6366f1',
      alarmAt: alarmAt || null,
      completion: completion || 0
    });
    await event.populate('organizer', 'username avatar');
    res.status(201).json(event);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.patch('/:id', protect, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ message: 'Not found' });
    if (event.organizer.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only organizer can edit' });
    }
    const allowed = ['title', 'description', 'date', 'endDate', 'location', 'color', 'alarmAt', 'completion', 'attachments'];
    allowed.forEach(field => {
      if (req.body[field] !== undefined) event[field] = req.body[field];
    });
    await event.save();
    res.json(event);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/:id/rsvp', protect, async (req, res) => {
  try {
    const { rsvp } = req.body;
    const valid = ['going', 'not_going', 'maybe'];
    if (!valid.includes(rsvp)) return res.status(400).json({ message: 'Invalid RSVP' });
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ message: 'Not found' });
    const participant = event.participants.find(p => p.userId.toString() === req.user._id.toString());
    if (participant) {
      participant.rsvp = rsvp;
    } else {
      event.participants.push({ userId: req.user._id, rsvp });
    }
    await event.save();
    res.json(event);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/:id', protect, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ message: 'Not found' });
    if (event.organizer.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    await event.deleteOne();
    res.json({ message: 'Event deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
