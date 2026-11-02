// Run: node --test tests/week3.integrated.node.test.js
// Self-contained business contract tests; no MySQL or npm dependencies required.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const commonPath = require.resolve('../src/services/week3.common');
let fakeConnection;
class BusinessError extends Error {
  constructor(status, code, message) {super(message);this.status=status;this.code=code;}
}
const bad=(status,code,message)=>{throw new BusinessError(status,code,message);};
const fakeCommon={
  pool:{execute:()=>[[]]},success:()=>{},bad,
  posId:v=>/^\d+$/.test(String(v))&&Number.isSafeInteger(Number(v))&&Number(v)>0?Number(v):null,
  qty:v=>typeof v==='number'&&Number.isInteger(v)&&v>=1&&v<=99?v:null,
  money:v=>{const n=Number(v);if(!Number.isSafeInteger(n)||n<0)throw new Error('invalid money');return n},
  validation:(field,message)=>bad(400,'VALIDATION_ERROR',message),
  replyError:(res,context,error)=>{throw error},
  withTx:async fn=>fn(fakeConnection),
  claimRequest:async()=>({replay:false,id:1}),
  finishRequest:async(conn,claim,status,message,data)=>({status,body:{success:true,message,data}}),
  audit:async()=>{},
  sendTransaction:(res,value)=>value,
};
require.cache[commonPath]={id:commonPath,filename:commonPath,loaded:true,exports:fakeCommon};
const {validateCheckout,create}=require('../src/controllers/order.controller');
const {planBody,progressivePlanPrice}=require('../src/controllers/plan.controller');
const customer={id:7};
const valid={receiverName:'Nguyen An',receiverPhone:'0912345678',shippingAddress:'12 Pho Hue Ha Noi',paymentMethod:'COD'};
function setupCart(source){
  const statements=[];
  const books={2:{id:2,title:'Book 2',price:'20000.00',stock:7,hasPhysical:1,status:'active'},
    3:{id:3,title:'Book 3',price:'30000.00',stock:8,hasPhysical:1,status:'active'},
    4:{id:4,title:'Buy now',price:'40000.00',stock:3,hasPhysical:1,status:'active'}};
  fakeConnection={execute:async(sql,args=[])=>{
    statements.push({sql,args});
    if(sql.includes('SELECT id,wallet_balance FROM users'))return [[{id:7,wallet_balance:'90000.00'}]];
    if(sql.includes('SELECT book_id AS bookId,quantity FROM cart_items'))return [[{bookId:2,quantity:2},{bookId:3,quantity:1}]];
    if(sql.includes('FROM books WHERE id=? FOR UPDATE'))return [[books[args[0]]]];
    if(sql.includes('INSERT INTO orders'))return [{insertId:100}];
    if(sql.includes('SELECT id,status,payment_method AS paymentMethod'))return [[{
      id:100,status:'PENDING',paymentMethod:'COD',paymentStatus:'UNPAID',totalAmount:source==='buy_now'?40000:20000,
      shippingFee:0,receiverName:'Nguyen An',receiverPhone:valid.receiverPhone,shippingAddress:valid.shippingAddress
    }]];
    if(sql.includes('SELECT book_id AS bookId,book_title AS title'))return [[{bookId:source==='buy_now'?4:2,quantity:1,unitPrice:20000,subtotal:20000}]];
    return [{affectedRows:1}];
  }};
  return statements;
}
test('validate rejects duplicate books, amount strings and nonphysical candidates',()=>{
  assert.equal(validateCheckout({...valid}).source,'all');
  assert.throws(()=>validateCheckout({...valid,source:'cart',items:[{bookId:2,quantity:1},{bookId:2,quantity:1}]}));
  assert.throws(()=>validateCheckout({...valid,source:'buy_now',items:[{bookId:3,quantity:'1'}]}));
  assert.equal(validateCheckout({...valid,source:'buy_now',items:[{bookId:4,quantity:1}]}).items[0].bookId,4);
});
test('buy now never removes unrelated cart rows',async()=>{
  const queries=setupCart('buy_now');
  const outcome=await create({user:customer,body:{...valid,source:'buy_now',items:[{bookId:4,quantity:1}]}},{});
  assert.equal(outcome.status,201);
  assert.equal(queries.some(q=>q.sql.includes('DELETE FROM cart_items')),false);
  assert.deepEqual(queries.filter(q=>q.sql.includes('FROM books WHERE id=? FOR UPDATE')).map(q=>q.args[0]),[4]);
});
test('selected cart order updates only selected quantities',async()=>{
  const queries=setupCart('cart');
  const outcome=await create({user:customer,body:{...valid,source:'cart',items:[{bookId:2,quantity:1}]}},{});
  assert.equal(outcome.status,201);
  assert.equal(queries.filter(q=>q.sql.startsWith('UPDATE cart_items')).length,1);
  assert.deepEqual(queries.find(q=>q.sql.startsWith('UPDATE cart_items')).args.slice(0,3),[1,7,2]);
  assert.equal(queries.some(q=>q.sql.includes('DELETE FROM cart_items WHERE user_id=?')&&q.args.length===1),false);
});
test('free, custom and lifetime plan forms validate and price is server-owned',()=>{
  assert.equal(planBody({name:'Free',price:0,durationDays:30}).price,0);
  assert.equal(planBody({name:'Life',planKind:'lifetime',price:500000}).durationDays,36500);
  assert.equal(planBody({name:'Custom',planKind:'custom',price:0,basePrice30:60000}).durationDays,30);
  assert.equal(progressivePlanPrice(90,60000),130000);
  assert.throws(()=>planBody({name:'Invalid',planKind:'lifetime',price:0}));
});
