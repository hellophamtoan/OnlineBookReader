const {pool,success,bad,posId,qty,money,validation,replyError,withTx,claimRequest,finishRequest,audit,sendTransaction} = require('../services/week3.common');
const validStatuses = new Set(['PENDING','PREPARING','SHIPPING','DELIVERED','FAILED','CANCELLED']);
const validateCheckout = b => {
  const errors=[];
  const receiverName=typeof b?.receiverName==='string'?b.receiverName.trim():'';
  const receiverPhone=typeof b?.receiverPhone==='string'?b.receiverPhone.trim():'';
  const shippingAddress=typeof b?.shippingAddress==='string'?b.shippingAddress.trim():'';
  const paymentMethod=b?.paymentMethod;
  const source=b?.source ?? (Array.isArray(b?.items) ? 'cart' : 'all');
  if(!['cart','buy_now','all'].includes(source)) errors.push({field:'source',message:'Nguồn đơn hàng không hợp lệ'});
  if(b?.items !== undefined && (!Array.isArray(b.items) || b.items.length<1 || b.items.length>50))
    errors.push({field:'items',message:'Chọn từ 1 đến 50 sản phẩm'});
  const selected=Array.isArray(b?.items)?b.items.map(i=>({bookId:posId(i?.bookId),quantity:qty(i?.quantity)})):null;
  if(selected && (selected.some(i=>!i.bookId||!i.quantity) || new Set(selected.map(i=>i.bookId)).size!==selected.length))
    errors.push({field:'items',message:'Sách trùng hoặc số lượng không hợp lệ'});
  if(source==='all' && selected)errors.push({field:'source',message:'Đơn toàn bộ giỏ không được gửi items'});
  if(source!=='all' && !selected)errors.push({field:'items',message:'Cần chỉ rõ sách muốn mua'});
  const note=b?.note===undefined || b.note===null ? '' : b.note;
  if(receiverName.length<2 || receiverName.length>100)errors.push({field:'receiverName',message:'Tên người nhận dài 2–100 ký tự'});
  if(!/^0\d{9}$/.test(receiverPhone))errors.push({field:'receiverPhone',message:'Số điện thoại phải gồm 10 chữ số bắt đầu bằng 0'});
  if(shippingAddress.length<10 || shippingAddress.length>255)errors.push({field:'shippingAddress',message:'Địa chỉ dài 10–255 ký tự'});
  if(!['COD','WALLET'].includes(paymentMethod))errors.push({field:'paymentMethod',message:'Phương thức phải là COD hoặc WALLET'});
  if(typeof note!=='string' || note.trim().length>255)errors.push({field:'note',message:'Ghi chú không quá 255 ký tự'});
  if(errors.length)bad(400,'VALIDATION_ERROR','Dữ liệu đặt hàng không hợp lệ',errors);
  return {receiverName,receiverPhone,shippingAddress,paymentMethod,note:note.trim()||null,source,items:selected?.sort((a,b)=>a.bookId-b.bookId)??null};
};
const selectOrder = async (conn,id,userId) => {
  const [rows]=await conn.execute(`SELECT id,status,payment_method AS paymentMethod,payment_status AS paymentStatus,
    total_amount AS totalAmount,shipping_fee AS shippingFee,receiver_name AS receiverName,receiver_phone AS receiverPhone,
    shipping_address AS shippingAddress,note,created_at AS createdAt,updated_at AS updatedAt
    FROM orders WHERE id=? AND user_id=? LIMIT 1`,[id,userId]);
  if(!rows.length)return null;
  const [items]=await conn.execute(`SELECT book_id AS bookId,book_title AS title,quantity,unit_price AS unitPrice,subtotal
    FROM order_items WHERE order_id=? ORDER BY id`,[id]);
  const b=rows[0];return {...b,status:b.status.toUpperCase(),paymentStatus:b.paymentStatus,
    totalAmount:money(b.totalAmount),shippingFee:money(b.shippingFee),items:items.map(i=>({...i,quantity:Number(i.quantity),unitPrice:money(i.unitPrice),subtotal:money(i.subtotal)}))};
};
const create=async(req,res)=>{
 try {
  const body=validateCheckout(req.body);
  const outcome=await withTx(async conn=>{
    const claim=await claimRequest(conn,req,'ORDER_CREATE',body);
    if(claim.replay)return {status:claim.status,body:claim.body};
    // Order/cart mutation for a single USER is serialized using users row lock.
    const [[user]]=await conn.execute('SELECT id,wallet_balance FROM users WHERE id=? FOR UPDATE',[req.user.id]);
    const [cartLines]=await conn.execute('SELECT book_id AS bookId,quantity FROM cart_items WHERE user_id=? ORDER BY book_id',[req.user.id]);
    const lines=body.source==='all'?cartLines:body.items;
    if(!lines.length)bad(400,'EMPTY_CART','Giỏ hàng đang trống');
    if(body.source==='cart'){
      const cart=new Map(cartLines.map(i=>[Number(i.bookId),Number(i.quantity)]));
      for(const line of lines){
        if(!cart.has(line.bookId)||cart.get(line.bookId)<line.quantity)
          bad(409,'CART_CHANGED','Giỏ hàng đã thay đổi; vui lòng tải lại giỏ');
      }
    }
    const items=[];
    // Lock books in ascending PK order; prevent overselling with conditional UPDATE below.
    for(const line of lines){
      const [[b]]=await conn.execute(`SELECT id,title,price,stock,has_physical AS hasPhysical,status
        FROM books WHERE id=? FOR UPDATE`,[line.bookId]);
      if(!b || b.status!=='active'||!b.hasPhysical||b.price===null||Number(b.stock)<Number(line.quantity))
        bad(409,'OUT_OF_STOCK',`Sách không còn đủ hàng: ${b?.title||'#'+line.bookId}`);
      const unitPrice=money(b.price),quantity=Number(line.quantity);
      if(quantity<1||quantity>99)bad(409,'OUT_OF_STOCK','Số lượng vượt giới hạn');
      items.push({bookId:b.id,title:b.title,quantity,unitPrice,subtotal:unitPrice*quantity});
    }
    const total=items.reduce((a,b)=>a+b.subtotal,0);
    if(!Number.isSafeInteger(total)||total>9999999999)bad(400,'VALIDATION_ERROR','Giá trị đơn hàng vượt giới hạn');
    if(body.paymentMethod==='WALLET' && money(user.wallet_balance)<total)
      bad(400,'INSUFFICIENT_BALANCE','Số dư ví không đủ để thanh toán đơn hàng');
    const [insert]=await conn.execute(`INSERT INTO orders (user_id,status,payment_method,payment_status,total_amount,shipping_fee,
      receiver_name,receiver_phone,shipping_address,note) VALUES (?,'PENDING',?,?,?,?,?,?,?,?)`,
      [req.user.id,body.paymentMethod,body.paymentMethod==='WALLET'?'PAID':'UNPAID',total,0,
      body.receiverName,body.receiverPhone,body.shippingAddress,body.note]);
    const orderId=insert.insertId;
    for(const i of items){
      await conn.execute(`INSERT INTO order_items (order_id,book_id,book_title,quantity,unit_price,subtotal)
        VALUES (?,?,?,?,?,?)`,[orderId,i.bookId,i.title,i.quantity,i.unitPrice,i.subtotal]);
      const [stock]=await conn.execute('UPDATE books SET stock=stock-? WHERE id=? AND stock>=?',
        [i.quantity,i.bookId,i.quantity]);
      if(stock.affectedRows!==1)bad(409,'OUT_OF_STOCK',`Sách không đủ hàng: ${i.title}`);
    }
    if(body.paymentMethod==='WALLET' && total>0){
      const [paid]=await conn.execute('UPDATE users SET wallet_balance=wallet_balance-? WHERE id=? AND wallet_balance>=?',
        [total,req.user.id,total]);
      if(paid.affectedRows!==1)bad(400,'INSUFFICIENT_BALANCE','Số dư ví không đủ');
      const [[balance]]=await conn.execute('SELECT wallet_balance FROM users WHERE id=?',[req.user.id]);
      await conn.execute(`INSERT INTO wallet_transactions (user_id,type,amount,balance_after,ref_type,ref_id,note)
        VALUES (?,'PAY_ORDER',?,?, 'ORDER',?,?)`,[req.user.id,-total,money(balance.wallet_balance),orderId,`Thanh toán đơn #${orderId}`]);
    }
    // Mua ngay: không động vào giỏ. Đặt sách đã chọn: chỉ trừ các dòng đã mua.
    if(body.source==='all')await conn.execute('DELETE FROM cart_items WHERE user_id=?',[req.user.id]);
    if(body.source==='cart'){
      for(const line of lines){
        const [updated]=await conn.execute('UPDATE cart_items SET quantity=quantity-? WHERE user_id=? AND book_id=? AND quantity>=?',
          [line.quantity,req.user.id,line.bookId,line.quantity]);
        if(updated.affectedRows!==1)bad(409,'CART_CHANGED','Giỏ hàng đã thay đổi');
        await conn.execute('DELETE FROM cart_items WHERE user_id=? AND book_id=? AND quantity=0',[req.user.id,line.bookId]);
      }
    }
    await audit(conn,req.user.id,'ORDER_CREATE','ORDER',orderId,{paymentMethod:body.paymentMethod,total});
    const order=await selectOrder(conn,orderId,req.user.id);
    return finishRequest(conn,claim,201,'Đặt hàng thành công',{order});
  });
  return sendTransaction(res,outcome);
 }catch(e){return replyError(res,'Đặt hàng',e);}
};
const list=async(req,res)=>{
 try {
  const {status}=req.query;
  if(status!==undefined && !validStatuses.has(status))validation('status','Trạng thái không hợp lệ');
  const page=req.query.page===undefined?1:posId(req.query.page),limit=req.query.limit===undefined?12:posId(req.query.limit);
  if(!page||!limit||limit>50)validation('page','page phải >=1 và limit từ 1 đến 50');
  const where=status?'user_id=? AND status=?':'user_id=?';const args=status?[req.user.id,status]:[req.user.id];
  const [[{n}]]=await pool.execute(`SELECT COUNT(*) AS n FROM orders WHERE ${where}`,args);
  const offset=(page-1)*limit;
  const [ids]=await pool.query(`SELECT id FROM orders WHERE ${where} ORDER BY created_at DESC,id DESC LIMIT ? OFFSET ?`,[...args,limit,offset]);
  const items=[];for(const row of ids)items.push(await selectOrder(pool,row.id,req.user.id));
  return success(res,200,'Lấy danh sách đơn hàng thành công',{items,page,limit,total:Number(n),totalPages:Math.max(1,Math.ceil(Number(n)/limit))});
 }catch(e){return replyError(res,'Danh sách đơn hàng',e);}
};
const detail=async(req,res)=>{
 try {const id=posId(req.params.id);if(!id)validation('id','Mã đơn hàng không hợp lệ');
  const order=await selectOrder(pool,id,req.user.id);
  if(!order)bad(404,'NOT_FOUND','Không tìm thấy đơn hàng');
  return success(res,200,'Lấy chi tiết đơn hàng thành công',{order});
 }catch(e){return replyError(res,'Chi tiết đơn hàng',e);}
};
const cancel=async(req,res)=>{
 try {const id=posId(req.params.id);if(!id)validation('id','Mã đơn hàng không hợp lệ');
  const order=await withTx(async conn=>{
    // Lock user before order to maintain same lock order as create.
    const [[user]]=await conn.execute('SELECT id FROM users WHERE id=? FOR UPDATE',[req.user.id]);
    if(!user)bad(404,'NOT_FOUND','Không tìm thấy tài khoản');
    const [[row]]=await conn.execute('SELECT id,status,payment_method,payment_status,total_amount FROM orders WHERE id=? AND user_id=? FOR UPDATE',[id,req.user.id]);
    if(!row)bad(404,'NOT_FOUND','Không tìm thấy đơn hàng');
    if(row.status!=='PENDING')bad(409,'INVALID_STATUS_TRANSITION','Chỉ có thể hủy đơn đang chờ xác nhận');
    const [lines]=await conn.execute('SELECT book_id,quantity FROM order_items WHERE order_id=? ORDER BY book_id',[id]);
    for(const line of lines){await conn.execute('SELECT id FROM books WHERE id=? FOR UPDATE',[line.book_id]);
      await conn.execute('UPDATE books SET stock=stock+? WHERE id=?',[line.quantity,line.book_id]);}
    if(row.payment_method==='WALLET' && row.payment_status==='PAID' && money(row.total_amount)>0){
      const amount=money(row.total_amount);
      await conn.execute('UPDATE users SET wallet_balance=wallet_balance+? WHERE id=?',[amount,req.user.id]);
      const [[updated]]=await conn.execute('SELECT wallet_balance FROM users WHERE id=?',[req.user.id]);
      await conn.execute(`INSERT INTO wallet_transactions (user_id,type,amount,balance_after,ref_type,ref_id,note)
        VALUES (?,'REFUND',?,?, 'ORDER',?,?)`,[req.user.id,amount,money(updated.wallet_balance),id,`Hoàn tiền đơn #${id}`]);
    }
    await conn.execute("UPDATE orders SET status='CANCELLED',payment_status=IF(payment_method='WALLET' AND payment_status='PAID','REFUNDED',payment_status) WHERE id=?",[id]);
    await audit(conn,req.user.id,'ORDER_CANCEL','ORDER',id);
    return selectOrder(conn,id,req.user.id);
  });
  return success(res,200,'Đã hủy đơn hàng',{order});
 }catch(e){return replyError(res,'Hủy đơn hàng',e);}
};
module.exports={create,list,detail,cancel,validateCheckout,selectOrder};
