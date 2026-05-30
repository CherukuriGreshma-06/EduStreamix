const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/studyController');
const quizCtrl = require('../controllers/quizController');

// ── Pages ───────────────────────────────────
router.get('/',         ctrl.renderLanding);
router.get('/boards',   ctrl.renderBoards);
router.get('/subjects', ctrl.renderSubjects);
router.get('/study',    ctrl.renderStudy);

// ── API Endpoints ───────────────────────────
router.get('/api/subjects', ctrl.getSubjects);
router.get('/api/chapters', ctrl.getChapters);

// ❌ REMOVE THIS (IMPORTANT)
// router.get('/api/video', ctrl.getVideo);

// ── Translation ─────────────────────────────
router.post('/translate-batch', ctrl.translateBatch);
router.post('/api/upload-pdf', ctrl.uploadPdf);

// ── AI Quiz ─────────────────────────────────
router.post('/api/generate-test', quizCtrl.generateTest);

// ── Admin ───────────────────────────────────
router.get('/admin', ctrl.renderAdmin);

module.exports = router;