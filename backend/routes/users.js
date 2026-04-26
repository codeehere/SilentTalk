const express = require('express');
const multer = require('multer');
const path = require('path');
const User = require('../models/User');
const { protect } = require('../middleware/authMiddleware');
const { uploadToCloudinary } = require('../utils/cloudinary');

const router = express.Router();

// Avatar upload — use Cloudinary
const avatarMemStorage = multer.memoryStorage();
const uploadAvatar = multer({
  storage: avatarMemStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB for HD photos
  fileFilter: (req, file, cb) => {
    ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)
      ? cb(null, true) : cb(new Error('Images only'));
  }
});

// GET /api/users/search?q=
router.get('/search', protect, async (req, res) => {
  try {
    const { q } = req.query;
    const cleanQ = q.trim().replace(/^@/, '');
    if (cleanQ.length < 2) return res.status(400).json({ message: 'Query too short' });

    const me = await User.findById(req.user._id).select('blockedUsers');
    const blocked = me.blockedUsers || [];

    const users = await User.find({
      $or: [
        { uniqueId: { $regex: cleanQ, $options: 'i' } },
        { username: { $regex: cleanQ, $options: 'i' } }
      ],
      _id: { $ne: req.user._id, $nin: blocked }
    }).select('uniqueId username avatar bio isOnline lastSeen publicKey isBusiness').limit(20);

    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/users/profile/:id
router.get('/profile/:id', protect, async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('_id username avatar email uniqueId bio isOnline lastSeen publicKey settings isBusiness businessProfile');
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Respect lastSeenVisible setting
    const data = user.toObject();
    if (!user.settings?.lastSeenVisible) {
      data.lastSeen = null;
    }
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

const Message = require('../models/Message');

// GET /api/users/contacts
router.get('/contacts', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('contacts', 'uniqueId username avatar bio isOnline lastSeen publicKey isBusiness')
      .populate('pendingContacts', 'uniqueId username avatar bio isOnline lastSeen publicKey isBusiness');
      
    // Calculate unreads
    const contactsWithUnread = await Promise.all(user.contacts.map(async (c) => {
      const unreadCount = await Message.countDocuments({ 
        senderId: c._id, 
        receiverId: req.user._id, 
        status: { $ne: 'read' },
        deletedFor: { $ne: req.user._id }
      });
      return { ...c.toObject(), unreadCount };
    }));
      
    res.json({ 
      contacts: contactsWithUnread, 
      pendingContacts: user.pendingContacts,
      pinnedChats: user.pinnedChats || [],
      lockedChats: user.lockedChats || [],
      archivedChats: user.archivedChats || []
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/users/blocked — list blocked users
router.get('/blocked', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('blockedUsers', 'uniqueId username avatar');
    res.json({ blockedUsers: user.blockedUsers || [] });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/users/contacts/:id — add contact
router.post('/contacts/:id', protect, async (req, res) => {
  try {
    if (req.params.id === req.user._id.toString()) {
      return res.status(400).json({ message: 'Cannot add yourself' });
    }
    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ message: 'User not found' });

    await User.findByIdAndUpdate(req.user._id, {
      $addToSet: { contacts: target._id }
    });
    if (!target.contacts.includes(req.user._id)) {
      await User.findByIdAndUpdate(target._id, {
        $addToSet: { pendingContacts: req.user._id }
      });
    }
    res.json({ message: 'Contact added', user: { _id: target._id, username: target.username, avatar: target.avatar, uniqueId: target.uniqueId } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/users/contacts/:id
router.delete('/contacts/:id', protect, async (req, res) => {
  try {
    const { bothSides } = req.query;
    await User.findByIdAndUpdate(req.user._id, {
      $pull: { contacts: req.params.id, pendingContacts: req.params.id }
    });
    if (bothSides === 'true') {
      await User.findByIdAndUpdate(req.params.id, {
        $pull: { contacts: req.user._id, pendingContacts: req.user._id }
      });
    }
    res.json({ message: 'Contact removed' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/users/contacts/:id/accept
router.post('/contacts/:id/accept', protect, async (req, res) => {
  try {
    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ message: 'User not found' });
    await User.findByIdAndUpdate(req.user._id, {
      $pull: { pendingContacts: target._id },
      $addToSet: { contacts: target._id }
    });
    await User.findByIdAndUpdate(target._id, {
      $addToSet: { contacts: req.user._id }
    });
    res.json({ message: 'Request accepted', user: { _id: target._id, username: target.username, avatar: target.avatar, uniqueId: target.uniqueId } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/users/contacts/:id/decline
router.post('/contacts/:id/decline', protect, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user._id, {
      $pull: { pendingContacts: req.params.id }
    });
    res.json({ message: 'Request declined' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/users/block/:id — block a user
router.post('/block/:id', protect, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user._id, {
      $addToSet: { blockedUsers: req.params.id },
      $pull: { contacts: req.params.id, pendingContacts: req.params.id }
    });
    res.json({ message: 'User blocked' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/users/unblock/:id — unblock a user
router.post('/unblock/:id', protect, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user._id, {
      $pull: { blockedUsers: req.params.id },
      $addToSet: { contacts: req.params.id }
    });
    res.json({ message: 'User unblocked' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/users/:id/publicKey
router.get('/:id/publicKey', protect, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('publicKey username');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ publicKey: user.publicKey, username: user.username });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/users/avatar — upload avatar via Cloudinary
router.post('/avatar', protect, uploadAvatar.single('avatar'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    const { url } = await uploadToCloudinary(req.file.buffer, 'avatars', 'image');
    await User.findByIdAndUpdate(req.user._id, { avatar: url });
    
    // Broadcast avatar update to all connected clients natively
    const io = req.app.get('io');
    if (io) {
      io.emit('user:profile_updated', { userId: req.user._id, avatar: url });
    }

    res.json({ avatarUrl: url });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/users/wallpaper — get current user's wallpaper map
router.get('/wallpaper', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('chatWallpapers');
    const wallpapers = {};
    if (user.chatWallpapers) {
      user.chatWallpapers.forEach((value, key) => { wallpapers[key] = value; });
    }
    res.json({ wallpapers });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/users/wallpaper — set per-chat or global wallpaper
router.post('/wallpaper', protect, async (req, res) => {
  try {
    const { contactId, imageUrl } = req.body;
    const key = contactId || 'global';
    await User.findByIdAndUpdate(req.user._id, {
      [`chatWallpapers.${key}`]: imageUrl || ''
    });
    res.json({ message: 'Wallpaper updated', key, imageUrl });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/users/nicknames — get all nicknames set by the current user
router.get('/nicknames', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('contactNicknames');
    const nicknames = {};
    if (user.contactNicknames) {
      user.contactNicknames.forEach((value, key) => { nicknames[key] = value; });
    }
    res.json({ nicknames });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/users/nickname/:contactId — set or clear a nickname for a contact
router.put('/nickname/:contactId', protect, async (req, res) => {
  try {
    const { nickname } = req.body; // empty string = clear
    await User.findByIdAndUpdate(req.user._id, {
      [`contactNicknames.${req.params.contactId}`]: nickname || ''
    });
    res.json({ message: 'Nickname saved', contactId: req.params.contactId, nickname: nickname || '' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Helper for toggling string array fields (pin, lock, archive)
const toggleUserArrayField = async (userId, field, targetId) => {
  const user = await User.findById(userId).select(field);
  const arr = user[field] || [];
  const exists = arr.includes(targetId);
  const update = exists ? { $pull: { [field]: targetId } } : { $addToSet: { [field]: targetId } };
  return User.findByIdAndUpdate(userId, update, { new: true }).select(field);
};

// PUT /api/users/pin/:id — toggle pin chat
router.put('/pin/:id', protect, async (req, res) => {
  try {
    const user = await toggleUserArrayField(req.user._id, 'pinnedChats', req.params.id);
    res.json({ pinnedChats: user.pinnedChats });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// PUT /api/users/lock/:id — toggle lock chat
router.put('/lock/:id', protect, async (req, res) => {
  try {
    const user = await toggleUserArrayField(req.user._id, 'lockedChats', req.params.id);
    res.json({ lockedChats: user.lockedChats });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// PUT /api/users/archive/:id — toggle archive chat
router.put('/archive/:id', protect, async (req, res) => {
  try {
    const user = await toggleUserArrayField(req.user._id, 'archivedChats', req.params.id);
    res.json({ archivedChats: user.archivedChats });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// ─── Privacy PIN Routes ──────────────────────────────────────────────────────

// PUT /api/users/privacy-pin — set or update 4-digit PIN
router.put('/privacy-pin', protect, async (req, res) => {
  try {
    const { pin } = req.body;
    if (!pin || pin.length !== 4 || isNaN(pin)) {
      return res.status(400).json({ message: 'Must be a 4-digit numeric PIN' });
    }
    const user = await User.findById(req.user._id);
    user.privacyPin = pin;
    await user.save();
    res.json({ message: 'Privacy PIN saved successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/users/verify-pin — verify PIN for unlocking chats
router.post('/verify-pin', protect, async (req, res) => {
  try {
    const { pin } = req.body;
    if (!pin) return res.status(400).json({ message: 'PIN required' });
    
    // Explicitly select privacyPin for comparison
    const user = await User.findById(req.user._id).select('+privacyPin');
    
    if (!user.privacyPin) {
      // Auto-set the PIN if this is their first time locking something!
      user.privacyPin = pin;
      await user.save();
      return res.json({ message: 'Success' });
    }

    const isMatch = await user.comparePin(pin);
    if (!isMatch) return res.status(401).json({ message: 'Incorrect PIN' });

    res.json({ message: 'Success' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
