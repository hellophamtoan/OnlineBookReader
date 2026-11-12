// UC005 / UC008 – Các loại gói cố định, miễn phí một lần, trọn đời và tùy chọn ngày.
// Tất cả giá và thời hạn đều được tính lại ở backend, không tin giá từ frontend.
const {pool,success,bad,posId,money,validation,replyError,withTx,claimRequest,finishRequest,audit,sendTransaction} = require('../services/week3.common');
const PLAN_KINDS = ['fixed','custom','lifetime'];
const MIN_CUSTOM_DAYS = 30;
const MAX_CUSTOM_DAYS = 3650;
const LIFETIME_DAYS = 36500;
const iso = v => v == null ? null : v instanceof Date ? v.toISOString() : new Date(String(v).replace(' ','T')+'Z').toISOString();
const dateOnly = v => iso(v)?.slice(0,10);
const planView = r => ({
  id:r.id,name:r.name,description:r.description??'',price:money(r.price),durationDays:Number(r.duration_days),
  planKind:r.plan_kind??'fixed',basePrice30:money(r.base_price_30??r.price),
  isFree:(r.plan_kind??'fixed')==='fixed'&&money(r.price)===0,
  status:r.status,createdAt:iso(r.created_at),updatedAt:iso(r.updated_at)
});
const subscriptionView = r => {
  const start=iso(r.start_date),end=iso(r.end_date),now=Date.now();
  const kind=r.plan_kind??'fixed';
  return {id:r.id,planId:r.plan_id,planName:r.plan_name,pricePaid:money(r.price_paid),
    price:money(r.price_paid),durationDays:Number(r.duration_days),startDate:start,endDate:end,
    planKind:kind,isLifetime:kind==='lifetime',
    status:new Date(start).getTime()>now?'UPCOMING':new Date(end).getTime()<=now?'EXPIRED':'ACTIVE'};
};
const progressivePlanPrice=(days,base)=>{
  if(!Number.isInteger(days)||days<MIN_CUSTOM_DAYS||days>MAX_CUSTOM_DAYS)validation('endDate','Thời hạn tùy chọn từ 30 đến 3650 ngày');
  let total=0,remaining=days,index=0;
  while(remaining>0){
    index++;
    const d=Math.min(30,remaining);
    const factor=index===1?1:index===2?2/3:index===3?1/2:1/3;
    total+=factor*base*d/30;
    remaining-=d;
  }
  return Math.round(total/1000)*1000;
};
const listPublic=async(req,res)=>{
 try{
  const [rows]=await pool.execute("SELECT * FROM reading_plans WHERE status='active' ORDER BY duration_days,price,id");
  return success(res,200,'Lấy danh sách gói đọc thành công',{items:rows.map(planView)});
 }catch(e){return replyError(res,'Danh sách gói đọc',e);}
};
const subscribe=async(req,res)=>{
 try{
  const planId=posId(req.body?.planId);
  if(!planId)validation('planId','Mã gói không hợp lệ');
  const endDate=req.body?.endDate;
  if(endDate!==undefined && (typeof endDate!=='string'||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(endDate)||Number.isNaN(Date.parse(endDate))))
    validation('endDate','Ngày kết thúc phải có dạng YYYY-MM-DD');
  const outcome=await withTx(async conn=>{
    const claim=await claimRequest(conn,req,'SUBSCRIPTION_CREATE',{planId,endDate:endDate??null});
    if(claim.replay)return {status:claim.status,body:claim.body};
    // Khóa user trước để tuần tự hóa mua gói và các khoản trừ ví của cùng tài khoản.
    const [[user]]=await conn.execute('SELECT id,wallet_balance FROM users WHERE id=? FOR UPDATE',[req.user.id]);
    if(!user)bad(401,'UNAUTHORIZED','Tài khoản không tồn tại');
    const [[plan]]=await conn.execute("SELECT * FROM reading_plans WHERE id=? AND status='active' LIMIT 1",[planId]);
    if(!plan)bad(404,'PLAN_NOT_FOUND','Gói đọc không tồn tại hoặc đã ngừng bán');
    const kind=plan.plan_kind??'fixed';
    if(kind!=='custom' && endDate!==undefined)validation('endDate','Chỉ gói tùy chọn mới được gửi ngày kết thúc');
    const [[life]]=await conn.execute("SELECT id FROM subscriptions WHERE user_id=? AND plan_kind='lifetime' AND end_date>NOW() LIMIT 1",[req.user.id]);
    if(life)bad(409,'LIFETIME_ACTIVE','Bạn đã sở hữu gói trọn đời');
    const [[time]]=await conn.execute('SELECT GREATEST(NOW(),COALESCE(MAX(end_date),NOW())) AS startDate FROM subscriptions WHERE user_id=?',[req.user.id]);
    const start=time.startDate;
    let days=Number(plan.duration_days);
    let price=money(plan.price);
    if(kind==='custom'){
      if(!endDate)validation('endDate','Chọn ngày kết thúc cho gói tùy chọn');
      const [[{n}]]=await conn.execute('SELECT DATEDIFF(?,DATE(?)) AS n',[endDate,start]);
      days=Number(n);
      if(!Number.isInteger(days)||days<MIN_CUSTOM_DAYS||days>MAX_CUSTOM_DAYS)
        validation('endDate','Ngày kết thúc phải cách ngày bắt đầu quyền đọc từ 30 đến 3650 ngày');
      price=progressivePlanPrice(days,money(plan.base_price_30));
    } else if(kind==='lifetime'){
      days=LIFETIME_DAYS;
    }
    if(kind==='fixed'&&price===0){
      const [[claimed]]=await conn.execute('SELECT id FROM subscriptions WHERE user_id=? AND price_paid=0 AND plan_kind=\'fixed\' LIMIT 1',[req.user.id]);
      if(claimed)bad(409,'FREE_PLAN_USED','Mỗi tài khoản chỉ được nhận gói miễn phí một lần');
    }
    if(money(user.wallet_balance)<price)
      bad(400,'INSUFFICIENT_BALANCE','Số dư ví không đủ để đăng ký gói đọc');
    const [added]=await conn.execute(`INSERT INTO subscriptions
      (user_id,plan_id,plan_name,price_paid,duration_days,start_date,end_date,plan_kind)
      VALUES (?,?,?,?,?,?,DATE_ADD(?,INTERVAL ? DAY),?)`,
      [req.user.id,plan.id,plan.name,price,days,start,start,days,kind]);
    if(price>0){
      const [paid]=await conn.execute('UPDATE users SET wallet_balance=wallet_balance-? WHERE id=? AND wallet_balance>=?',
        [price,req.user.id,price]);
      if(paid.affectedRows!==1)bad(400,'INSUFFICIENT_BALANCE','Số dư ví không đủ');
    }
    const [[balance]]=await conn.execute('SELECT wallet_balance FROM users WHERE id=?',[req.user.id]);
    if(price>0){
      await conn.execute(`INSERT INTO wallet_transactions (user_id,type,amount,balance_after,ref_type,ref_id,note)
        VALUES (?,'PAY_PLAN',?,?,'SUBSCRIPTION',?,?)`,
        [req.user.id,-price,money(balance.wallet_balance),added.insertId,`Mua ${plan.name}`]);
    }
    await audit(conn,req.user.id,'SUBSCRIPTION_CREATE','SUBSCRIPTION',added.insertId,{planId,price,days,kind});
    const [[row]]=await conn.execute('SELECT * FROM subscriptions WHERE id=?',[added.insertId]);
    const subscription=subscriptionView(row);
    return finishRequest(conn,claim,201,'Đăng ký gói đọc thành công',{
      subscription,currentEndDate:subscription.endDate,walletBalance:money(balance.wallet_balance)
    });
  });return sendTransaction(res,outcome);
 }catch(e){return replyError(res,'Đăng ký gói đọc',e);}
};
const mine=async(req,res)=>{
 try{
  const [rows]=await pool.execute('SELECT * FROM subscriptions WHERE user_id=? ORDER BY start_date DESC,id DESC',[req.user.id]);
  const items=rows.map(subscriptionView);
  const valid=items.filter(i=>i.status==='ACTIVE'||i.status==='UPCOMING');
  const [[u]]=await pool.execute('SELECT wallet_balance FROM users WHERE id=?',[req.user.id]);
  return success(res,200,'Lấy gói đọc của tôi thành công',{
    hasActiveSubscription:items.some(i=>i.status==='ACTIVE'),
    hasLifetime:valid.some(i=>i.isLifetime),
    freePlanUsed:items.some(i=>i.planKind==='fixed'&&i.pricePaid===0),
    walletBalance:money(u.wallet_balance),
    currentEndDate:valid.length?valid.map(i=>i.endDate).reduce((a,b)=>a>b?a:b):null,
    latestEndDate:items.length?items.map(i=>i.endDate).reduce((a,b)=>a>b?a:b):null,
    items
  });
 }catch(e){return replyError(res,'Gói đọc của tôi',e);}
};
const planBody=(body,base=null)=>{
  const b=body||{};const keys=Object.keys(b);
  if(base&&!keys.length)validation('body','Cần ít nhất một thuộc tính');
  const allowed=new Set(['name','description','price','durationDays','status','planKind','basePrice30']);
  if(keys.some(k=>!allowed.has(k)))validation('body','Có trường không được phép cập nhật');
  const v={
    name:b.name??base?.name,description:b.description===undefined?base?.description??null:b.description,
    price:b.price??base?.price,durationDays:b.durationDays??base?.durationDays,
    status:b.status??base?.status??'active',planKind:b.planKind??base?.planKind??'fixed',
    basePrice30:b.basePrice30??base?.basePrice30??b.price??base?.price
  };
  if(typeof v.name!=='string'||!v.name.trim()||v.name.trim().length>100)validation('name','Tên gói tối đa 100 ký tự');
  if(v.description!==null&&(typeof v.description!=='string'||v.description.length>500))validation('description','Mô tả không quá 500 ký tự');
  if(!['active','inactive'].includes(v.status))validation('status','Trạng thái không hợp lệ');
  if(!PLAN_KINDS.includes(v.planKind))validation('planKind','Loại gói không hợp lệ');
  if(!Number.isInteger(v.price)||v.price<0||v.price>100000000)validation('price','Giá từ 0 đến 100 triệu VNĐ');
  if(v.planKind==='fixed'){
    if(!Number.isInteger(v.durationDays)||v.durationDays<1||v.durationDays>3650)validation('durationDays','Số ngày từ 1 đến 3650');
    v.basePrice30=v.price;
  } else if(v.planKind==='lifetime'){
    if(v.price===0)validation('price','Gói trọn đời phải có giá lớn hơn 0');
    v.durationDays=LIFETIME_DAYS;v.basePrice30=v.price;
  } else {
    if(!Number.isInteger(v.basePrice30)||v.basePrice30<1000||v.basePrice30>100000000)validation('basePrice30','Đơn giá 30 ngày từ 1.000 đến 100 triệu VNĐ');
    v.price=0;v.durationDays=MIN_CUSTOM_DAYS;
  }
  return {...v,name:v.name.trim(),description:v.description?.trim()||null};
};
const listAdmin=async(req,res)=>{
 try{
  const {status}=req.query;
  if(status!==undefined&&!['active','inactive'].includes(status))validation('status','Trạng thái không hợp lệ');
  const [rows]=await pool.execute(`SELECT * FROM reading_plans ${status?'WHERE status=?':''} ORDER BY id DESC`,status?[status]:[]);
  return success(res,200,'Lấy danh sách gói quản trị thành công',{items:rows.map(planView)});
 }catch(e){return replyError(res,'Danh sách gói quản trị',e);}
};
const getAdmin=async(req,res)=>{
 try{
  const id=posId(req.params.id);if(!id)validation('id','Mã gói không hợp lệ');
  const [[row]]=await pool.execute('SELECT * FROM reading_plans WHERE id=?',[id]);
  if(!row)bad(404,'NOT_FOUND','Không tìm thấy gói đọc');
  return success(res,200,'Lấy chi tiết gói thành công',planView(row));
 }catch(e){return replyError(res,'Chi tiết gói đọc',e);}
};
const ensureUnique=async(conn,b,id)=>{
  if(b.status!=='active')return;
  const [rows]=await conn.execute(`SELECT id FROM reading_plans WHERE status='active'
    AND LOWER(TRIM(name))=LOWER(?) AND id<>? LIMIT 1 FOR UPDATE`,[b.name,id||0]);
  if(rows.length)bad(409,'DUPLICATE_PLAN_NAME','Tên gói đang được sử dụng');
};
const createAdmin=async(req,res)=>{
 try{
  const b=planBody(req.body);
  const row=await withTx(async conn=>{
    await ensureUnique(conn,b,null);
    const [added]=await conn.execute('INSERT INTO reading_plans (name,description,price,duration_days,status,plan_kind,base_price_30) VALUES (?,?,?,?,?,?,?)',
      [b.name,b.description,b.price,b.durationDays,b.status,b.planKind,b.basePrice30]);
    const [[r]]=await conn.execute('SELECT * FROM reading_plans WHERE id=?',[added.insertId]);return planView(r);
  });return success(res,201,'Thêm gói đọc thành công',row);
 }catch(e){return replyError(res,'Thêm gói đọc',e);}
};
const updateAdmin=async(req,res)=>{
 try{
  const id=posId(req.params.id);if(!id)validation('id','Mã gói không hợp lệ');
  const row=await withTx(async conn=>{
    const [[old]]=await conn.execute('SELECT * FROM reading_plans WHERE id=? FOR UPDATE',[id]);
    if(!old)bad(404,'NOT_FOUND','Không tìm thấy gói đọc');
    const b=planBody(req.body,planView(old));await ensureUnique(conn,b,id);
    await conn.execute('UPDATE reading_plans SET name=?,description=?,price=?,duration_days=?,status=?,plan_kind=?,base_price_30=? WHERE id=?',
      [b.name,b.description,b.price,b.durationDays,b.status,b.planKind,b.basePrice30,id]);
    const [[r]]=await conn.execute('SELECT * FROM reading_plans WHERE id=?',[id]);return planView(r);
  });return success(res,200,'Cập nhật gói đọc thành công',row);
 }catch(e){return replyError(res,'Cập nhật gói đọc',e);}
};
const deleteAdmin=async(req,res)=>{
 try{
  const id=posId(req.params.id);if(!id)validation('id','Mã gói không hợp lệ');
  const [r]=await pool.execute("UPDATE reading_plans SET status='inactive' WHERE id=?",[id]);
  if(!r.affectedRows)bad(404,'NOT_FOUND','Không tìm thấy gói đọc');
  return success(res,200,'Đã ngừng bán gói đọc',null);
 }catch(e){return replyError(res,'Ngừng bán gói đọc',e);}
};
module.exports={listPublic,subscribe,mine,listAdmin,getAdmin,createAdmin,updateAdmin,deleteAdmin,
  planBody,planView,subscriptionView,progressivePlanPrice,MIN_CUSTOM_DAYS,LIFETIME_DAYS};
