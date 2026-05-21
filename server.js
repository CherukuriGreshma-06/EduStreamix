require('dotenv').config();

const express = require('express');
const path = require('path');
const cors = require('cors');
const connectDB = require('./config/db');

const studyRoutes = require('./routes/studyRoutes');
const videoRoutes = require('./routes/videoRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// ── DB CONNECT ──
connectDB();

// ── MIDDLEWARE ──
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ── VIEW ENGINE ──
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ── ROUTES ──
app.use('/', studyRoutes);
app.use('/api', videoRoutes);

// ── 404 ──
app.use((req, res) => {
  res.status(404).render('landing', { error: 'Page not found' });
});

// ── ERROR HANDLER ──
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

// ── START SERVER ──
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});