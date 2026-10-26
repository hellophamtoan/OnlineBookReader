// Tập trung các nhóm API của hệ thống.
const express = require('express');
const router = express.Router();

const authRoutes = require('./auth.routes');
const bookRoutes = require('./book.routes');
const categoryRoutes = require('./category.routes');
const authorRoutes = require('./author.routes');
const publisherRoutes = require('./publisher.routes');
const readingRoutes = require('./reading.routes');
const userRoutes = require('./user.routes');
const adminRoutes = require('./admin.routes');
const libraryRoutes = require('./library.routes');

router.use('/auth', authRoutes);
router.use('/books', bookRoutes);
router.use('/categories', categoryRoutes);
router.use('/authors', authorRoutes);
router.use('/publishers', publisherRoutes);
router.use('/reading', readingRoutes);
router.use('/users', userRoutes);
router.use('/library', libraryRoutes);
router.use('/admin', adminRoutes);

module.exports = router;
