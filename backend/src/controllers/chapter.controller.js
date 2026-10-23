const pool = require('../config/db.config');
const { success, fail, serverError } = require('../utils/response');
const { isPositiveInt } = require('../utils/validators');

// Sách phải đang hiển thị và có bản e-book
const findReadableBook = async (bookId) => {
  const [rows] = await pool.execute(
    "SELECT id, title FROM books WHERE id = ? AND status = 'active' AND has_ebook = 1 LIMIT 1",
    [Number(bookId)]
  );
  return rows[0];
};

// UC006 - Mục lục chương (không kèm nội dung)
const listChapters = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isPositiveInt(id)) return fail(res, 400, 'Mã sách không hợp lệ');
    const book = await findReadableBook(id);
    if (!book) return fail(res, 404, 'Không tìm thấy sách hoặc sách không có bản e-book');
    const [items] = await pool.execute(
      'SELECT id, chapter_number AS chapterNumber, title FROM chapters WHERE book_id = ? ORDER BY chapter_number ASC',
      [book.id]
    );
    return success(res, 200, 'Lấy mục lục sách thành công', { book, items });
  } catch (error) {
    return serverError(res, 'Lấy mục lục sách', error);
  }
};

// UC006 - Nội dung MỘT chương (quy tắc 9: API chỉ trả từng chương)
const getChapter = async (req, res) => {
  try {
    const { id, chapterNumber } = req.params;
    if (!isPositiveInt(id) || !isPositiveInt(chapterNumber)) {
      return fail(res, 400, 'Mã sách hoặc số chương không hợp lệ');
    }
    const book = await findReadableBook(id);
    if (!book) return fail(res, 404, 'Không tìm thấy sách hoặc sách không có bản e-book');
    const [rows] = await pool.execute(
      `SELECT c.id, c.chapter_number AS chapterNumber, c.title, c.content,
              (SELECT MAX(p.chapter_number) FROM chapters p WHERE p.book_id = c.book_id AND p.chapter_number < c.chapter_number) AS prevChapterNumber,
              (SELECT MIN(n.chapter_number) FROM chapters n WHERE n.book_id = c.book_id AND n.chapter_number > c.chapter_number) AS nextChapterNumber
       FROM chapters c WHERE c.book_id = ? AND c.chapter_number = ? LIMIT 1`,
      [book.id, Number(chapterNumber)]
    );
    if (!rows.length) return fail(res, 404, 'Không tìm thấy chương');
    return success(res, 200, 'Lấy nội dung chương thành công', { bookId: book.id, ...rows[0] });
  } catch (error) {
    return serverError(res, 'Lấy nội dung chương', error);
  }
};

module.exports = { listChapters, getChapter, findReadableBook };
