require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const { connectDB, isDBReady } = require('./db');
const Message = require('./models/Message');

// ─── App Setup ──────────────────────────────────────────────────────────────
const app = express();

// Trust proxy (needed for accurate rate-limit by IP behind load balancers/nginx)
app.set('trust proxy', 1);

// ── CORS origin allowlist ────────────────────────────────────────────────────
// Hardcoded production URL to ensure it works even if Railway env vars are missing
const defaultProductionOrigins = ['https://silent-talk-eosin.vercel.app'];

const customOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

let allowedOrigins = [...defaultProductionOrigins, ...customOrigins];

// Dev origins are ONLY added when explicitly running locally.
// We check if it's NOT production AND not running on Railway.
const isLocalDev = process.env.NODE_ENV !== 'production' && !process.env.RAILWAY_ENVIRONMENT;

if (isLocalDev) {
  allowedOrigins.push(
    'http://localhost:5173', 'http://localhost:5174',
    'http://127.0.0.1:5173', 'http://127.0.0.1:5174',
    'http://localhost:3000'
  );
}

console.log(`[CORS] Allowed origins:`, allowedOrigins);

// Security headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'blob:', 'https://res.cloudinary.com'],
      mediaSrc: ["'self'", 'blob:', 'https://res.cloudinary.com'],
      connectSrc: ["'self'", 'ws:', 'wss:', 'https://res.cloudinary.com'].concat(allowedOrigins),
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
    }
  }
}));

// CORS — strict origin check
app.use(cors({
  origin: (origin, callback) => {
    // Allow non-browser requests
    if (!origin) return callback(null, true);
    
    // Allow if explicitly in allowedOrigins
    if (allowedOrigins.includes(origin)) return callback(null, true);
    
    console.warn(`[CORS] Blocked origin: ${origin}`);
    callback(new Error(`CORS: origin '${origin}' not allowed`));
  },
  credentials: true
}));

app.use(express.json({ limit: '10mb' })); // 10 MB cap — prevent JSON bomb

// Basic rate limiting for standard endpoints
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: 'Too many requests, please try again later.'
});
app.use('/api', limiter);

// ─── Static uploads ─────────────────────────────────────────────────────────
// NOTE: Railway has an ephemeral filesystem — use Cloudinary for persistent media.
// This local dir is only used as a fallback for stories in dev.
const uploadsDir = path.join(__dirname, 'uploads');
try {
  ['stories', 'avatars', 'media'].forEach(d => {
    fs.mkdirSync(path.join(uploadsDir, d), { recursive: true });
  });
} catch (e) {
  console.warn('Could not create uploads dirs (ok on read-only FS):', e.message);
}
app.use('/uploads', express.static(uploadsDir));

// ─── Routes ──────────────────────────────────────────────────────────────────
app.use('/api/auth', require('./routes/auth'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/groups', require('./routes/groups'));
app.use('/api/stories', require('./routes/stories'));
app.use('/api/calls', require('./routes/calls'));
app.use('/api/events', require('./routes/events'));
app.use('/api/tasks', require('./routes/tasks'));
app.use('/api/request-chat', require('./routes/requestChat'));
app.use('/api/users', require('./routes/users'));
app.use('/api/contacts', require('./routes/contacts'));
app.use('/api/store', require('./routes/store'));
app.use('/api/orders', require('./routes/orders'));

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// 404 fallback
app.use((req, res) => res.status(404).json({ message: 'Route not found' }));

// Error handler — sanitize stack traces in production
app.use((err, req, res, next) => {
  const isDev = process.env.NODE_ENV !== 'production';
  const status = err.status || err.statusCode || 500;
  console.error(`[${new Date().toISOString()}] ${req.method} ${req.path} → ${status}:`, err.message);
  res.status(status).json({
    message: err.message || 'Internal Server Error',
    // Only expose stack in dev
    ...(isDev && status === 500 ? { stack: err.stack } : {})
  });
});

// ─── Socket.io ───────────────────────────────────────────────────────────────
// IMPORTANT: Never use `origin: true` here — that would allow any client
// (including a localhost dev build) to connect to the production Socket.IO
// server and send real-time messages to live users.
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,   // Always the explicit list — same as HTTP CORS
    methods: ['GET', 'POST'],
    credentials: true
  }
});
app.set('io', io);

