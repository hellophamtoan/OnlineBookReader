const { pool, success, bad, posId, qty, money, validation, replyError, withTx } = require('../services/week3.common');
const MAX_QTY = 99;
const cartData = async (executor, userId) => {
  const [rows] = await executor.execute(
    `SELECT ci.book_id AS bookId, ci.quantity, b.title, b.cover_url AS coverUrl,
            b.price AS price, b.stock, b.status, b.has_physical AS hasPhysical
     FROM cart_items ci LEFT JOIN books b ON b.id=ci.book_id WHERE ci.user_id=? ORDER BY ci.id`, [userId]);
  const items = rows.map(b => {
    const unitPrice = b.price === null ? 0 : money(b.price);
    const stockQuantity = Number(b.stock || 0);
    return { bookId:b.bookId, title:b.title ?? 'Sách không còn tồn tại',coverUrl:b.coverUrl,
      unitPrice, quantity:Number(b.quantity),stockQuantity,
      available:b.status === 'active' && !!b.hasPhysical && b.price !== null && stockQuantity >= Number(b.quantity),
      subtotal:unitPrice * Number(b.quantity) };
  });
  return {items, totalAmount:items.reduce((v,b)=>v+b.subtotal,0),canCheckout:items.length>0 && items.every(i=>i.available)};
};
const read = async (req,res) => { try { return success(res,200,'Lấy giỏ hàng thành công',await cartData(pool,req.user.id)); } catch(e) {return replyError(res,'Lấy giỏ hàng',e);} };
const add = async (req,res) => {
  try {
    const id=posId(req.body?.bookId), n=qty(req.body?.quantity);
    if(!id) validation('bookId','Mã sách không hợp lệ');
    if(!n) validation('quantity',`Số lượng phải là số nguyên từ 1 đến ${MAX_QTY}`);
    const data = await withTx(async conn => {
      await conn.execute('SELECT id FROM users WHERE id=? FOR UPDATE',[req.user.id]);
      const [[book]] = await conn.execute('SELECT id,stock,price,status,has_physical FROM books WHERE id=? FOR UPDATE',[id]);
      if(!book || book.status!=='active') bad(404,'NOT_FOUND','Sách không tồn tại hoặc đã ngừng bán');
      if(!book.has_physical || book.price === null) validation('bookId','Sách này chỉ có bản e-book, không thể đặt mua');
      const [[line]] = await conn.execute('SELECT quantity FROM cart_items WHERE user_id=? AND book_id=?',[req.user.id,id]);
      const combined = Number(line?.quantity||0)+n;
      if(combined>MAX_QTY || combined>Number(book.stock)) bad(409,'OUT_OF_STOCK','Số lượng vượt tồn kho hoặc giới hạn 99 cuốn');
      await conn.execute(`INSERT INTO cart_items (user_id,book_id,quantity) VALUES (?,?,?)
        ON DUPLICATE KEY UPDATE quantity=VALUES(quantity)+quantity`,[req.user.id,id,n]);
      return cartData(conn,req.user.id);
    });
    return success(res,200,'Đã thêm vào giỏ hàng',data);
  } catch(e) {return replyError(res,'Thêm giỏ hàng',e);}
};
const update = async(req,res)=>{
  try {
    const id=posId(req.params.bookId),n=qty(req.body?.quantity);
    if(!id) validation('bookId','Mã sách không hợp lệ');
    if(!n) validation('quantity','Số lượng phải là số nguyên từ 1 đến 99');
    const data=await withTx(async conn=>{
      await conn.execute('SELECT id FROM users WHERE id=? FOR UPDATE',[req.user.id]);
      const [[line]]=await conn.execute('SELECT id FROM cart_items WHERE user_id=? AND book_id=?',[req.user.id,id]);
      if(!line) bad(404,'NOT_FOUND','Sách không có trong giỏ hàng');
      const [[book]]=await conn.execute('SELECT stock,status,has_physical FROM books WHERE id=? FOR UPDATE',[id]);
      if(!book || book.status!=='active' || !book.has_physical || Number(book.stock)<n) bad(409,'OUT_OF_STOCK','Sách ngừng bán hoặc không đủ tồn kho');
      await conn.execute('UPDATE cart_items SET quantity=? WHERE id=?',[n,line.id]);
      return cartData(conn,req.user.id);
    });
    return success(res,200,'Đã cập nhật giỏ hàng',data);
  } catch(e) {return replyError(res,'Cập nhật giỏ hàng',e);}
};
const remove=async(req,res)=>{
 try {
  const id=posId(req.params.bookId);if(!id) validation('bookId','Mã sách không hợp lệ');
  const data=await withTx(async conn=>{
    await conn.execute('SELECT id FROM users WHERE id=? FOR UPDATE',[req.user.id]);
    const [result]=await conn.execute('DELETE FROM cart_items WHERE user_id=? AND book_id=?',[req.user.id,id]);
    if(!result.affectedRows) bad(404,'NOT_FOUND','Sách không có trong giỏ hàng');
    return cartData(conn,req.user.id);
  });return success(res,200,'Đã xóa khỏi giỏ hàng',data);
 }catch(e){return replyError(res,'Xóa dòng giỏ hàng',e);}
};
const clear=async(req,res)=>{
 try {const data=await withTx(async conn=>{
   await conn.execute('SELECT id FROM users WHERE id=? FOR UPDATE',[req.user.id]);
   await conn.execute('DELETE FROM cart_items WHERE user_id=?',[req.user.id]);
   return {items:[],totalAmount:0,canCheckout:false};
 });return success(res,200,'Đã làm rỗng giỏ hàng',data);}catch(e){return replyError(res,'Làm rỗng giỏ hàng',e);}
};
module.exports={read,add,update,remove,clear,cartData};
