const express = require('express');
const router = express.Router();
const { getBooks, getBookById } = require('../controllers/book.controller');
const { listChapters, getChapter } = require('../controllers/chapter.controller');
const { verifyToken } = require('../middlewares/auth.middleware');

router.get('/', getBooks);
router.get('/:id', getBookById);
// UC006 - mục lục được xem sau đăng nhập; 10 chương đầu được đọc miễn phí.
router.get('/:id/chapters', verifyToken, listChapters);
router.get('/:id/chapters/:chapterNumber', verifyToken, getChapter);

module.exports = router;
