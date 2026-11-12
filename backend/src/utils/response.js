// Standard response compatible with week 1/2 (code/errors are optional).
// [Backend] Trả response thành công { success, message, data }.
const success = (res, statusCode, message, data = {}) => res.status(statusCode).json({ success: true, message, data });
// [Backend] Trả response lỗi { success:false, message }; frontend hiển thị message này.
const fail = (res, statusCode, message, code, errors) => res.status(statusCode).json({
  success: false, message,
  ...(code ? { code } : {}),
  ...(errors && errors.length ? { errors } : {}),
});
// [Backend] Ghi log và trả lỗi 500.
const serverError = (res, context, error) => {
  console.error(`[${context}]`, error);
  return fail(res, 500, 'Đã có lỗi xảy ra, vui lòng thử lại sau', 'INTERNAL_ERROR');
};
module.exports = { success, fail, serverError };
