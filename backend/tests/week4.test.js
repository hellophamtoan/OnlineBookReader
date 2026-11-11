jest.mock('../src/config/db.config',()=>({execute:jest.fn(),query:jest.fn(),getConnection:jest.fn()}));
const pool=require('../src/config/db.config');
const w=require('../src/controllers/week4.controller');
const res=()=>({status:jest.fn().mockReturnThis(),json:jest.fn().mockReturnThis()});
beforeEach(()=>jest.clearAllMocks());
test('Ngày không tồn tại và phân trang sai bị từ chối',()=>{expect(()=>w.range({from:'2026-02-30'})).toThrow();expect(()=>w.range({from:'2026-11-01',to:'2026-10-01'})).toThrow();expect(()=>w.paging({limit:'101'})).toThrow();});
test('Không cho tự khóa',async()=>{const r=res();await w.lock(false)({params:{id:'1'},user:{id:1}},r);expect(r.status).toHaveBeenCalledWith(400);expect(pool.getConnection).not.toHaveBeenCalled();});
test('Hủy đơn ví hoàn kho, hoàn tiền, log và commit cùng connection',async()=>{const c={beginTransaction:jest.fn(),commit:jest.fn(),rollback:jest.fn(),release:jest.fn(),execute:jest.fn()};pool.getConnection.mockResolvedValue(c);c.execute.mockResolvedValueOnce([[{user_id:2}]]).mockResolvedValueOnce([[{id:2}]]).mockResolvedValueOnce([[{id:3,user_id:2,status:'PENDING',payment_method:'WALLET',payment_status:'PAID',total_amount:100}]]).mockResolvedValueOnce([[{book_id:8,quantity:2}]]).mockResolvedValueOnce([{}]).mockResolvedValueOnce([{}]).mockResolvedValueOnce([[{wallet_balance:150}]]).mockResolvedValueOnce([{}]).mockResolvedValueOnce([{}]).mockResolvedValueOnce([{}]).mockResolvedValueOnce([[{id:3,status:'CANCELLED',paymentStatus:'REFUNDED'}]]);const r=res();await w.change({params:{id:'3'},body:{status:'CANCELLED'},user:{id:1}},r);expect(r.status).toHaveBeenCalledWith(200);expect(c.commit).toHaveBeenCalledTimes(1);expect(c.execute.mock.calls.some(([sql,args])=>sql.includes('stock=stock+')&&args[0]===2)).toBe(true);expect(c.execute.mock.calls.some(([sql,args])=>sql.includes('wallet_balance=wallet_balance+')&&args[0]===100)).toBe(true);expect(c.release).toHaveBeenCalled();});
test('Đơn đã hủy không hoàn tiền lần hai',async()=>{const c={beginTransaction:jest.fn(),commit:jest.fn(),rollback:jest.fn(),release:jest.fn(),execute:jest.fn()};pool.getConnection.mockResolvedValue(c);c.execute.mockResolvedValueOnce([[{user_id:2}]]).mockResolvedValueOnce([[{id:2}]]).mockResolvedValueOnce([[{status:'CANCELLED'}]]);const r=res();await w.change({params:{id:'3'},body:{status:'CANCELLED'},user:{id:1}},r);expect(r.status).toHaveBeenCalledWith(409);expect(c.rollback).toHaveBeenCalled();expect(c.commit).not.toHaveBeenCalled();expect(c.execute).toHaveBeenCalledTimes(3);});
test('Báo cáo chỉ ghi nhận đơn đã giao và tiền gói, có kỳ trước và theo hình thức thanh toán',async()=>{
  // Trả dữ liệu theo câu SQL: kỳ này (00:00 ngày 01/10 giờ VN = 30/09 17:00 UTC) và kỳ trước
  pool.execute.mockImplementation(async(sql,args)=>{
    const cur=args&&args[0]==='2026-09-30 17:00:00';
    if(sql.includes('FROM orders WHERE created_at'))return [cur?[{status:'DELIVERED',paymentMethod:'COD',amount:100},{status:'DELIVERED',paymentMethod:'WALLET',amount:50},{status:'CANCELLED',paymentMethod:'COD',amount:90}]:[{status:'DELIVERED',paymentMethod:'COD',amount:60}]];
    if(sql.includes('FROM subscriptions WHERE created_at'))return [cur?[{amount:20,planType:'fixed'}]:[]];
    if(sql.includes('SUM(oi.quantity)'))return [[{n:cur?3:1}]];
    if(sql.includes('FROM users'))return [[{newUsers:1,activeUsers:2}]];
    return [[{n:1}]];
  });
  const r=res();await w.overview({query:{from:'2026-10-01',to:'2026-10-31'}},r);
  const d=r.json.mock.calls[0][0].data;
  expect(d.revenue).toEqual({orderRevenue:150,planRevenue:20,total:170});
  expect(d.previousPeriod).toMatchObject({from:'2026-09-01',to:'2026-09-30',grossRevenue:60,deliveredOrders:1});
  expect(d.metrics).toMatchObject({deliveredOrders:2,cancelledOrders:1,productsSold:3,avgOrderValue:75});
  expect(d.paymentMethods).toEqual([{method:'COD',orderCount:1,revenue:100},{method:'WALLET',orderCount:1,revenue:50}]);
  pool.execute.mockReset();
});
test('Ngày báo cáo tính theo giờ Việt Nam',()=>{expect(w.bound('2026-11-01')).toBe('2026-10-31 17:00:00');expect(w.label(new Date('2026-10-31T18:00:00Z'),'day')).toBe('2026-11-01');});
test('Tất cả API mới được bảo vệ bởi ADMIN middleware',()=>{const routes=require('../src/routes/admin.routes');const guards=routes.stack.filter(l=>!l.route&&l.name!=='router');expect(guards[0].name).toBe('verifyToken');expect(guards.length).toBeGreaterThanOrEqual(2);const paths=routes.stack.filter(l=>l.route).map(l=>l.route.path);expect(paths).toContain('/reports/overview');expect(paths).toContain('/users/:id/lock');});
