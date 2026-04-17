const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { body, validationResult } = require('express-validator');
const RequestChat = require('../models/RequestChat');
const { protect, blacklistToken } = require('../middleware/authMiddleware');

const router = express.Router();

// GET /api/request-chat — list all requests (sent & received)
router.get('/', protect, async (req, res) => {
  try {
    const requests = await RequestChat.find({
      $or: [{ requesterId: req.user._id }, { targetId: req.user._id }]
    })
      .populate('requesterId', 'username avatar uniqueId')
      .populate('targetId', 'username avatar uniqueId')
      .sort({ createdAt: -1 });
    res.json(requests);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/request-chat — create a new request
router.post('/', protect, [
  body('targetId').isMongoId(),
  body('accessDuration').isInt({ min: 1, max: 1440 }),
  body('message').optional().trim().isLength({ max: 300 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const { targetId, accessDuration, message } = req.body;

    if (targetId === req.user._id.toString()) {
      return res.status(400).json({ message: 'Cannot request chat with yourself' });
    }

    // Check for existing pending request
    const existing = await RequestChat.findOne({
      requesterId: req.user._id,
      targetId,
      status: 'pending'
    });
    if (existing) return res.status(409).json({ message: 'A pending request already exists' });

    const request = await RequestChat.create({
      requesterId: req.user._id,
      targetId,
      accessDuration,
      message: message || ''
    });

    await request.populate('requesterId targetId', 'username avatar uniqueId');
    res.status(201).json(request);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/request-chat/:id/accept — accept and issue shadow token
router.post('/:id/accept', protect, async (req, res) => {
  try {
    const request = await RequestChat.findById(req.params.id).select('+shadowTokenHash');
    if (!request) return res.status(404).json({ message: 'Request not found' });
    if (request.targetId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    if (request.status !== 'pending') {
      return res.status(400).json({ message: `Request is already ${request.status}` });
    }

    const grantedAt = new Date();
    const expiresAt = new Date(grantedAt.getTime() + request.accessDuration * 60 * 1000);

    // Issue shadow JWT
    const shadowToken = jwt.sign(
      {
        type: 'shadow',
        requestId: request._id,
        requesterId: request.requesterId,
        exp: Math.floor(expiresAt.getTime() / 1000)
      },
      process.env.JWT_SHADOW_SECRET || process.env.JWT_SECRET
    );

    // Hash and store the token
    const shadowTokenHash = crypto.createHash('sha256').update(shadowToken).digest('hex');

    request.status = 'accepted';
    request.grantedAt = grantedAt;
    request.expiresAt = expiresAt;
    request.shadowTokenHash = shadowTokenHash;
    await request.save();

    res.json({ shadowToken, expiresAt, request });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/request-chat/:id/deny
router.post('/:id/deny', protect, async (req, res) => {
  try {
    const request = await RequestChat.findById(req.params.id);
    if (!request) return res.status(404).json({ message: 'Not found' });
    if (request.targetId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    request.status = 'denied';
    await request.save();
    res.json({ message: 'Request denied' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/request-chat/:id/revoke — requester revokes access
router.post('/:id/revoke', protect, async (req, res) => {
  try {
    const request = await RequestChat.findById(req.params.id);
    if (!request) return res.status(404).json({ message: 'Not found' });
    if (request.requesterId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only the requester can revoke' });
    }
    if (request.status !== 'accepted') {
      return res.status(400).json({ message: 'Nothing to revoke' });
    }
    request.status = 'revoked';
    await request.save();
    res.json({ message: 'Access revoked immediately' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/request-chat/:id/messages — view shadow messages
router.get('/:id/messages', protect, async (req, res) => {
  try {
    const request = await RequestChat.findById(req.params.id);
    if (!request || request.status !== 'accepted') return res.status(403).json({ message: 'No valid access' });
    if (request.requesterId.toString() !== req.user._id.toString()) return res.status(403).json({ message: 'Unauthorized' });
    if (request.expiresAt < new Date()) {
      request.status = 'expired';
      await request.save();
      return res.status(403).json({ message: 'Access expired' });
    }
    
    const Message = require('../models/Message');
    const messages = await Message.find({
      $or: [{ senderId: request.targetId }, { receiverId: request.targetId }],
      deletedFor: { $ne: request.targetId }
    })
      .sort({ createdAt: -1 })
      .limit(150)
      .populate('senderId receiverId', 'username avatar uniqueId');
      
    res.json(messages.reverse());
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
