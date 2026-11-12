const pool = require('../config/db.config');
const { success, fail, serverError } = require('../utils/response');
const { isPositiveInt } = require('../utils/validators');
const { findReadableBook } = require('./chapter.controller');

const DEFAULT_FONT = 'Arial';
const DEFAULT_SIZE = 16;
const FONT_PATTERN = /^[\p{L}0-9 ,'-]{1,100}$/u;

// UC006 bước 3-4 - Lấy tiến trình đã lưu để mở sách đúng vị trí đọc dở
const getProgress = async (req, res) => {
  try {
    const { bookId } = req.params;
    if (!isPositiveInt(bookId)) return fail(res, 400, 'Mã sách không hợp lệ');
    const book = await findReadableBook(bookId);
    if (!book) return fail(res, 404, 'Không tìm thấy sách hoặc sách không có bản e-book');
    const [rows] = await pool.execute(
      `SELECT rp.chapter_id AS chapterId, c.chapter_number AS chapterNumber,
              rp.scroll_percent AS scrollPercent, rp.font_family AS fontFamily, rp.font_size AS fontSize
       FROM reading_progress rp LEFT JOIN chapters c ON c.id = rp.chapter_id
       WHERE rp.user_id = ? AND rp.book_id = ? LIMIT 1`,
      [req.user.id, book.id]
    );
    // Chưa có tiến trình: FE mở từ chương đầu tiên
    const data = rows.length
      ? { bookId: book.id, ...rows[0], scrollPercent: Number(rows[0].scrollPercent) }
      : { bookId: book.id, chapterId: null, chapterNumber: null, scrollPercent: 0, fontFamily: DEFAULT_FONT, fontSize: DEFAULT_SIZE };
    return success(res, 200, 'Lấy tiến trình đọc thành công', data);
  } catch (error) {
    return serverError(res, 'Lấy tiến trình đọc', error);
  }
};

// UC006 bước 8-9 - Lưu tiến trình (vị trí + font/cỡ chữ). Mỗi (user, sách) một bản ghi.
const saveProgress = async (req, res) => {
  try {
    const { bookId } = req.params;
    const { chapterNumber, scrollPercent = 0, fontFamily, fontSize } = req.body || {};
    if (!isPositiveInt(bookId)) return fail(res, 400, 'Mã sách không hợp lệ');
    if (!isPositiveInt(chapterNumber)) return fail(res, 400, 'Số chương không hợp lệ');
    const percent = Number(scrollPercent);
    if (typeof scrollPercent === 'boolean' || scrollPercent === null || !Number.isFinite(percent) || percent < 0 || percent > 100) {
      return fail(res, 400, 'Vị trí cuộn phải nằm trong khoảng 0 đến 100');
    }
    if (fontFamily !== undefined && (typeof fontFamily !== 'string' || !FONT_PATTERN.test(fontFamily.trim()))) {
      return fail(res, 400, 'Font chữ không hợp lệ');
    }
    if (fontSize !== undefined && (!Number.isInteger(fontSize) || fontSize < 8 || fontSize > 72)) {
      return fail(res, 400, 'Cỡ chữ phải là số nguyên từ 8 đến 72');
    }

    const book = await findReadableBook(bookId);
    if (!book) return fail(res, 404, 'Không tìm thấy sách hoặc sách không có bản e-book');
    const [chapters] = await pool.execute(
      'SELECT id FROM chapters WHERE book_id = ? AND chapter_number = ? LIMIT 1',
      [book.id, Number(chapterNumber)]
    );
    if (!chapters.length) return fail(res, 404, 'Không tìm thấy chương');
    const chapterId = chapters[0].id;
    const font = fontFamily === undefined ? null : fontFamily.trim();
    const size = fontSize === undefined ? null : fontSize;

    const [existing] = await pool.execute(
      'SELECT id FROM reading_progress WHERE user_id = ? AND book_id = ? LIMIT 1',
      [req.user.id, book.id]
    );
    if (existing.length) {
      // Không gửi font/cỡ chữ thì giữ nguyên giá trị đã lưu
      await pool.execute(
        `UPDATE reading_progress SET chapter_id = ?, scroll_percent = ?,
           font_family = COALESCE(?, font_family), font_size = COALESCE(?, font_size) WHERE id = ?`,
        [chapterId, percent, font, size, existing[0].id]
      );
    } else {
      await pool.execute(
        `INSERT INTO reading_progress (user_id, book_id, chapter_id, scroll_percent, font_family, font_size)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [req.user.id, book.id, chapterId, percent, font ?? DEFAULT_FONT, size ?? DEFAULT_SIZE]
      );
    }
    const [[saved]] = await pool.execute(
      `SELECT chapter_id AS chapterId, scroll_percent AS scrollPercent, font_family AS fontFamily, font_size AS fontSize
       FROM reading_progress WHERE user_id = ? AND book_id = ? LIMIT 1`,
      [req.user.id, book.id]
    );
    return success(res, 200, 'Lưu tiến trình đọc thành công', {
      bookId: book.id, chapterNumber: Number(chapterNumber), ...saved, scrollPercent: Number(saved.scrollPercent)
    });
  } catch (error) {
    return serverError(res, 'Lưu tiến trình đọc', error);
  }
};

module.exports = { getProgress, saveProgress };
