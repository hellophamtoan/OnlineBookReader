const {pool,success,bad,posId,money,validation,replyError,withTx,claimRequest,finishRequest,audit,sendTransaction} = require('../services/week3.common');
const listUsers=async(req,res)=>{
 try{
  const [rows]=await pool.execute(`SELECT id,full_name AS fullName,email,phone,role,wallet_balance AS walletBalance
    FROM users WHERE role='USER' AND is_active=1 ORDER BY id LIMIT 500`);
  return success(res,200,'Lấy danh sách tài khoản USER thành công',{
    items:rows.map(u=>({...u,walletBalance:money(u.walletBalance)}))
  });
 }catch(e){return replyError(res,'Danh sách USER cho ADMIN',e);}
};
const topup=async(req,res)=>{
 try {
  const targetId=posId(req.params.id),amount=req.body?.amount,note=req.body?.note??'',reference=req.body?.externalReference??null;
  if(!targetId)validation('id','Mã người dùng không hợp lệ');
  if(!Number.isInteger(amount)||amount<1||amount>100000000)validation('amount','Số tiền mỗi lần nạp phải từ 1 đến 100.000.000 VNĐ');
  if(typeof note!=='string'||note.length>255)validation('note','Ghi chú không quá 255 ký tự');
  if(reference!==null&&(typeof reference!=='string'||!reference.trim()||reference.length>100))validation('externalReference','Mã tham chiếu không hợp lệ');
  const body={targetId,amount,note:note.trim(),externalReference:reference?.trim()??null};
  const result=await withTx(async conn=>{
   const claim=await claimRequest(conn,req,'WALLET_TOPUP',body);
   if(claim.replay)return {status:claim.status,body:claim.body};
   const [[user]]=await conn.execute('SELECT id,role,wallet_balance FROM users WHERE id=? FOR UPDATE',[targetId]);
   if(!user||user.role!=='USER')bad(404,'NOT_FOUND','Không tìm thấy tài khoản USER');
   if(money(user.wallet_balance)+amount>9999999999)validation('amount','Số dư vượt giới hạn');
   if(reference){
     const [[dup]]=await conn.execute(`SELECT id FROM wallet_transactions WHERE type='TOPUP' AND external_reference=? LIMIT 1`,[reference]);
     if(dup)bad(409,'DUPLICATE_EXTERNAL_REFERENCE','Mã tham chiếu nạp tiền đã được sử dụng');
   }
   await conn.execute('UPDATE users SET wallet_balance=wallet_balance+? WHERE id=?',[amount,targetId]);
   const [[balance]]=await conn.execute('SELECT wallet_balance FROM users WHERE id=?',[targetId]);
   const [added]=await conn.execute(`INSERT INTO wallet_transactions
     (user_id,type,amount,balance_after,ref_type,ref_id,note,external_reference)
     VALUES (?,'TOPUP',?,?, 'ADMIN',?,?,?)`,
     [targetId,amount,money(balance.wallet_balance),req.user.id,body.note||null,reference]);
   await audit(conn,req.user.id,'WALLET_TOPUP','USER',targetId,{amount,transactionId:added.insertId,reference});
   const [[tx]]=await conn.execute('SELECT id,type,amount,created_at AS createdAt FROM wallet_transactions WHERE id=?',[added.insertId]);
   return finishRequest(conn,claim,200,'Nạp tiền thành công',{
     userId:targetId,amount,balance:money(balance.wallet_balance),walletBalance:money(balance.wallet_balance),
     note:body.note||null,transaction:{...tx,amount:money(tx.amount)}});
  });return sendTransaction(res,result);
 }catch(e){if(e.code==='ER_DUP_ENTRY')return require('../services/week3.common').fail(res,409,'Mã tham chiếu đã được sử dụng','DUPLICATE_EXTERNAL_REFERENCE');
 return replyError(res,'Nạp tiền ví',e);}
};
module.exports={topup,listUsers};
