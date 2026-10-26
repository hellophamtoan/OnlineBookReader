const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middlewares/auth.middleware');
const { getProgress, saveProgress } = require('../controllers/reading.controller');

router.get('/progress/:bookId', verifyToken, getProgress);  // UC006
router.put('/progress/:bookId', verifyToken, saveProgress); // UC006

module.exports = router;
