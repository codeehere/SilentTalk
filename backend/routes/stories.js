const express = require('express');
const multer = require('multer');
const { body, validationResult } = require('express-validator');
const Story = require('../models/Story');
const User = require('../models/User');
const { protect } = require('../middleware/authMiddleware');
const { uploadToCloudinary } = require('../utils/cloudinary');

const router = express.Router();

// Memory storage — persisted via Cloudinary (disk storage breaks on Railway)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm'];
    allowed.includes(file.mimetype) ? cb(null, true) : cb(new Error('Invalid file type'));
  }
});

// GET /api/stories — stories from contacts
router.get('/', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const friendIds = [...user.contacts, req.user._id];
    const stories = await Story.find({
      userId: { $in: friendIds },
      expiresAt: { $gt: new Date() }
    })
      .populate('userId', 'username avatar uniqueId')
      .sort({ createdAt: -1 });
    res.json(stories);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/stories — upload a story
router.post('/', protect, upload.single('media'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Media file required' });
    const mediaType = req.file.mimetype.startsWith('video') ? 'video' : 'image';
    const resourceType = mediaType === 'video' ? 'video' : 'image';
    const { url } = await uploadToCloudinary(req.file.buffer, 'stories', resourceType);
    const story = await Story.create({
      userId: req.user._id,
      mediaUrl: url,
      mediaType,
      caption: req.body.caption || ''
    });
    await story.populate('userId', 'username avatar uniqueId');
    res.status(201).json(story);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/stories/:id/view — mark as viewed
router.post('/:id/view', protect, async (req, res) => {
  try {
    const story = await Story.findById(req.params.id);
    if (!story) return res.status(404).json({ message: 'Story not found' });
    const alreadyViewed = story.viewers.some(v => v.userId.toString() === req.user._id.toString());
    if (!alreadyViewed) {
      story.viewers.push({ userId: req.user._id });
      await story.save();
    }
    res.json({ viewers: story.viewers.length });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/stories/:id — delete own story
router.delete('/:id', protect, async (req, res) => {
  try {
    const story = await Story.findById(req.params.id);
    if (!story) return res.status(404).json({ message: 'Not found' });
    if (story.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    await story.deleteOne();
    res.json({ message: 'Story deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
