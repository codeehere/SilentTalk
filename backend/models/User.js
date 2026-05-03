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

  // Active sessions tracking
  sessions: [{
    token: { type: String }, // Hashed refresh token
    ipAddress: { type: String, default: 'Unknown IP' },
    os: { type: String, default: 'Unknown OS' },
    browser: { type: String, default: 'Unknown Browser' },
    location: { type: String, default: 'Unknown Location' },
    isPrimary: { type: Boolean, default: false },
    lastActive: { type: Date, default: Date.now },
    createdAt: { type: Date, default: Date.now }
  }],
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
  
  // Hash any new session tokens
  if (this.sessions && this.sessions.length > 0) {
    for (let i = 0; i < this.sessions.length; i++) {
      if (this.isModified(`sessions.${i}.token`) && this.sessions[i].token) {
        // Only hash if it's not already a bcrypt hash (starts with $2)
        if (!this.sessions[i].token.startsWith('$2')) {
          this.sessions[i].token = await bcrypt.hash(this.sessions[i].token, 10);
        }
      }
    }
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

const User = mongoose.model('User', userSchema);
module.exports = User;
