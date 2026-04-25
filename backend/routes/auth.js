const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const sendEmail = require('../utils/sendEmail');
const { protect, blacklistToken } = require('../middleware/authMiddleware');

const router = express.Router();

const hasMongo = () => mongoose.connection.readyState === 1;

const generateAccessToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '15m' });

const generateRefreshToken = (id) =>
  jwt.sign({ id }, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET, { expiresIn: '30d' });

const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

// POST /api/auth/login — request OTP
router.post('/login', [
  body('email').isEmail().normalizeEmail().withMessage('Valid email required')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const { email } = req.body;
    const otp = generateOTP();
    const otpExpires = new Date(Date.now() + 30 * 60 * 1000); // 30 min — accounts for Railway free-tier cold start delays

    let user = await User.findOne({ email }).select('+otp +otpExpires +otpAttempts +otpLockedUntil');
    if (user) {
      if (user.otpLockedUntil && user.otpLockedUntil > Date.now()) {
        const wait = Math.ceil((user.otpLockedUntil - Date.now()) / 60000);
        return res.status(429).json({ message: `Too many attempts. Try again in ${wait} minutes.` });
      }
      user.otp = otp;
      user.otpExpires = otpExpires;
      user.otpAttempts = 0;
      await user.save();
    } else {
      user = await User.create({ email, uniqueId: uuidv4().split('-')[0].toUpperCase(), otp, otpExpires });
    }

    const otpHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>SilentTalk Verification Code</title>
</head>
<body style="margin:0;padding:0;background:#0d0f14;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0d0f14;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#1a1d28;border-radius:20px;overflow:hidden;border:1px solid rgba(255,255,255,0.08);">
        
        <!-- Header Banner -->
        <tr>
          <td style="background:linear-gradient(135deg,#6d5be6,#8b6cf7);padding:36px 40px;text-align:center;">
            <div style="font-size:28px;font-weight:900;color:#fff;letter-spacing:2px;">ST</div>
            <div style="font-size:18px;font-weight:700;color:rgba(255,255,255,0.9);margin-top:8px;">SilentTalk</div>
            <div style="font-size:13px;color:rgba(255,255,255,0.65);margin-top:4px;">Encrypted Communications Platform</div>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:40px;">
            <h2 style="margin:0 0 8px;color:#f0f2ff;font-size:22px;font-weight:700;">Verify Your Identity</h2>
            <p style="margin:0 0 28px;color:#9ba3c0;font-size:14px;line-height:1.6;">Use the one-time code below to securely sign in to your SilentTalk account. This code expires in <strong style="color:#c2b9ff;">30 minutes</strong>.</p>

            <!-- OTP Box -->
            <div style="background:#13161e;border:2px solid #6d5be6;border-radius:14px;padding:28px;text-align:center;margin-bottom:28px;">
              <div style="font-size:44px;font-weight:900;letter-spacing:14px;color:#f0f2ff;font-family:'Courier New',monospace;">${otp}</div>
              <div style="font-size:12px;color:#5a6280;margin-top:10px;">One-Time Verification Code</div>
            </div>

            <!-- Warnings -->
            <div style="background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.3);border-radius:10px;padding:16px;margin-bottom:16px;">
              <div style="color:#f59e0b;font-weight:700;font-size:13px;margin-bottom:6px;">⚠️ Security Warning</div>
              <ul style="margin:0;padding:0 0 0 16px;color:#9ba3c0;font-size:13px;line-height:1.7;">
                <li>Never share this code with anyone, including SilentTalk support.</li>
                <li>SilentTalk will <strong>never</strong> ask for your OTP by phone or email.</li>
                <li>If you didn't request this code, ignore this email — your account is safe.</li>
              </ul>
            </div>

            <!-- Policies -->
            <div style="background:rgba(124,106,247,0.06);border:1px solid rgba(124,106,247,0.15);border-radius:10px;padding:16px;">
              <div style="color:#7c6af7;font-weight:700;font-size:13px;margin-bottom:6px;">📋 Platform Policies</div>
              <ul style="margin:0;padding:0 0 0 16px;color:#9ba3c0;font-size:12px;line-height:1.7;">
                <li>All messages are end-to-end encrypted. We cannot read your conversations.</li>
                <li>Your account is protected by OTP-only authentication — no passwords stored.</li>
                <li>By signing in, you agree to our <span style="color:#7c6af7;">Terms of Service</span> and <span style="color:#7c6af7;">Privacy Policy</span>.</li>
              </ul>
            </div>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#13161e;padding:20px 40px;border-top:1px solid rgba(255,255,255,0.06);text-align:center;">
            <div style="font-size:12px;color:#5a6280;line-height:1.6;">
              This email was sent to <strong style="color:#9ba3c0;">${email}</strong> because a sign-in was requested.<br/>
              If this wasn't you, no action is needed — your account remains secure.<br/><br/>
              <span style="color:#3a3f56;">© 2025 SilentTalk · End-to-End Encrypted · Privacy First</span>
            </div>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

    // Send OTP email — catch SMTP failures separately to give a better UX error
    try {
      await sendEmail({
        email,
        subject: '🔐 SilentTalk — Your Verification Code',
        message: `Your SilentTalk one-time code is: ${otp}\n\nThis code expires in 30 minutes. Never share it with anyone.`,
        html: otpHtml
      });
    } catch (emailErr) {
      console.error('[auth/login] Email delivery failed:', emailErr.message);
      // Don't expose SMTP internals — return a friendly message
      return res.status(503).json({ message: 'Could not send verification email. Please check your spam folder or try again shortly.' });
    }

    // Send only confirmation — OTP is in the email only
    const response = { message: 'Verification code sent', uniqueId: user.uniqueId };
    res.json(response);
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Server error. Please try again.' });
  }
});

