const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const Call = require('../models/Call');
const router = express.Router();

// GET /api/calls
router.get('/', protect, async (req, res) => {
  try {
    const calls = await Call.find({
      $or: [{ caller: req.user._id }, { receiver: req.user._id }]
    })
      .populate('caller', 'username avatar uniqueId')
      .populate('receiver', 'username avatar uniqueId')
      .sort({ createdAt: -1 })
      .limit(50);
    res.json(calls);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/calls
router.post('/', protect, async (req, res) => {
  try {
    const { receiverId, callType } = req.body;
    const call = await Call.create({ caller: req.user._id, receiver: receiverId, callType });
    res.status(201).json(call);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH /api/calls/:id
router.patch('/:id', protect, async (req, res) => {
  try {
    const { status, duration } = req.body;
    const call = await Call.findByIdAndUpdate(req.params.id, { status, duration }, { new: true });
    res.json(call);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
