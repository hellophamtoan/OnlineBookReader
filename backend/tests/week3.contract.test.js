const crypto=require('node:crypto');
jest.mock('../src/config/db.config',()=>({execute:jest.fn(),getConnection:jest.fn()}));
const {posId,qty,money,hashPayload,claimRequest}=require('../src/services/week3.common');
const {validateCheckout}=require('../src/controllers/order.controller');
const {planBody}=require('../src/controllers/plan.controller');
const {cartData}=require('../src/controllers/cart.controller');
const {ROLES}=require('../src/utils/constants');
const {requireRole}=require('../src/middlewares/auth.middleware');
describe('Week3 validation and contracts',()=>{
 test('ids and quantity boundaries',()=>{
  expect(posId('9')).toBe(9);expect(posId('0')).toBeNull();expect(posId('1 OR 1')).toBeNull();
  expect(qty(99)).toBe(99);expect(qty(100)).toBeNull();expect(qty('1')).toBeNull();
 });
 test('money must be integer VND',()=>{
  expect(money('29000.00')).toBe(29000);
  expect(()=>money('99.5')).toThrow();
 });
 test('checkout validation strips input and disallows wrong phone/payment',()=>{
  expect(validateCheckout({receiverName:'  Minh An  ',receiverPhone:'0912345678',shippingAddress:'12 Phố Huế Hà Nội',paymentMethod:'COD'}))
    .toEqual({receiverName:'Minh An',receiverPhone:'0912345678',shippingAddress:'12 Phố Huế Hà Nội',paymentMethod:'COD',note:null,source:'all',items:null});
  expect(()=>validateCheckout({receiverName:'M',receiverPhone:'123',shippingAddress:'x',paymentMethod:'OTHER'})).toThrow('Dữ liệu đặt hàng không hợp lệ');
 });
 test('plan body supports fixed/free/lifetime/custom and validates prices',()=>{
  expect(planBody({name:'  Gói tháng  ',price:29000,durationDays:30}).name).toBe('Gói tháng');
  expect(planBody({name:'Miễn phí',price:0,durationDays:30}).planKind).toBe('fixed');
  expect(planBody({name:'Trọn đời',price:500000,planKind:'lifetime'}).durationDays).toBe(36500);
  expect(planBody({name:'Theo ngày',price:0,planKind:'custom',basePrice30:60000}).basePrice30).toBe(60000);
  expect(()=>planBody({name:'Trọn đời',price:0,planKind:'lifetime'})).toThrow();
 });
 test('selected cart and buy now input rejects duplicates/invalid quantity',()=>{
  const b={receiverName:'Minh An',receiverPhone:'0912345678',shippingAddress:'12 Phố Huế Hà Nội',paymentMethod:'COD'};
  expect(validateCheckout({...b,source:'buy_now',items:[{bookId:9,quantity:2}]}).source).toBe('buy_now');
  expect(()=>validateCheckout({...b,source:'cart',items:[{bookId:9,quantity:1},{bookId:9,quantity:2}]})).toThrow();
  expect(()=>validateCheckout({...b,source:'buy_now',items:[{bookId:9,quantity:101}]})).toThrow();
 });
 test('empty cart and in-stock availability',async()=>{
  const executor={execute:jest.fn().mockResolvedValueOnce([[{bookId:3,quantity:2,title:'Book',coverUrl:null,price:'25000.00',stock:1,status:'active',hasPhysical:1}]])};
  const result=await cartData(executor,7);
  expect(result.canCheckout).toBe(false);expect(result.totalAmount).toBe(50000);expect(result.items[0].available).toBe(false);
 });
 test('ADMIN cannot access USER commerce',()=>{
  const response={status:jest.fn().mockReturnThis(),json:jest.fn()};
  requireRole(ROLES.USER)({user:{role:'ADMIN'}},response,jest.fn());
  expect(response.status).toHaveBeenCalledWith(403);
 });
 test('idempotency request matches previous response',async()=>{
  const id=crypto.randomUUID();
  const payload={planId:5};const hash=hashPayload(payload);
  const conn={execute:jest.fn().mockResolvedValueOnce([{affectedRows:0}]).mockResolvedValueOnce([[{
    id:10,request_hash:hash,status:'COMPLETED',response_status:201,
    response_body:JSON.stringify({success:true,message:'OK',data:{id:14}})
  }]])};
  const result=await claimRequest(conn,{get:()=>id,user:{id:2}},'SUBSCRIPTION_CREATE',payload);
  expect(result.replay).toBe(true);expect(result.body.data.id).toBe(14);
 });
 test('reject reuse of key with different request',async()=>{
  const conn={execute:jest.fn().mockResolvedValueOnce([{affectedRows:0}]).mockResolvedValueOnce([[{
    id:4,request_hash:'different',status:'COMPLETED'
  }]])};
  await expect(claimRequest(conn,{get:()=>crypto.randomUUID(),user:{id:2}},'ORDER_CREATE',{abc:1}))
    .rejects.toMatchObject({status:409,code:'IDEMPOTENCY_KEY_REUSED'});
 });
});
