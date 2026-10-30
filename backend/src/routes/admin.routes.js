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
router.get('/users',wallet.listUsers);
router.post('/users/:id/wallet/topup',wallet.topup);

module.exports = router;
