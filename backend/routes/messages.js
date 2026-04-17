const express = require('express');
const { body, query, validationResult } = require('express-validator');
const multer = require('multer');
const Message = require('../models/Message');
const User = require('../models/User');
const { protect } = require('../middleware/authMiddleware');
const { uploadToCloudinary } = require('../utils/cloudinary');
const mongoose = require('mongoose');

const router = express.Router();
const Group = require('../models/Group');

// Memory storage for file uploads (Cloudinary handles persistence)
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB cap (was 50MB)
  fileFilter: (req, file, cb) => {
    const allowed = [
      'image/jpeg','image/png','image/webp','image/gif',
      'video/mp4','video/webm',
      'audio/webm','audio/ogg','audio/mpeg','audio/mp4','audio/wav',
      'application/pdf',
      'text/plain'
      // NOTE: zip removed — too common a vector for malware delivery
    ];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('File type not allowed'));
  }
});

// ── POST /api/messages/upload — upload media to Cloudinary ──────────────────
router.post('/upload', protect, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file provided' });

    let folder = 'media';
    let resourceType = 'auto';

    if (req.file.mimetype.startsWith('audio')) {
      folder = 'audio';
      resourceType = 'auto'; // Support audio/webm format naturally
    } else if (req.file.mimetype.startsWith('video')) {
      folder = 'media';
      resourceType = 'video';
    } else if (req.file.mimetype.startsWith('image')) {
      folder = 'media';
      resourceType = 'image';
    } else {
      folder = 'files';
      resourceType = 'raw';
    }

    const { url, publicId } = await uploadToCloudinary(req.file.buffer, folder, resourceType);

    // Derive mediaType
    let mediaType = 'file';
    if (req.file.mimetype.startsWith('image')) mediaType = 'image';
    else if (req.file.mimetype.startsWith('video')) mediaType = 'video';
    else if (req.file.mimetype.startsWith('audio')) mediaType = 'audio';

    res.json({ url, publicId, mediaType, originalName: req.file.originalname, size: req.file.size });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ message: err.message });
  }
});

// GET /api/messages/:contactId — paginated messages for a 1-1 conversation
router.get('/:contactId', protect, async (req, res) => {
  try {
    const { contactId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 40, 100);
    const skip = (page - 1) * limit;

    if (!mongoose.Types.ObjectId.isValid(contactId)) {
      return res.status(400).json({ message: 'Invalid contact ID' });
    }
    const myId = req.user._id;

    const messages = await Message.find({
      $or: [
        { senderId: myId, receiverId: contactId },
        { senderId: contactId, receiverId: myId }
      ],
      deletedFor: { $ne: myId }
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('senderId', 'username avatar uniqueId')
      .populate('replyTo', 'ciphertext nonce senderId text mediaUrl mediaType');

    // Mark as delivered
    await Message.updateMany(
      { senderId: contactId, receiverId: myId, status: 'sent' },
      { status: 'delivered' }
    );

    res.json(messages.reverse());
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/messages/group/:groupId — group messages (membership-checked)
router.get('/group/:groupId', protect, async (req, res) => {
  try {
    const { groupId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 40, 100);
    const skip = (page - 1) * limit;

    if (!mongoose.Types.ObjectId.isValid(groupId)) {
      return res.status(400).json({ message: 'Invalid group ID' });
    }

    // Security: verify requester is actually a member of the group
    const group = await Group.findOne({ _id: groupId, members: req.user._id }).lean();
    if (!group) {
      return res.status(403).json({ message: 'You are not a member of this group' });
    }

    const messages = await Message.find({
      groupId,
      deletedFor: { $ne: req.user._id }
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('senderId', 'username avatar uniqueId')
      .populate('replyTo', 'ciphertext nonce senderId text mediaUrl mediaType');

    res.json(messages.reverse());
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', protect, [
  body('ciphertext').optional({ checkFalsy: false }),
  body('nonce').optional({ checkFalsy: false }),
  body('receiverId').optional().isMongoId(),
  body('groupId').optional().isMongoId()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const { text, ciphertext, nonce, receiverId, groupId, mediaUrl, mediaType, replyTo } = req.body;

    if (!receiverId && !groupId) {
      return res.status(400).json({ message: 'receiverId or groupId required' });
    }

    const msg = await Message.create({
      senderId: req.user._id,
      receiverId: receiverId || undefined,
      groupId: groupId || undefined,
      ciphertext,
      nonce,
      text: text || '',
      mediaUrl: mediaUrl || '',
      mediaType: mediaType || '',
      replyTo: replyTo || undefined
    });

    await msg.populate('senderId', 'username avatar uniqueId');
    await msg.populate('replyTo', 'ciphertext nonce senderId text mediaUrl mediaType');
    res.status(201).json(msg);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/messages/:id
router.delete('/:id', protect, async (req, res) => {
  try {
    const { deleteForEveryone } = req.body;
    const msg = await Message.findById(req.params.id);
    if (!msg) return res.status(404).json({ message: 'Message not found' });

    const isOwner = msg.senderId.toString() === req.user._id.toString();

    if (deleteForEveryone && isOwner) {
      msg.deletedForEveryone = true;
      msg.ciphertext = '';
      msg.nonce = '';
      msg.mediaUrl = '';
      msg.mediaType = '';
    } else {
      if (!msg.deletedFor.includes(req.user._id)) {
        msg.deletedFor.push(req.user._id);
      }
    }
    await msg.save();
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/messages/:id/react
router.post('/:id/react', protect, [
  body('emoji').notEmpty().isLength({ max: 10 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const { emoji } = req.body;
    const msg = await Message.findById(req.params.id);
    if (!msg) return res.status(404).json({ message: 'Message not found' });

    const existing = msg.reactions.find(r => r.userId.toString() === req.user._id.toString());
    if (existing) {
      if (existing.emoji === emoji) {
        msg.reactions = msg.reactions.filter(r => r.userId.toString() !== req.user._id.toString());
      } else {
        existing.emoji = emoji;
      }
    } else {
      msg.reactions.push({ userId: req.user._id, emoji });
    }
    await msg.save();
    res.json(msg.reactions);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH /api/messages/:id/read
router.patch('/:id/read', protect, async (req, res) => {
  try {
    await Message.updateMany(
      { _id: req.params.id, receiverId: req.user._id },
      { status: 'read' }
    );
    res.json({ message: 'Marked as read' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