// Socket authentication middleware
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('Authentication required'));
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.id;
    next();
  } catch {
    next(new Error('Invalid token'));
  }
});

// Track online users
const onlineUsers = new Map(); // userId -> socketId

const User = require('./models/User');

io.on('connection', async (socket) => {
  const userId = socket.userId;
  onlineUsers.set(userId.toString(), socket.id);

  // Join personal room
  socket.join(`user:${userId}`);

  // Update online status
  try {
    await User.findByIdAndUpdate(userId, { isOnline: true });
  } catch (e) {}

  // Broadcast presence to all connected users
  socket.broadcast.emit('user:online', { userId });

  // Join group rooms
  socket.on('join:groups', (groupIds) => {
    if (Array.isArray(groupIds)) {
      groupIds.forEach(gId => socket.join(`group:${gId}`));
    }
  });

  // ── Private message relay ────────────────────────────────────────────────
  socket.on('message:send', (data) => {
    // data: { receiverId, groupId, messageId, ciphertext, nonce, mediaUrl, mediaType, replyTo, tempId }
    if (data.receiverId) {
      io.to(`user:${data.receiverId}`).emit('message:receive', { ...data, senderId: userId });
      // Emit to sender's other devices!
      socket.to(`user:${userId}`).emit('message:receive', { ...data, senderId: userId });
    } else if (data.groupId) {
      socket.to(`group:${data.groupId}`).emit('message:receive', { ...data, senderId: userId });
    }
  });

  // ── Message ID confirmation (after DB save) ────────────────────────────
  // Lets the receiver replace their temp _id with the real DB messageId
  socket.on('message:confirm', ({ receiverId, groupId, tempId, messageId }) => {
    if (receiverId) {
      io.to(`user:${receiverId}`).emit('message:confirmed', { tempId, messageId, senderId: userId });
    } else if (groupId) {
      socket.to(`group:${groupId}`).emit('message:confirmed', { tempId, messageId, senderId: userId });
    }
  });

  // ── Message status ───────────────────────────────────────────────────────
  socket.on('message:delivered', async ({ senderId, messageId }) => {
    try {
      await Message.updateOne({ _id: messageId, status: 'sent' }, { status: 'delivered' });
      io.to(`user:${senderId}`).emit('message:status', { messageId, status: 'delivered' });
    } catch(e) {}
  });

  socket.on('message:read', async ({ senderId, messageId }) => {
    try {
      await Message.updateOne({ _id: messageId, status: { $ne: 'read' } }, { status: 'read' });
      io.to(`user:${senderId}`).emit('message:status', { messageId, status: 'read' });
    } catch(e) {}
  });

  socket.on('message:read_all', async ({ contactId }) => {
    try {
      // Mark all messages FROM contactId TO current user as read
      await Message.updateMany(
        { senderId: contactId, receiverId: userId, status: { $ne: 'read' } },
        { status: 'read' }
      );
      // Notify the reader's other sessions to clear badges
      io.to(`user:${userId}`).emit('message:read_all_confirmed', { contactId });
      // Notify the sender that their messages have been read
      io.to(`user:${contactId}`).emit('message:status_bulk', { readerId: userId, status: 'read' });
    } catch(e) {}
  });

  // ── Reaction relay ───────────────────────────────────────────────────────
  socket.on('message:react', (data) => {
    const room = data.groupId ? `group:${data.groupId}` : `user:${data.receiverId}`;
    io.to(room).emit('message:reacted', { ...data, reactorId: userId });
  });

  // ── Message deletion relay ───────────────────────────────────────────────
  socket.on('message:delete', (data) => {
    console.log('Relaying message deletion:', data.messageId);
    const room = data.groupId ? `group:${data.groupId}` : `user:${data.receiverId}`;
    io.to(room).emit('message:deleted', { messageId: data.messageId });
  });

  // ── Typing indicators ────────────────────────────────────────────────────
  socket.on('typing:start', ({ to, groupId }) => {
    const room = groupId ? `group:${groupId}` : `user:${to}`;
    socket.to(room).emit('typing:user', { userId, groupId });
  });

  socket.on('typing:stop', ({ to, groupId }) => {
    const room = groupId ? `group:${groupId}` : `user:${to}`;
    socket.to(room).emit('typing:stopped', { userId, groupId });
  });

  // ── Story view notification ──────────────────────────────────────────────
  socket.on('story:viewed', ({ storyOwnerId, storyId }) => {
    io.to(`user:${storyOwnerId}`).emit('story:view', { viewerId: userId, storyId });
  });

  // ── Request Chat notifications ───────────────────────────────────────────
  socket.on('request-chat:new', ({ targetId, requestId }) => {
    io.to(`user:${targetId}`).emit('request-chat:incoming', { requestId, requesterId: userId });
  });

  socket.on('request-chat:accepted', ({ requesterId, requestId, shadowToken, expiresAt }) => {
    io.to(`user:${requesterId}`).emit('request-chat:granted', { requestId, shadowToken, expiresAt });
  });

  socket.on('request-chat:revoked', ({ targetId, requestId }) => {
    io.to(`user:${targetId}`).emit('request-chat:access-revoked', { requestId });
  });

  // ── WebRTC / Jitsi Call Signaling ─────────────────────────────────────────
  socket.on('call:offer', ({ to, offer, callType, roomName }) => {
    io.to(`user:${to}`).emit('call:incoming', { from: userId, offer, callType, roomName });
  });

  socket.on('call:offer_group', ({ groupId, callType, roomName }) => {
    // Ring everyone in the group except the caller
    socket.to(`group:${groupId}`).emit('call:incoming', { from: userId, groupId, callType, roomName });
  });

  socket.on('call:answer', ({ to, answer }) => {
    io.to(`user:${to}`).emit('call:answered', { from: userId, answer });
  });

  socket.on('call:ice', ({ to, candidate }) => {
    io.to(`user:${to}`).emit('call:ice', { from: userId, candidate });
  });

  socket.on('call:end', ({ to }) => {
    io.to(`user:${to}`).emit('call:ended', { from: userId });
  });

  socket.on('call:reject', ({ to }) => {
    io.to(`user:${to}`).emit('call:rejected', { from: userId });
  });

  // ── Disconnect ───────────────────────────────────────────────────────────
  socket.on('disconnect', async () => {
    onlineUsers.delete(userId.toString());
    socket.broadcast.emit('user:offline', { userId });
    try {
      await User.findByIdAndUpdate(userId, { isOnline: false, lastSeen: new Date() });
    } catch (e) {}
  });
});

