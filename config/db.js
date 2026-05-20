/* ──────────────────────────────────────────────
   MongoDB Connection
   ────────────────────────────────────────────── */

const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 30000
    });
    console.log(`✅ MongoDB connected: ${conn.connection.host}`);
  } catch (err) {
    console.error(`⚠️  MongoDB connection failed: ${err.message}`);
    console.error('   The server will continue running but DB features will be limited.');
  }
};

module.exports = connectDB;
