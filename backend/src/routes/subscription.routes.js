const router=require('express').Router();
const {verifyToken,requireRole}=require('../middlewares/auth.middleware');
const {ROLES}=require('../utils/constants');
const plan=require('../controllers/plan.controller');
router.use(verifyToken,requireRole(ROLES.USER));
router.post('/',plan.subscribe);
router.get('/me',plan.mine);
module.exports=router;
