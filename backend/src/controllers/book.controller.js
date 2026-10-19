const pool = require('../config/db.config');
const { success, fail, serverError } = require('../utils/response');

const isPositiveInteger = (value) => /^\d+$/.test(String(value)) && Number.isSafeInteger(Number(value)) && Number(value) > 0;

const getBooks = async (req, res) => {
  try {
    const { search = '', categoryId, page = '1', limit = '12', sort = 'newest' } = req.query;
    if (!isPositiveInteger(page) || !isPositiveInteger(limit) || Number(limit) > 100 ||
        (categoryId !== undefined && !isPositiveInteger(categoryId)) ||
        typeof search !== 'string' || !['newest', 'title_asc', 'title_desc'].includes(sort)) {
      return fail(res, 400, 'Tham số tìm kiếm, lọc hoặc phân trang không hợp lệ');
    }

    const pageNumber = Number(page);
    const limitNumber = Number(limit);
    const offset = (pageNumber - 1) * limitNumber;
    if (!Number.isSafeInteger(offset)) return fail(res, 400, 'Trang yêu cầu không hợp lệ');

    const conditions = ["b.status = 'active'"];
    const params = [];
    if (search.trim()) {
      conditions.push(`(b.title LIKE ? OR EXISTS (
        SELECT 1 FROM book_authors ba2 JOIN authors a2 ON a2.id = ba2.author_id
        WHERE ba2.book_id = b.id AND a2.status = 'active' AND a2.name LIKE ?
      ))`);
      const keyword = `%${search.trim()}%`;
      params.push(keyword, keyword);
    }
    if (categoryId !== undefined) {
      conditions.push(`EXISTS (
        SELECT 1 FROM book_categories bc2 JOIN categories c2 ON c2.id = bc2.category_id
        WHERE bc2.book_id = b.id AND bc2.category_id = ? AND c2.status = 'active'
      )`);
      params.push(Number(categoryId));
    }
    const where = conditions.join(' AND ');
    const order = {
      newest: 'b.created_at DESC, b.id DESC',
      title_asc: 'b.title ASC, b.id ASC',
      title_desc: 'b.title DESC, b.id DESC'
    }[sort];

    const [[countRow]] = await pool.query(`SELECT COUNT(*) AS total FROM books b WHERE ${where}`, params);
    const [books] = await pool.query(
      `SELECT b.id, b.title, b.cover_url AS coverUrl
       FROM books b WHERE ${where} ORDER BY ${order} LIMIT ? OFFSET ?`,
      [...params, limitNumber, offset]
    );

    const ids = books.map(book => book.id);
    let authorRows = [];
    let categoryRows = [];
    if (ids.length) {
      const placeholders = ids.map(() => '?').join(',');
      [authorRows] = await pool.query(
        `SELECT ba.book_id AS bookId, a.name FROM book_authors ba
         JOIN authors a ON a.id = ba.author_id AND a.status = 'active'
         WHERE ba.book_id IN (${placeholders}) ORDER BY a.name`, ids
      );
      [categoryRows] = await pool.query(
        `SELECT bc.book_id AS bookId, c.name FROM book_categories bc
         JOIN categories c ON c.id = bc.category_id AND c.status = 'active'
         WHERE bc.book_id IN (${placeholders}) ORDER BY c.name`, ids
      );
    }
    const items = books.map(book => ({
      ...book,
      authorNames: authorRows.filter(row => row.bookId === book.id).map(row => row.name),
      categoryNames: categoryRows.filter(row => row.bookId === book.id).map(row => row.name)
    }));
    return success(res, 200, 'Lấy danh sách sách thành công', {
      items, page: pageNumber, limit: limitNumber, total: countRow.total
    });
  } catch (error) {
    return serverError(res, 'Lấy danh sách sách', error);
  }
};

const getBookById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isPositiveInteger(id)) return fail(res, 400, 'Mã sách không hợp lệ');
    const [[book]] = await pool.query(
      `SELECT id, title, description, cover_url AS coverUrl
       FROM books WHERE id = ? AND status = 'active' LIMIT 1`, [Number(id)]
    );
    if (!book) return fail(res, 404, 'Không tìm thấy sách');
    const [authors] = await pool.query(
      `SELECT a.id, a.name FROM authors a JOIN book_authors ba ON ba.author_id = a.id
       WHERE ba.book_id = ? AND a.status = 'active' ORDER BY a.name`, [Number(id)]
    );
    const [categories] = await pool.query(
      `SELECT c.id, c.name FROM categories c JOIN book_categories bc ON bc.category_id = c.id
       WHERE bc.book_id = ? AND c.status = 'active' ORDER BY c.name`, [Number(id)]
    );
    return success(res, 200, 'Lấy chi tiết sách thành công', { ...book, authors, categories });
  } catch (error) {
    return serverError(res, 'Lấy chi tiết sách', error);
  }
};

module.exports = { getBooks, getBookById };
