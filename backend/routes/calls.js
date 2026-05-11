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
    const call = await Call.findByIdAndUpdate(req.params.id, { status, duration }, { new: true })
      .populate('caller receiver');
    
    // Create system message for the call log
    const Message = require('../models/Message');
    const msgText = JSON.stringify({
      type: 'call_log',
      callType: call.callType,
      duration: duration || 0,
      status: status
    });
    
    const msg = await Message.create({
      senderId: call.caller._id,
      receiverId: call.receiver._id,
      text: msgText,
      mediaType: 'call_log',
      status: 'read',
      isSystemMsg: true
    });

    // Notify clients if possible
    const io = req.app.get('io');
    if (io) {
      const populatedMsg = await Message.findById(msg._id).populate('senderId', 'username avatar uniqueId');
      if (populatedMsg) {
        io.to(`user:${call.receiver._id.toString()}`).emit('message:receive', populatedMsg);
        io.to(`user:${call.caller._id.toString()}`).emit('message:receive', populatedMsg);
      }
    }

    res.json(call);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
