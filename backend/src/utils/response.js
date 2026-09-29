// utils/response.js
// Chuẩn hóa format trả về: { success, message, data }.
// Dữ liệu luôn nằm trong "data" (object hoặc mảng đều an toàn).

const success = (res, statusCode, message, data = null) => {
  return res.status(statusCode).json({ success: true, message, data });
};

const fail = (res, statusCode, message) => {
  return res.status(statusCode).json({ success: false, message });
};

const serverError = (res, context, error) => {
  console.error(`[${context}]`, error);
  return res
    .status(500)
    .json({ success: false, message: 'Đã có lỗi xảy ra, vui lòng thử lại sau' });
};

module.exports = { success, fail, serverError };
