const express = require('express');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { protect, blacklistToken } = require('../middleware/authMiddleware');

const router = express.Router();

const generateAccessToken  = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '15m' });
const generateRefreshToken = (id) => jwt.sign({ id }, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET, { expiresIn: '30d' });

// Helper — get device info
const getClientInfo = async (req) => {
  const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress || 'Unknown IP';
  const ua = req.headers['user-agent'] || 'Unknown Browser';
  
  let location = 'Local Network / Unknown';
  if (ip && ip !== '::1' && ip !== '127.0.0.1' && !ip.startsWith('192.168.')) {
    try {
      const geo = await fetch(`http://ip-api.com/json/${ip}`).then(r => r.json());
      if (geo.status === 'success') location = `${geo.city}, ${geo.country}`;
    } catch (e) {}
  }
  
  let os = 'Unknown OS';
  if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Mac OS')) os = 'macOS';
  else if (ua.includes('Linux')) os = 'Linux';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iOS') || ua.includes('iPhone')) os = 'iOS';
  
  let browser = 'Unknown App';
  if (ua.includes('Chrome')) browser = 'Chrome';
  else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari';
  else if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Edge')) browser = 'Edge';

  return { ipAddress: ip, os, browser, location };
};

// Helper — build public user payload
const publicUser = (user, token, refreshToken, sessionId) => ({
  _id: user._id,
  email: user.email,
  uniqueId: user.uniqueId,
  username: user.username,
  avatar: user.avatar,
  publicKey: user.publicKey,
  settings: user.settings,
  isBusiness: user.isBusiness,
  businessProfile: user.businessProfile,
  token,
  refreshToken,
  sessionId
});

// ── POST /api/auth/register ──────────────────────────────────────────────────
router.post('/register', [
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password')
    .isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
    .isLength({ max: 128 }).withMessage('Password too long')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const { email, password } = req.body;

    const existing = await User.findOne({ email });
    if (existing) return res.status(409).json({ message: 'An account with this email already exists.' });

    const user = await User.create({
      email,
      password,
      uniqueId: uuidv4().split('-')[0].toUpperCase()
    });

    const accessToken  = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);
    user.refreshToken  = refreshToken;
    
    if (!user.sessions) user.sessions = [];
    const info = await getClientInfo(req);
    user.sessions.push({ ...info, token: refreshToken, isPrimary: true });
    
    await user.save();

    const sessionId = user.sessions[user.sessions.length - 1]._id;
    return res.status(201).json(publicUser(user, accessToken, refreshToken, sessionId));
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ message: 'Server error. Please try again.' });
  }
});

// ── POST /api/auth/login ─────────────────────────────────────────────────────
router.post('/login', [
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+password');
    if (!user) return res.status(401).json({ message: 'Invalid email or password.' });
    if (!user.password) return res.status(401).json({ message: 'This account was created with OTP. Please use the password reset flow.' });

    const match = await user.comparePassword(password);
    if (!match) return res.status(401).json({ message: 'Invalid email or password.' });

    user.isOnline = true;
    const accessToken  = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);
    user.refreshToken  = refreshToken;
    
    if (!user.sessions) user.sessions = [];
    const info = await getClientInfo(req);
    const isPrimary = user.sessions.length === 0;
    user.sessions.push({ ...info, token: refreshToken, isPrimary });
    
    await user.save();

    const sessionId = user.sessions[user.sessions.length - 1]._id;
    return res.json(publicUser(user, accessToken, refreshToken, sessionId));
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Server error. Please try again.' });
  }
});

// ── POST /api/auth/refresh ────────────────────────────────────────────────────
router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(401).json({ message: 'No refresh token' });

  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET);
    const user    = await User.findById(decoded.id).select('+refreshToken');
    if (!user) return res.status(401).json({ message: 'User not found' });

    const matches = await user.compareRefreshToken(refreshToken);
    if (!matches) return res.status(401).json({ message: 'Refresh token invalid' });

    const newAccess  = generateAccessToken(user._id);
    const newRefresh = generateRefreshToken(user._id);
    user.refreshToken = newRefresh;
    
    // Update the specific session token
    let currentSessionId = null;
    if (user.sessions) {
      const activeSession = user.sessions.find(s => s.token === refreshToken);
      if (activeSession) {
        activeSession.token = newRefresh;
        activeSession.lastActive = new Date();
        currentSessionId = activeSession._id;
      }
    }
    
    await user.save();

    res.json({ token: newAccess, refreshToken: newRefresh, sessionId: currentSessionId });
  } catch {
    res.status(401).json({ message: 'Refresh token expired or invalid' });
  }
});

// ── POST /api/auth/logout ─────────────────────────────────────────────────────
router.post('/logout', protect, (req, res) => {
  blacklistToken(req.token);
  res.json({ message: 'Logged out successfully' });
});

// ── PATCH /api/auth/me — update profile ──────────────────────────────────────
router.patch('/me', protect, [
  body('username').optional().trim().isLength({ max: 50 }),
  body('bio').optional().trim().isLength({ max: 200 }),
  body('publicKey').optional().isString()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const { username, bio, publicKey, settings } = req.body;
    const update = {};
    if (username  !== undefined) update.username  = username;
    if (bio       !== undefined) update.bio       = bio;
    if (publicKey !== undefined) update.publicKey = publicKey;
    if (settings)                update.settings  = { ...req.user.settings, ...settings };

    const user = await User.findByIdAndUpdate(req.user._id, update, { new: true, runValidators: true });
    res.json({ user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── GET /api/auth/sessions ──────────────────────────────────────────────────
router.get('/sessions', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const sessions = (user.sessions || []).map(s => ({
      id: s._id,
      ipAddress: s.ipAddress,
      os: s.os,
      browser: s.browser,
      location: s.location,
      isPrimary: s.isPrimary,
      lastActive: s.lastActive,
      createdAt: s.createdAt
    }));
    res.json({ sessions });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ── DELETE /api/auth/sessions/:id ───────────────────────────────────────────
router.delete('/sessions/:id', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const session = user.sessions.id(req.params.id);
    if (!session) return res.status(404).json({ message: 'Session not found' });
    if (session.isPrimary) return res.status(403).json({ message: 'Primary device cannot be logged out remotely.' });
    
    user.sessions.pull(req.params.id);
    await user.save();
    res.json({ message: 'Device logged out' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