// ─── Listen (only after DB is ready) ────────────────────────────────────────
const PORT = process.env.PORT || 5000;

(async () => {
  // ── Startup env-var audit (visible in Railway logs) ──────────────────
  const required = { MONGO_URI: !!process.env.MONGO_URI, JWT_SECRET: !!process.env.JWT_SECRET };
  const smtp     = { SMTP_HOST: !!process.env.SMTP_HOST, SMTP_USER: !!process.env.SMTP_USER, SMTP_PASS: !!process.env.SMTP_PASS };
  const optional = { JWT_REFRESH_SECRET: !!process.env.JWT_REFRESH_SECRET, CLOUDINARY_CLOUD_NAME: !!process.env.CLOUDINARY_CLOUD_NAME };

  console.log('\n── Env-var audit ──────────────────────────────────');
  Object.entries(required).forEach(([k, v]) => console.log(`   ${v ? '✅' : '❌ MISSING'} ${k}`));
  const smtpReady = Object.values(smtp).every(Boolean);
  Object.entries(smtp).forEach(([k, v]) => console.log(`   ${v ? '✅' : '⚠️  missing'} ${k}`));
  if (!smtpReady) console.warn('   ⚠️  SMTP incomplete — OTP emails will be console-logged only.');
  Object.entries(optional).forEach(([k, v]) => console.log(`   ${v ? '✅' : 'ℹ️  not set'} ${k}`));
  console.log('───────────────────────────────────────────────────\n');

  // connectDB retries with exponential backoff and exits on final failure
  await connectDB();

  server.listen(PORT, () => {
    console.log(`\n🔒 SilentTalk backend running on port ${PORT}`);
    console.log(`   Environment : ${process.env.NODE_ENV || 'development'}`);
    console.log(`   MongoDB     : ready`);
    console.log(`   SMTP        : ${smtpReady ? 'configured' : 'console-mock (set SMTP_HOST/USER/PASS to enable)'}\n`);
  });
})();
