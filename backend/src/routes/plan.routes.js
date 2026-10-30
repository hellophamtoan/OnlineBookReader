const router=require('express').Router();
const plan=require('../controllers/plan.controller');
router.get('/',plan.listPublic);
module.exports=router;
