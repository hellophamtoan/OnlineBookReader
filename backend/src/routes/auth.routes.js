const express = require('express');
const router = express.Router();
const { register, login, me, logout } = require('../controllers/auth.controller');
const { verifyToken } = require('../middlewares/auth.middleware');

router.post('/register', register); // UC001
router.post('/login', login);       // UC002
router.get('/me', verifyToken, me); // UC002
router.post('/logout', verifyToken, logout); // UC002

module.exports = router;
