const pool = require('../config/db.config');
const { success, fail, serverError } = require('../utils/response');
const { isPositiveInt } = require('../utils/validators');

// Chỉ trả sách còn hoạt động; nội dung đọc lấy từ reading_progress của chính USER.
const listRows = async (userId, readingOnly = false) => {
  const [books] = readingOnly
    ? await pool.execute(
      `SELECT b.id, b.title, b.cover_url AS coverUrl, b.has_ebook AS hasEbook,
              rp.updated_at AS addedAt, c.chapter_number AS lastChapterNumber,
              c.title AS lastChapterTitle
       FROM reading_progress rp
       JOIN books b ON b.id = rp.book_id AND b.status = 'active'
       LEFT JOIN chapters c ON c.id = rp.chapter_id
       WHERE rp.user_id = ? ORDER BY rp.updated_at DESC, b.id DESC`, [userId]
    )
    : await pool.execute(
      `SELECT b.id, b.title, b.cover_url AS coverUrl, b.has_ebook AS hasEbook,
              ul.added_at AS addedAt, c.chapter_number AS lastChapterNumber,
              c.title AS lastChapterTitle
       FROM user_library ul
       JOIN books b ON b.id = ul.book_id AND b.status = 'active'
       LEFT JOIN reading_progress rp ON rp.book_id = b.id AND rp.user_id = ul.user_id
       LEFT JOIN chapters c ON c.id = rp.chapter_id
       WHERE ul.user_id = ? ORDER BY ul.added_at DESC, b.id DESC`, [userId]
    );
  if (!books.length) return [];
  const ids = books.map(b => b.id);
  const [authors] = await pool.query(
    `SELECT ba.book_id AS bookId, a.id, a.name
     FROM book_authors ba JOIN authors a ON a.id = ba.author_id
     WHERE a.status = 'active' AND ba.book_id IN (${ids.map(() => '?').join(',')})
     ORDER BY a.name`, ids
  );
  const authorMap = new Map();
  for (const a of authors) {
    if (!authorMap.has(a.bookId)) authorMap.set(a.bookId, []);
    authorMap.get(a.bookId).push({ id: a.id, name: a.name });
  }
  return books.map(b => ({ ...b, hasEbook: Boolean(b.hasEbook), authors: authorMap.get(b.id) || [] }));
};

const listLibrary = async (req, res) => {
  try {
    const items = await listRows(req.user.id);
    return success(res, 200, 'Lấy thư viện cá nhân thành công', { items });
  } catch (error) { return serverError(res, 'Lấy thư viện cá nhân', error); }
};

const listReading = async (req, res) => {
  try {
    const items = await listRows(req.user.id, true);
    return success(res, 200, 'Lấy danh sách sách đang đọc thành công', { items });
  } catch (error) { return serverError(res, 'Lấy sách đang đọc', error); }
};

const getBookId = req => isPositiveInt(req.params.bookId) ? Number(req.params.bookId) : null;

const bookExists = async bookId => {
  const [rows] = await pool.execute("SELECT id FROM books WHERE id = ? AND status = 'active' LIMIT 1", [bookId]);
  return rows.length > 0;
};

const addBook = async (req, res) => {
  try {
    const bookId = getBookId(req);
    if (!bookId) return fail(res, 400, 'Mã sách không hợp lệ');
    if (!await bookExists(bookId)) return fail(res, 404, 'Không tìm thấy sách');
    // Unique(user_id,book_id) giúp nhấn lưu liên tiếp không tạo dữ liệu trùng.
    await pool.execute('INSERT IGNORE INTO user_library (user_id, book_id) VALUES (?, ?)', [req.user.id, bookId]);
    return success(res, 200, 'Đã thêm sách vào thư viện', { bookId, inLibrary: true });
  } catch (error) { return serverError(res, 'Thêm sách vào thư viện', error); }
};

const removeBook = async (req, res) => {
  try {
    const bookId = getBookId(req);
    if (!bookId) return fail(res, 400, 'Mã sách không hợp lệ');
    if (!await bookExists(bookId)) return fail(res, 404, 'Không tìm thấy sách');
    await pool.execute('DELETE FROM user_library WHERE user_id = ? AND book_id = ?', [req.user.id, bookId]);
    return success(res, 200, 'Đã xóa sách khỏi thư viện', { bookId, inLibrary: false });
  } catch (error) { return serverError(res, 'Xóa sách khỏi thư viện', error); }
};

const getStatus = async (req, res) => {
  try {
    const bookId = getBookId(req);
    if (!bookId) return fail(res, 400, 'Mã sách không hợp lệ');
    if (!await bookExists(bookId)) return fail(res, 404, 'Không tìm thấy sách');
    const [rows] = await pool.execute('SELECT 1 FROM user_library WHERE user_id = ? AND book_id = ? LIMIT 1', [req.user.id, bookId]);
    return success(res, 200, 'Lấy trạng thái thư viện thành công', { bookId, inLibrary: rows.length > 0 });
  } catch (error) { return serverError(res, 'Kiểm tra thư viện', error); }
};

module.exports = { listLibrary, listReading, addBook, removeBook, getStatus };
