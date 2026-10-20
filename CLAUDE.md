# OnlineBookReader – Website bán sách và đăng ký gói đọc

## Bối cảnh
Đồ án Project 1, Khoa CNTT, ĐH Giao thông vận tải. GVHD: TS. Nguyễn Trọng Phúc.
Nhóm: Phạm Quốc Toản (Backend/DB), Nguyễn Văn Hà (Frontend).
Thời gian: 2 sprint x 1 tuần (Scrum, Trello). Tài liệu gốc: docs/SRS (12 UC + UC013 Nạp ví).
Repo: github.com/hellophamtoan/OnlineBookReader

## Tech stack
- FE: React 18 + TypeScript + Vite (cổng 3000), react-router-dom, Recharts
- BE: Node.js + Express (cổng 5000), mysql2 (pool), jsonwebtoken, bcrypt, cors, dotenv
- DB: MySQL, tên DB online_book_reader, migration chạy tay trong backend/database/migrations
- Test: Postman (API), k6 (50 user), Lighthouse

## Cấu trúc thực tế của repo
backend/src/{config,controllers,middlewares,routes,utils}, server.js
  - Thêm thư mục services/ CHỈ cho logic nhiều bước cần transaction (orders, subscriptions, wallet)
backend/database/migrations/NNN_ten.sql (đánh số tăng dần), backend/database/seed.sql
frontend/src/{assets,components,pages,services,layouts,context,hooks,utils}, App.tsx, main.tsx
docs/ (SRS, API.md, ERD)

## Quy ước
- Tên biến/hàm/bảng/cột: tiếng Anh. Comment: tiếng Việt. Message trả cho người dùng: tiếng Việt CÓ DẤU.
- BE: camelCase (code), snake_case (bảng/cột). Endpoint /api/<module>/...
- Response: { success, message, data }. Lỗi: { success:false, message }.
- Mã HTTP: 400 dữ liệu sai, 401 chưa đăng nhập/token sai, 403 không đủ quyền hoặc gói hết hạn/tài khoản bị khóa,
  404 không tìm thấy, 409 xung đột (email trùng, hết hàng).
- Luôn truy vấn tham số hóa (dấu ?), không nối chuỗi SQL. Controller mỏng, dùng utils/response.js.
- Role chỉ có 2 giá trị: 'USER' và 'ADMIN' (dùng ROLES trong utils/constants.js).
- FE: function component + hooks; gọi API qua services/, không fetch trực tiếp trong component;
  route bảo vệ theo role (components/ProtectedRoute); token lưu localStorage, tự đăng xuất khi API trả 401.

## Quy tắc nghiệp vụ (bắt buộc)
1. Mật khẩu bcrypt; không bao giờ trả password_hash ra API.
2. Tài khoản bị khóa (is_active = false) không đăng nhập được VÀ token cũ không dùng được
   (verifyToken kiểm tra trạng thái trong DB).
3. Xóa mềm sách/danh mục/gói: status = 'inactive', không DELETE.
4. Đặt hàng dùng transaction: kiểm tra và trừ tồn kho; hủy đơn thì hoàn kho và hoàn tiền nếu đã trả bằng ví.
5. Trạng thái đơn: pending -> preparing -> shipping -> delivered | failed | cancelled.
6. Thanh toán: sách giấy = COD hoặc ví; gói đọc = chỉ ví. Mọi biến động ví ghi vào wallet_transactions,
   cập nhật users.wallet_balance trong CÙNG transaction. Không cho số dư âm.
7. Gói đọc: mỗi lần mua là 1 bản ghi subscriptions, lưu snapshot giá và số ngày. Mua khi còn hạn thì cộng dồn:
   start = max(now, end_date lớn nhất hiện có); end = start + thời hạn gói.
8. Quyền đọc e-book = có subscription với start <= now <= end, kiểm tra ở backend.
9. E-book lưu theo chương (bảng chapters, nội dung text/HTML). API chỉ trả từng chương.
10. Tiến trình đọc: (user_id, book_id, chapter_id, scroll_percent) + font/cỡ chữ ưa thích.
11. Ghi log: đặt hàng, đăng ký gói, đổi trạng thái đơn, khóa/mở khóa tài khoản (bảng audit_logs).
12. Làm sạch nội dung chương khi hiển thị (chống XSS); không dùng dangerouslySetInnerHTML với dữ liệu chưa làm sạch.

## Ngoài phạm vi
Cổng thanh toán thật, API vận chuyển, email/SMS, app mobile, đọc offline.

## Git
- Nhánh: main (ổn định, chỉ merge từ develop), develop (tích hợp), feature/<module>-<mô-tả>.
- Commit: feat: | fix: | docs: | refactor: | test: + mô tả ngắn. Không commit .env.
- Mỗi module bàn giao kèm mục trong docs/API.md (đường dẫn, body, response, mã lỗi) để FE làm song song.

## Cách Claude hỗ trợ
- Trả lời tiếng Việt, ngắn gọn; code chạy được, ghi rõ đường dẫn file.
- Trước khi viết module, đối chiếu UC trong SRS và các quy tắc nghiệp vụ trên; nếu mâu thuẫn thì nêu rõ, không tự đổi.
- Endpoint mới kèm ví dụ Postman, validate và phân quyền.
- Ưu tiên giải pháp đơn giản cho đồ án 2 tuần; đề xuất cắt bớt thay vì làm dở.
