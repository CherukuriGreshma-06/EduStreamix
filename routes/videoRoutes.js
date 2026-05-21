const express = require('express');
const router = express.Router();
const studyCtrl = require('../controllers/studyController');

// Video API route
router.get('/video', studyCtrl.getVideo);

module.exports = router;
