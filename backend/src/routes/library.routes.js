const express = require('express');
const router = express.Router();
const { verifyToken, requireRole } = require('../middlewares/auth.middleware');
const { listLibrary, listReading, addBook, removeBook, getStatus } = require('../controllers/library.controller');

// Hợp đồng API-36..39b: thư viện cá nhân chỉ dành cho USER (ADMIN bị 403).
router.use(verifyToken, requireRole('USER'));
router.get('/', listLibrary);
router.get('/reading', listReading); // Phải đặt trước '/:bookId'
router.get('/:bookId/status', getStatus);
router.post('/:bookId', addBook);
router.delete('/:bookId', removeBook);

module.exports = router;
