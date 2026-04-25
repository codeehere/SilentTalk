const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, 'Invalid email format']
  },
  uniqueId: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  username: { type: String, default: '', trim: true, maxlength: 50 },
  bio: { type: String, default: '', maxlength: 200 },
  avatar: { type: String, default: '' },
  // NaCl Curve25519 public key (hex string) for E2EE
  publicKey: { type: String, default: '' },

  // ── Password auth (active) ─────────────────────────────────────────────
  password: { type: String, select: false },

  // ── OTP auth (commented out — will be re-enabled once SMTP is configured)
  // otp:           { type: String, select: false },
  // otpExpires:    { type: Date,   select: false },
  // otpAttempts:   { type: Number, default: 0, select: false },
  // otpLockedUntil:{ type: Date,   select: false },

  // Hashed refresh token for rotation
  refreshToken: { type: String, select: false },

  isOnline: { type: Boolean, default: false },
  lastSeen: { type: Date, default: Date.now },
  contacts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  pendingContacts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  blockedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  settings: {
    theme: { type: String, enum: ['dark', 'light', 'cosmic', 'ocean'], default: 'dark' },
    notifications: { type: Boolean, default: true },
    readReceipts: { type: Boolean, default: true },
    lastSeenVisible: { type: Boolean, default: true }
  },
  chatWallpapers: { type: Map, of: String, default: {} },
  contactNicknames: { type: Map, of: String, default: {} },
  pinnedChats: [{ type: String, default: [] }],
  lockedChats: [{ type: String, default: [] }],
  archivedChats: [{ type: String, default: [] }],
  isBusiness: { type: Boolean, default: false },
  businessProfile: {
    businessName: { type: String, maxlength: 100, default: '' },
    ownerName: { type: String, maxlength: 100, default: '' },
    storeStatus: { type: String, enum: ['open', 'closed'], default: 'closed' },
    policies: { type: String, maxlength: 2000, default: '' },
    description: { type: String, maxlength: 1000, default: '' },
    logo: { type: String, default: '' },
    banner: { type: String, default: '' },
    storeType: { type: String, maxlength: 50, default: 'Retail' },
    contactEmail: { type: String, maxlength: 100, default: '' },
    contactPhone: { type: String, maxlength: 30, default: '' },
    acceptedPayments: { type: [String], default: ['Cash on Delivery'] }
  },
  privacyPin: { type: String, select: false }
}, { timestamps: true });

// ── Hooks ─────────────────────────────────────────────────────────────────────
userSchema.pre('save', async function () {
  if (this.isModified('password') && this.password) {
    this.password = await bcrypt.hash(this.password, 12);
  }
  if (this.isModified('refreshToken') && this.refreshToken) {
    this.refreshToken = await bcrypt.hash(this.refreshToken, 10);
  }
  if (this.isModified('privacyPin') && this.privacyPin) {
    this.privacyPin = await bcrypt.hash(this.privacyPin, 10);
  }
});

// ── Methods ───────────────────────────────────────────────────────────────────
userSchema.methods.comparePassword = async function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.compareRefreshToken = async function (token) {
  return bcrypt.compare(token, this.refreshToken);
};

userSchema.methods.comparePin = async function (candidatePin) {
  return bcrypt.compare(candidatePin, this.privacyPin);
};

// ── Indexes ───────────────────────────────────────────────────────────────────
userSchema.index({ uniqueId: 1 });
userSchema.index({ email: 1 });

const User = mongoose.model('User', userSchema);
module.exports = User;
