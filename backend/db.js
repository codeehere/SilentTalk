const mongoose = require('mongoose');

let _isReady = false;

/**
 * Returns true once Mongoose has successfully connected at least once.
 * Used by the server's DB-ready middleware to gate all API requests.
 */
const isDBReady = () => _isReady;

const connectDB = async () => {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('FATAL: MONGO_URI environment variable is not set.');
    process.exit(1);
  }

  // Mongoose global reconnection settings
  mongoose.connection.on('connected', () => {
    _isReady = true;
    console.log(`[DB] MongoDB connected: ${mongoose.connection.host}`);
  });

  mongoose.connection.on('disconnected', () => {
    _isReady = false;
    console.warn('[DB] MongoDB disconnected. Waiting for auto-reconnect…');
  });

  mongoose.connection.on('reconnected', () => {
    _isReady = true;
    console.log('[DB] MongoDB reconnected.');
  });

  mongoose.connection.on('error', (err) => {
    console.error('[DB] Mongoose connection error:', err.message);
  });

  // Exponential-backoff retry loop — important for Railway cold-starts
  // where Atlas may take a few seconds to accept connections.
  const MAX_RETRIES = 5;
  let attempt = 0;

  while (attempt < MAX_RETRIES) {
    try {
      await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 15000,  // 15 s to find a server
        socketTimeoutMS: 45000,           // 45 s idle socket timeout
        // Mongoose 6+ manages its own connection pool; these are fine defaults
      });
      // If we get here the initial connect succeeded; the event handler above
      // will set _isReady = true.
      return;
    } catch (err) {
      attempt++;
      const delay = Math.min(1000 * 2 ** attempt, 30000); // 2 s, 4 s, 8 s … max 30 s
      console.error(
        `[DB] Connection attempt ${attempt}/${MAX_RETRIES} failed: ${err.message}. Retrying in ${delay / 1000}s…`
      );
      if (attempt >= MAX_RETRIES) {
        console.error('[DB] FATAL: Could not connect to MongoDB after max retries. Exiting.');
        process.exit(1);
      }
      await new Promise((r) => setTimeout(r, delay));
    }
  }
};

module.exports = { connectDB, isDBReady };
