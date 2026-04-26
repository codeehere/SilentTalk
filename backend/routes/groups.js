const express = require('express');
const { body, validationResult } = require('express-validator');
const multer = require('multer');
const Group = require('../models/Group');
const { protect } = require('../middleware/authMiddleware');
const { uploadToCloudinary } = require('../utils/cloudinary');

const router = express.Router();

const avatarMemStorage = multer.memoryStorage();
const uploadAvatar = multer({
  storage: avatarMemStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)
      ? cb(null, true) : cb(new Error('Images only'));
  }
});

// GET /api/groups — list my groups
router.get('/', protect, async (req, res) => {
  try {
    const groups = await Group.find({ 'members.userId': req.user._id })
      .populate('members.userId', 'username avatar uniqueId isOnline')
      .populate('createdBy', 'username avatar');
    res.json(groups);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/groups — create group
router.post('/', protect, [
  body('name').trim().notEmpty().isLength({ max: 100 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  try {
    const { name, description, memberIds } = req.body;
    const members = [{ userId: req.user._id, role: 'owner' }];
    if (Array.isArray(memberIds)) {
      memberIds.forEach(id => {
        if (id !== req.user._id.toString()) members.push({ userId: id, role: 'member' });
      });
    }
    const group = await Group.create({ name, description, createdBy: req.user._id, members });
    await group.populate('members.userId', 'username avatar uniqueId');
    res.status(201).json(group);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/groups/:id
router.get('/:id', protect, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id)
      .populate('members.userId', 'username avatar uniqueId isOnline lastSeen');
    if (!group) return res.status(404).json({ message: 'Group not found' });
    const isMember = group.members.some(m => m.userId._id.toString() === req.user._id.toString());
    if (!isMember) return res.status(403).json({ message: 'Access denied' });
    res.json(group);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/groups/:id/members — add member
router.post('/:id/members', protect, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ message: 'Not found' });
    const me = group.members.find(m => m.userId.toString() === req.user._id.toString());
    if (!me || (me.role !== 'admin' && me.role !== 'owner')) {
      return res.status(403).json({ message: 'Only admins can add members' });
    }
    const { userId } = req.body;
    const alreadyIn = group.members.some(m => m.userId.toString() === userId);
    if (!alreadyIn) group.members.push({ userId, role: 'member' });
    await group.save();
    res.json(group);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/groups/:id/members/:userId — remove member
router.delete('/:id/members/:userId', protect, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ message: 'Not found' });
    const me = group.members.find(m => m.userId.toString() === req.user._id.toString());
    const isSelf = req.params.userId === req.user._id.toString();
    if (!isSelf && (!me || me.role === 'member')) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    group.members = group.members.filter(m => m.userId.toString() !== req.params.userId);
    await group.save();
    res.json({ message: 'Member removed' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH /api/groups/:id/members/:userId/role — promote/demote
router.patch('/:id/members/:userId/role', protect, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    const me = group.members.find(m => m.userId.toString() === req.user._id.toString());
    if (!me || me.role !== 'owner') return res.status(403).json({ message: 'Only owner can change roles' });
    const member = group.members.find(m => m.userId.toString() === req.params.userId);
    if (!member) return res.status(404).json({ message: 'Member not found' });
    member.role = req.body.role;
    await group.save();
    res.json(group);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/groups/:id — update group info
router.put('/:id', protect, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ message: 'Not found' });
    const me = group.members.find(m => m.userId.toString() === req.user._id.toString());
    if (!me || (me.role !== 'admin' && me.role !== 'owner')) {
      return res.status(403).json({ message: 'Only admins can edit info' });
    }
    const { name, description } = req.body;
    if (name) group.name = name;
    if (description !== undefined) group.description = description;
    await group.save();
    
    // Broadcast change
    const io = req.app.get('io');
    if (io) {
      io.to(`group:${group._id}`).emit('group:updated', { groupId: group._id, name: group.name, description: group.description });
    }
    res.json(group);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/groups/:id/avatar — upload group avatar
router.post('/:id/avatar', protect, uploadAvatar.single('avatar'), async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ message: 'Not found' });
    const me = group.members.find(m => m.userId.toString() === req.user._id.toString());
    if (!me || (me.role !== 'admin' && me.role !== 'owner')) {
      return res.status(403).json({ message: 'Only admins can change avatar' });
    }
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

    const { url } = await uploadToCloudinary(req.file.buffer, 'avatars', 'image');
    group.avatarUrl = url;
    await group.save();

    // Broadcast change
    const io = req.app.get('io');
    if (io) {
      io.to(`group:${group._id}`).emit('group:updated', { groupId: group._id, avatarUrl: url });
    }
    res.json({ avatarUrl: url });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/groups/:id — delete group (owner only)
router.delete('/:id', protect, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ message: 'Not found' });
    const me = group.members.find(m => m.userId.toString() === req.user._id.toString());
    if (!me || me.role !== 'owner') return res.status(403).json({ message: 'Only owner can delete' });
    await group.deleteOne();
    res.json({ message: 'Group deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
