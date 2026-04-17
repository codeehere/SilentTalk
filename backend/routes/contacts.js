const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const User = require('../models/User');
const Message = require('../models/Message');

const router = express.Router();

// Search user by exact uniqueId
// GET /api/contacts/search?id=xyz
router.get('/search', protect, async (req, res) => {
  try {
    const { id } = req.query;

    if (!id) {
      return res.status(400).json({ message: 'A uniqueId to search is required' });
    }

    const user = await User.findOne({ uniqueId: id }).select('username uniqueId isOnline lastSeen avatar');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Add contact
// POST /api/contacts/add
router.post('/add', protect, async (req, res) => {
  try {
    const { contactId } = req.body;

    if (!contactId) {
      return res.status(400).json({ message: 'Contact uniqueId is required' });
    }

    const contactUser = await User.findOne({ uniqueId: contactId });
    
    if (!contactUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Prevent adding self
    if (contactUser._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: 'You cannot add yourself' });
    }

    if (req.user.contacts.includes(contactUser._id)) {
      return res.status(400).json({ message: 'User is already in your contacts' });
    }

    req.user.contacts.push(contactUser._id);
    await req.user.save();

    res.json({ message: 'Contact added successfully', contact: { username: contactUser.username, uniqueId: contactUser.uniqueId, _id: contactUser._id }});
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get user's contacts
// GET /api/contacts
router.get('/', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate('contacts', 'username uniqueId isOnline lastSeen avatar');
    
    // Calculate unread counts dynamically
    const contactsWithUnread = await Promise.all(user.contacts.map(async (c) => {
      const unreadCount = await Message.countDocuments({ 
        senderId: c._id, 
        receiverId: req.user._id, 
        status: { $ne: 'read' } 
      });
      return { ...c.toObject(), unreadCount };
    }));
    
    res.json(contactsWithUnread);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
