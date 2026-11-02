// Standard response compatible with week 1/2 (code/errors are optional).
const success = (res, statusCode, message, data = {}) => res.status(statusCode).json({ success: true, message, data });
const fail = (res, statusCode, message, code, errors) => res.status(statusCode).json({
  success: false, message,
  ...(code ? { code } : {}),
  ...(errors && errors.length ? { errors } : {}),
});
const serverError = (res, context, error) => {
  console.error(`[${context}]`, error);
  return fail(res, 500, 'Đã có lỗi xảy ra, vui lòng thử lại sau', 'INTERNAL_ERROR');
};
module.exports = { success, fail, serverError };
