const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middlewares/auth.middleware');
const { getProfile, updateProfile } = require('../controllers/profile.controller');

router.get('/me', verifyToken, getProfile);    // UC012
router.put('/me', verifyToken, updateProfile); // UC012

module.exports = router;
