const express = require('express');
const router = express.Router();
const { getPublishers } = require('../controllers/publisher.controller');

router.get('/', getPublishers);

module.exports = router;
