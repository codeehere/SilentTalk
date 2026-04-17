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
  username: {
    type: String,
    default: '',
    trim: true,
    maxlength: 50
  },
  bio: {
    type: String,
    default: '',
    maxlength: 200
  },
  avatar: {
    type: String,
    default: ''
  },
  // NaCl Curve25519 public key (hex string) for E2EE
  publicKey: {
    type: String,
    default: ''
  },
  otp: { type: String, select: false },
  otpExpires: { type: Date, select: false },
  otpAttempts: { type: Number, default: 0, select: false },
  otpLockedUntil: { type: Date, select: false },
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
  // chatWallpapers: keyed by contact._id string or "global"
  chatWallpapers: {
    type: Map,
    of: String,
    default: {}
  },
  // contactNicknames: private aliases the user sets for their contacts
  contactNicknames: {
    type: Map,
    of: String,
    default: {}
  },
  // pinnedChats: array of contact/group _id strings
  pinnedChats: [{ type: String, default: [] }],
  // lockedChats: array of contact _id strings
  lockedChats: [{ type: String, default: [] }],
  // archivedChats: array of contact _id strings
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

// Hash OTP and Privacy PIN before saving
userSchema.pre('save', async function() {
  if (this.isModified('otp') && this.otp) {
    this.otp = await bcrypt.hash(this.otp, 10);
  }
  if (this.isModified('refreshToken') && this.refreshToken) {
    this.refreshToken = await bcrypt.hash(this.refreshToken, 10);
  }
  if (this.isModified('privacyPin') && this.privacyPin) {
    this.privacyPin = await bcrypt.hash(this.privacyPin, 10);
  }
});

userSchema.methods.compareOtp = async function(candidateOtp) {
  return bcrypt.compare(candidateOtp, this.otp);
};

userSchema.methods.compareRefreshToken = async function(token) {
  return bcrypt.compare(token, this.refreshToken);
};

userSchema.methods.comparePin = async function(candidatePin) {
  return bcrypt.compare(candidatePin, this.privacyPin);
};

// Indexes
userSchema.index({ uniqueId: 1 });
userSchema.index({ email: 1 });

const User = mongoose.model('User', userSchema);
module.exports = User;