// POST /api/auth/verify — verify OTP
router.post('/verify', [
  body('email').isEmail().normalizeEmail(),
  body('otp').isLength({ min: 6, max: 6 }).isNumeric()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const { email, otp } = req.body;
    const user = await User.findOne({ email }).select('+otp +otpExpires +otpAttempts +otpLockedUntil +refreshToken');
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.otpLockedUntil && user.otpLockedUntil > Date.now()) return res.status(429).json({ message: 'Account temporarily locked' });
    if (!user.otp) return res.status(400).json({ message: 'No OTP requested' });
    if (user.otpExpires < Date.now()) return res.status(400).json({ message: 'OTP has expired' });

    const isValid = await user.compareOtp(otp);
    if (!isValid) {
      user.otpAttempts = (user.otpAttempts || 0) + 1;
      if (user.otpAttempts >= 5) { user.otpLockedUntil = new Date(Date.now() + 30 * 60 * 1000); user.otpAttempts = 0; }
      await user.save();
      return res.status(400).json({ message: 'Invalid code' });
    }
    user.otp = undefined; user.otpExpires = undefined; user.otpAttempts = 0; user.otpLockedUntil = undefined; user.isOnline = true;
    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);
    user.refreshToken = refreshToken;
    await user.save();
    return res.json({ _id: user._id, email: user.email, uniqueId: user.uniqueId, username: user.username, avatar: user.avatar, publicKey: user.publicKey, settings: user.settings, isBusiness: user.isBusiness, businessProfile: user.businessProfile, token: accessToken, refreshToken });
  } catch (err) {
    console.error('Verify error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});


// POST /api/auth/refresh — refresh access token
router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(401).json({ message: 'No refresh token' });

  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('+refreshToken');
    if (!user) return res.status(401).json({ message: 'User not found' });

    const matches = await user.compareRefreshToken(refreshToken);
    if (!matches) return res.status(401).json({ message: 'Refresh token invalid' });

    const newAccess = generateAccessToken(user._id);
    const newRefresh = generateRefreshToken(user._id);
    user.refreshToken = newRefresh;
    await user.save();

    res.json({ token: newAccess, refreshToken: newRefresh });
  } catch (err) {
    res.status(401).json({ message: 'Refresh token expired or invalid' });
  }
});

// POST /api/auth/logout
router.post('/logout', protect, (req, res) => {
  blacklistToken(req.token);
  res.json({ message: 'Logged out successfully' });
});

// PATCH /api/auth/me — update profile
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
    if (username !== undefined) update.username = username;
    if (bio !== undefined) update.bio = bio;
    if (publicKey !== undefined) update.publicKey = publicKey;
    if (settings) update.settings = { ...req.user.settings, ...settings };

    const user = await User.findByIdAndUpdate(req.user._id, update, { new: true, runValidators: true });
    res.json({ user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
