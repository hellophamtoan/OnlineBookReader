// Toàn bộ API quản trị (UC007): chỉ ADMIN. Mọi request đều qua verifyToken + requireRole.
const express = require('express');
const router = express.Router();
const { verifyToken, requireRole } = require('../middlewares/auth.middleware');
const { ROLES } = require('../utils/constants');
const { categoryController, authorController, publisherController } = require('../controllers/admin.catalog.controller');
const book = require('../controllers/admin.book.controller');
const chapter = require('../controllers/admin.chapter.controller');
const plan = require('../controllers/plan.controller');
const wallet = require('../controllers/wallet.admin.controller');

router.use(verifyToken, requireRole(ROLES.ADMIN));

// [Backend] Tạo nhóm route CRUD cho thể loại / tác giả / NXB.
const catalogRoutes = (ctrl) => {
  const r = express.Router();
  r.get('/', ctrl.list);
  r.post('/', ctrl.create);
  r.put('/:id', ctrl.update);
  r.delete('/:id', ctrl.remove);
  return r;
};
router.use('/categories', catalogRoutes(categoryController));
router.use('/authors', catalogRoutes(authorController));
router.use('/publishers', catalogRoutes(publisherController));

router.get('/books', book.listBooks);
router.post('/books', book.createBook);
router.get('/books/:id', book.getBook);
router.put('/books/:id', book.updateBook);
router.delete('/books/:id', book.deleteBook);

router.get('/books/:bookId/chapters', chapter.listChapters);
router.post('/books/:bookId/chapters', chapter.createChapter);
router.get('/chapters/:id', chapter.getChapter);
router.put('/chapters/:id', chapter.updateChapter);
router.delete('/chapters/:id', chapter.deleteChapter);

router.get('/plans',plan.listAdmin);
router.post('/plans',plan.createAdmin);
router.get('/plans/:id',plan.getAdmin);
router.put('/plans/:id',plan.updateAdmin);
router.delete('/plans/:id',plan.deleteAdmin);
const w4=require('../controllers/week4.controller');
router.get('/users',w4.users);
router.get('/users/:id',w4.user);
router.patch('/users/:id/lock',w4.lock(false));
router.patch('/users/:id/unlock',w4.lock(true));
router.get('/orders',w4.orders);
router.get('/orders/:id',w4.order);
router.patch('/orders/:id/status',w4.change);
router.post('/orders/:id/confirm',(req,res,next)=>{req.week4Status='CONFIRMED';next();},w4.change);
router.post('/orders/:id/cancel',(req,res,next)=>{req.week4Status='CANCELLED';next();},w4.change);
router.get('/reports/overview',w4.overview);
router.get('/reports/revenue',w4.revenue);
router.get('/reports/best-sellers',w4.best);
router.get('/reports/subscriptions',w4.subscriptions);
router.post('/users/:id/wallet/topup',wallet.topup);
// UC013: nạp ví QR - tài khoản nhận tiền, lịch sử, xác nhận đã nhận tiền
const topupAdmin=require('../controllers/wallet.topup.admin.controller');
router.get('/store/bank-account',topupAdmin.getBankAccount);
router.put('/store/bank-account',topupAdmin.updateBankAccount);
router.get('/users/:id/wallet/topups',topupAdmin.userTopupHistory);
router.post('/users/:id/wallet/topups/:orderCode/confirm',topupAdmin.confirmTopup);

module.exports = router;
