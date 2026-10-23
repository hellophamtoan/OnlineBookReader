const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middlewares/auth.middleware');
const { requireReadAccess } = require('../middlewares/subscription.middleware');
const { getProgress, saveProgress } = require('../controllers/reading.controller');

router.get('/progress/:bookId', verifyToken, requireReadAccess, getProgress);  // UC006
router.put('/progress/:bookId', verifyToken, requireReadAccess, saveProgress); // UC006

module.exports = router;
