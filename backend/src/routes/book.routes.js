const express = require('express');
const router = express.Router();
const { getBooks, getBookById } = require('../controllers/book.controller');
const { listChapters, getChapter } = require('../controllers/chapter.controller');
const { verifyToken } = require('../middlewares/auth.middleware');
const { requireReadAccess } = require('../middlewares/subscription.middleware');

router.get('/', getBooks);
router.get('/:id', getBookById);
// UC006 - đọc e-book: cần đăng nhập và gói đọc còn hiệu lực
router.get('/:id/chapters', verifyToken, requireReadAccess, listChapters);
router.get('/:id/chapters/:chapterNumber', verifyToken, requireReadAccess, getChapter);

module.exports = router;
