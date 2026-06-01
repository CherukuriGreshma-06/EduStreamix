// 1. LOAD CONFIGURATION VARIABLES FIRST
require('dotenv').config({ path: './.env' });

// 2. DEPENDENCY IMPORTS
const express = require('express');
const path = require('path');
const cors = require('cors');
const cookieParser = require('cookie-parser');

// 3. ROUTE CONTROLLER IMPORTS
const authMiddleware = require('./middleware/authMiddleware');
const paymentRoutes = require('./routes/paymentRoutes');
const studyRoutes = require('./routes/studyRoutes');
const videoRoutes = require('./routes/videoRoutes');
const studyController = require('./controllers/studyController');

const app = express();
const PORT = process.env.PORT || 3000;

// 4. CORE ENGINE MIDDLEWARES
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// 5. EMBEDDED JAVASCRIPT TEMPLATE SETTINGS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ==========================================
// 📄 PUBLIC ACCESS ROUTING (No Sessions Checked)
// ==========================================

// ✅ Dedicated Mount for Payment Pages & API Endpoints
//app.use('/payment', paymentRoutes);

// ==========================================
// 🔒 GATEKEEPER SECURITY WALL
// ==========================================
app.use(authMiddleware);

// ==========================================
// 🎓 INTERNAL PROTECTED ROUTES (Authorized Users Only)
// ==========================================

app.get('/landing', studyController.renderLanding);

// Handles protected dashboard resources at root "/"
app.use('/', studyRoutes);
app.use('/api', videoRoutes);

// ==========================================
// 🚫 ERROR & FALLTHROUGH MANAGEMENT
// ==========================================
app.use((req, res) => {
  res.status(404).redirect('/landing');
});

app.use((err, req, res, next) => {
  console.error("Unhandled Exception:", err);
  res.status(500).json({ error: 'Internal server error occurred.' });
});

// 6. START SYSTEM INITIALIZATION
app.listen(PORT, () => {
  console.log(`Server running smoothly on http://localhost:${PORT}`);
});
