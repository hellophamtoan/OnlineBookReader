const express = require('express');
const router = express.Router();
const { getAuthors } = require('../controllers/author.controller');

router.get('/', getAuthors);

module.exports = router;
