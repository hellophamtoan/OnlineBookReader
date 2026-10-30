// Run from backend: node scripts/week3-preflight.js (copy into scripts/week3-preflight.js).
require('dotenv').config();
const pool=require('../src/config/db.config');
const needs={
 users:['id','role','wallet_balance'],books:['id','title','price','stock','status','has_physical'],
 cart_items:['id','user_id','book_id','quantity'],
 orders:['id','user_id','status','payment_method','payment_status','total_amount','shipping_fee','receiver_name','receiver_phone','shipping_address','note','created_at','updated_at'],
 order_items:['id','order_id','book_id','book_title','quantity','unit_price','subtotal'],
 reading_plans:['id','name','price','duration_days','status','created_at','updated_at','plan_kind','base_price_30'],
 subscriptions:['id','user_id','plan_id','plan_name','price_paid','duration_days','start_date','end_date','plan_kind'],
 wallet_transactions:['id','user_id','type','amount','balance_after','ref_type','ref_id','note','external_reference','created_at'],
 audit_logs:['id','user_id','action','entity_type','entity_id','detail'],
 idempotency_requests:['id','user_id','operation','idempotency_key','request_hash','status','response_status','response_body'],
};
(async()=>{
  let problems=0;
  for(const [table,columns] of Object.entries(needs)){
    const [rows]=await pool.execute(`SELECT COLUMN_NAME,COLUMN_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?`,[table]);
    const existing=new Map(rows.map(r=>[r.COLUMN_NAME,r.COLUMN_TYPE]));
    const missing=columns.filter(c=>!existing.has(c));
    console.log(`${missing.length?'FAIL':'OK'} ${table}: ${missing.length?'thiếu '+missing.join(', '):'đủ cột'}`);
    problems+=missing.length;
    if(['orders','wallet_transactions','reading_plans'].includes(table))for(const key of ['status','payment_method','payment_status','type']){
      if(existing.has(key))console.log(`  ${key}: ${existing.get(key)}`);
    }
  }
  const [idx]=await pool.execute(`SELECT INDEX_NAME,GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) AS columns_used
    FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='cart_items'
      AND NON_UNIQUE=0 GROUP BY INDEX_NAME`);
  if(!idx.some(r=>r.columns_used==='user_id,book_id')){
    console.error('FAIL cart_items: thiếu UNIQUE(user_id,book_id)'); problems++;
  }
  console.log(problems?`Còn ${problems} lỗi schema, kiểm tra migration trước khi gọi API`:'Schema tuần 3 cơ bản đạt');
  await pool.end();process.exitCode=problems?1:0;
})().catch(err=>{console.error(err);process.exitCode=1;pool.end().catch(()=>{});});
