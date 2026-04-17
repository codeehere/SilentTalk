const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const RequestChat = require('../models/RequestChat');

// In-memory blacklist for revoked tokens (use Redis in production)
const tokenBlacklist = new Set();

const protect = async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }
  if (!token) {
    return res.status(401).json({ message: 'Not authorized — no token' });
  }
  if (tokenBlacklist.has(token)) {
    return res.status(401).json({ message: 'Token has been revoked' });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-otp -otpExpires -refreshToken -shadowTokenHash');
    if (!user) {
      return res.status(401).json({ message: 'User no longer exists' });
    }
    req.user = user;
    req.token = token;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Not authorized — token invalid' });
  }
};

// Shadow JWT middleware for Request-Chat access
const requestChatAccess = async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Shadow')) {
    token = req.headers.authorization.split(' ')[1];
  }
  if (!token) {
    return res.status(401).json({ message: 'No shadow token provided' });
  }
  if (tokenBlacklist.has(token)) {
    return res.status(403).json({ message: 'Shadow access has been revoked' });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SHADOW_SECRET || process.env.JWT_SECRET);
    if (decoded.type !== 'shadow') {
      return res.status(403).json({ message: 'Invalid access type' });
    }
    // Verify the RequestChat record is still valid
    const request = await RequestChat.findById(decoded.requestId).select('+shadowTokenHash');
    if (!request || request.status !== 'accepted') {
      return res.status(403).json({ message: 'Access grant no longer valid' });
    }
    if (request.expiresAt < new Date()) {
      request.status = 'expired';
      await request.save();
      return res.status(403).json({ message: 'Shadow access has expired' });
    }
    // Verify token hash matches stored hash
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    if (tokenHash !== request.shadowTokenHash) {
      return res.status(403).json({ message: 'Token mismatch' });
    }
    req.shadowAccess = { requesterId: decoded.requesterId, requestId: decoded.requestId };
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Shadow token invalid or expired' });
  }
};

const blacklistToken = (token) => tokenBlacklist.add(token);

module.exports = { protect, requestChatAccess, blacklistToken };
