// utils/response.js
// Chuan hoa format tra ve cho tat ca API, tranh moi controller tu bay ra 1 kieu.

const success = (res, statusCode, message, data = {}) => {
  return res.status(statusCode).json({ success: true, message, ...data });
};

const fail = (res, statusCode, message) => {
  return res.status(statusCode).json({ success: false, message });
};

const serverError = (res, context, error) => {
  console.error(`[${context}]`, error);
  return res.status(500).json({ success: false, message: 'Da co loi xay ra, vui long thu lai sau' });
};

module.exports = { success, fail, serverError };
