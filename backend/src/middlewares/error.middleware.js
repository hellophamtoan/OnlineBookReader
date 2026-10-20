// middlewares/error.middleware.js
// Bắt lỗi tập trung. Phải đăng ký SAU tất cả route trong server.js.

const notFound = (req, res) => {
  res.status(404).json({ success: false, message: 'Không tìm thấy đường dẫn này' });
};

// Express nhận diện error handler nhờ đủ 4 tham số (err, req, res, next)
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  // Body JSON gửi lên bị sai cú pháp
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, message: 'Dữ liệu JSON không hợp lệ' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(400).json({ success: false, message: 'Dữ liệu gửi lên quá lớn' });
  }

  console.error('[errorHandler]', err);
  res.status(500).json({ success: false, message: 'Đã có lỗi xảy ra, vui lòng thử lại sau' });
};

module.exports = { notFound, errorHandler };
