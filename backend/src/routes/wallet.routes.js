// routes/wallet.routes.js — ví của USER (UC013)
const router = require('express').Router();
const { verifyToken, requireRole } = require('../middlewares/auth.middleware');
const { ROLES } = require('../utils/constants');
const wallet = require('../controllers/wallet.controller');

router.use(verifyToken, requireRole(ROLES.USER));
router.post('/topup', wallet.createTopup);
router.get('/topup/:orderCode', wallet.getTopupStatus);
router.get('/topups', wallet.listTopups);
router.get('/balance', wallet.getBalance);
router.get('/transactions', wallet.listTransactions);

module.exports = router;
