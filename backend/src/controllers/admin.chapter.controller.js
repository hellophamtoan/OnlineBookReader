const pool = require('../config/db.config');
const { success, fail, serverError } = require('../utils/response');
const { isPositiveInt, isNonEmptyString } = require('../utils/validators');
const { sanitizeChapterContent } = require('../utils/sanitize');

const MAX_CONTENT = 2000000; // ký tự

const parseChapterBody = (body) => {
  const b = body || {};
  if (!isPositiveInt(b.chapterNumber)) return { error: 'Số chương phải là số nguyên dương' };
  if (!isNonEmptyString(b.title) || b.title.trim().length > 255) return { error: 'Tên chương là bắt buộc và không vượt quá 255 ký tự' };
  if (!isNonEmptyString(b.content) || b.content.length > MAX_CONTENT) return { error: 'Nội dung chương là bắt buộc (tối đa 2.000.000 ký tự)' };
  const content = sanitizeChapterContent(b.content);
  if (!content.trim()) return { error: 'Nội dung chương không hợp lệ' };
  return { value: { chapterNumber: Number(b.chapterNumber), title: b.title.trim(), content } };
};

// UC007 - Mục lục chương của một sách (Admin)
const listChapters = async (req, res) => {
  try {
    if (!isPositiveInt(req.params.bookId)) return fail(res, 400, 'Mã sách không hợp lệ');
    const [books] = await pool.execute('SELECT id, title FROM books WHERE id = ? LIMIT 1', [Number(req.params.bookId)]);
    if (!books.length) return fail(res, 404, 'Không tìm thấy sách');
    const [items] = await pool.execute(
      'SELECT id, chapter_number AS chapterNumber, title FROM chapters WHERE book_id = ? ORDER BY chapter_number', [books[0].id]
    );
    return success(res, 200, 'Lấy danh sách chương thành công', { book: books[0], items });
  } catch (error) {
    return serverError(res, 'Lấy danh sách chương (admin)', error);
  }
};

// Lấy đủ nội dung một chương để Admin chỉnh sửa
const getChapter = async (req, res) => {
  try {
    if (!isPositiveInt(req.params.id)) return fail(res, 400, 'Mã chương không hợp lệ');
    const [rows] = await pool.execute(
      'SELECT id, book_id AS bookId, chapter_number AS chapterNumber, title, content FROM chapters WHERE id = ? LIMIT 1', [Number(req.params.id)]
    );
    if (!rows.length) return fail(res, 404, 'Không tìm thấy chương');
    return success(res, 200, 'Lấy chương thành công', rows[0]);
  } catch (error) {
    return serverError(res, 'Lấy chương (admin)', error);
  }
};

const createChapter = async (req, res) => {
  try {
    if (!isPositiveInt(req.params.bookId)) return fail(res, 400, 'Mã sách không hợp lệ');
    const { error, value } = parseChapterBody(req.body);
    if (error) return fail(res, 400, error);
    const [books] = await pool.execute('SELECT id, has_ebook FROM books WHERE id = ? LIMIT 1', [Number(req.params.bookId)]);
    if (!books.length) return fail(res, 404, 'Không tìm thấy sách');
    if (!books[0].has_ebook) return fail(res, 400, 'Sách này chưa bật hình thức e-book');
    const [result] = await pool.execute(
      'INSERT INTO chapters (book_id, chapter_number, title, content) VALUES (?, ?, ?, ?)',
      [books[0].id, value.chapterNumber, value.title, value.content]
    );
    return success(res, 201, 'Thêm chương thành công', {
      id: result.insertId, bookId: books[0].id, chapterNumber: value.chapterNumber, title: value.title
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') return fail(res, 409, 'Số chương này đã tồn tại trong sách');
    return serverError(res, 'Thêm chương', error);
  }
};

const updateChapter = async (req, res) => {
  try {
    if (!isPositiveInt(req.params.id)) return fail(res, 400, 'Mã chương không hợp lệ');
    const { error, value } = parseChapterBody(req.body);
    if (error) return fail(res, 400, error);
    const [rows] = await pool.execute('SELECT id, book_id FROM chapters WHERE id = ? LIMIT 1', [Number(req.params.id)]);
    if (!rows.length) return fail(res, 404, 'Không tìm thấy chương');
    await pool.execute(
      'UPDATE chapters SET chapter_number = ?, title = ?, content = ? WHERE id = ?',
      [value.chapterNumber, value.title, value.content, rows[0].id]
    );
    return success(res, 200, 'Cập nhật chương thành công', {
      id: rows[0].id, bookId: rows[0].book_id, chapterNumber: value.chapterNumber, title: value.title
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') return fail(res, 409, 'Số chương này đã tồn tại trong sách');
    return serverError(res, 'Cập nhật chương', error);
  }
};

// Chương không có cột status nên xóa thật; chương đang có tiến trình đọc thì bị FK chặn -> 409
const deleteChapter = async (req, res) => {
  try {
    if (!isPositiveInt(req.params.id)) return fail(res, 400, 'Mã chương không hợp lệ');
    const [rows] = await pool.execute('SELECT id FROM chapters WHERE id = ? LIMIT 1', [Number(req.params.id)]);
    if (!rows.length) return fail(res, 404, 'Không tìm thấy chương');
    await pool.execute('DELETE FROM chapters WHERE id = ?', [rows[0].id]);
    return success(res, 200, 'Xóa chương thành công', null);
  } catch (error) {
    if (error.code === 'ER_ROW_IS_REFERENCED_2') {
      return fail(res, 409, 'Chương đang có tiến trình đọc của người dùng, không thể xóa');
    }
    return serverError(res, 'Xóa chương', error);
  }
};

module.exports = { listChapters, getChapter, createChapter, updateChapter, deleteChapter, parseChapterBody };
