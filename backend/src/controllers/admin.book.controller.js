const pool = require('../config/db.config');
const { success, fail, serverError } = require('../utils/response');
const { isPositiveInt, isNonEmptyString } = require('../utils/validators');

const toIds = (v) => (Array.isArray(v) && v.length > 0 && v.length <= 20 && v.every(isPositiveInt) ? [...new Set(v.map(Number))] : null);

// Kiểm tra và chuẩn hóa body thêm/sửa sách (UC007 luồng A2a/B2a)
const parseBookBody = (body, isUpdate) => {
  const b = body || {};
  if (!isNonEmptyString(b.title) || b.title.trim().length > 255) return { error: 'Tên sách là bắt buộc và không vượt quá 255 ký tự' };
  if (b.description !== undefined && b.description !== null && (typeof b.description !== 'string' || b.description.length > 20000)) {
    return { error: 'Mô tả không hợp lệ' };
  }
  if (b.coverUrl !== undefined && b.coverUrl !== null && b.coverUrl !== '' &&
      (typeof b.coverUrl !== 'string' || b.coverUrl.length > 500 || !/^(https?:\/\/|\/uploads\/)/.test(b.coverUrl))) {
    return { error: 'Đường dẫn ảnh bìa không hợp lệ' };
  }
  if (b.publisherId !== undefined && b.publisherId !== null && !isPositiveInt(b.publisherId)) return { error: 'Nhà xuất bản không hợp lệ' };
  if (typeof b.hasPhysical !== 'boolean' || typeof b.hasEbook !== 'boolean') return { error: 'hasPhysical và hasEbook phải là true hoặc false' };
  if (!b.hasPhysical && !b.hasEbook) return { error: 'Sách phải có ít nhất một hình thức: sách giấy hoặc e-book' };
  const authorIds = toIds(b.authorIds);
  const categoryIds = toIds(b.categoryIds);
  if (!authorIds) return { error: 'Vui lòng chọn ít nhất một tác giả hợp lệ' };
  if (!categoryIds) return { error: 'Vui lòng chọn ít nhất một thể loại hợp lệ' };
  if (isUpdate && b.status !== undefined && !['active', 'inactive'].includes(b.status)) return { error: 'Trạng thái không hợp lệ' };

  // Giá và tồn kho chỉ áp dụng cho sách giấy; sách chỉ có e-book: price = NULL, stock = 0
  let price = null;
  let stock = 0;
  if (b.hasPhysical) {
    price = b.price === undefined || b.price === null || b.price === '' ? NaN : Number(b.price);
    if (!Number.isFinite(price) || price < 0 || price > 9999999999) return { error: 'Giá sách giấy phải là số không âm' };
    stock = b.stock === undefined ? 0 : b.stock;
    if (!Number.isInteger(stock) || stock < 0 || stock > 1000000000) return { error: 'Số lượng tồn kho phải là số nguyên không âm' };
  }
  return {
    value: {
      title: b.title.trim(), description: b.description ?? null, coverUrl: b.coverUrl || null,
      publisherId: b.publisherId == null ? null : Number(b.publisherId),
      hasPhysical: b.hasPhysical, hasEbook: b.hasEbook, price, stock, authorIds, categoryIds, status: b.status
    }
  };
};

// Tác giả/thể loại/NXB được chọn phải tồn tại và đang hoạt động
const checkReferences = async (v) => {
  const count = async (table, ids) => {
    const [[row]] = await pool.query(`SELECT COUNT(*) AS n FROM ${table} WHERE status = 'active' AND id IN (?)`, [ids]);
    return row.n;
  };
  if ((await count('authors', v.authorIds)) !== v.authorIds.length) return 'Có tác giả không tồn tại hoặc đã ngừng hoạt động';
  if ((await count('categories', v.categoryIds)) !== v.categoryIds.length) return 'Có thể loại không tồn tại hoặc đã ngừng hoạt động';
  if (v.publisherId !== null && (await count('publishers', [v.publisherId])) !== 1) return 'Nhà xuất bản không tồn tại hoặc đã ngừng hoạt động';
  return null;
};

const replaceLinks = async (conn, bookId, v) => {
  await conn.execute('DELETE FROM book_authors WHERE book_id = ?', [bookId]);
  await conn.execute('DELETE FROM book_categories WHERE book_id = ?', [bookId]);
  await conn.query('INSERT INTO book_authors (book_id, author_id) VALUES ?', [v.authorIds.map((a) => [bookId, a])]);
  await conn.query('INSERT INTO book_categories (book_id, category_id) VALUES ?', [v.categoryIds.map((c) => [bookId, c])]);
};

const findBookDetail = async (id) => {
  const [rows] = await pool.execute(
    `SELECT id, title, description, cover_url AS coverUrl, publisher_id AS publisherId,
            has_physical AS hasPhysical, has_ebook AS hasEbook, price, stock, status,
            created_at AS createdAt, updated_at AS updatedAt
     FROM books WHERE id = ? LIMIT 1`, [id]
  );
  if (!rows.length) return null;
  const [authors] = await pool.execute(
    'SELECT a.id, a.name, a.status FROM authors a JOIN book_authors ba ON ba.author_id = a.id WHERE ba.book_id = ? ORDER BY a.name', [id]
  );
  const [categories] = await pool.execute(
    'SELECT c.id, c.name, c.status FROM categories c JOIN book_categories bc ON bc.category_id = c.id WHERE bc.book_id = ? ORDER BY c.name', [id]
  );
  const b = rows[0];
  return { ...b, hasPhysical: !!b.hasPhysical, hasEbook: !!b.hasEbook, price: b.price === null ? null : Number(b.price), authors, categories };
};

// Chạy fn(conn) trong một transaction
const withTransaction = async (fn) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
};

// UC007 - Danh sách sách cho Admin (gồm cả sách đã ngừng hoạt động)
const listBooks = async (req, res) => {
  try {
    const { search = '', status, page = '1', limit = '20' } = req.query;
    if (!isPositiveInt(page) || !isPositiveInt(limit) || Number(limit) > 100 || typeof search !== 'string' ||
        (status !== undefined && !['active', 'inactive'].includes(status))) {
      return fail(res, 400, 'Tham số tìm kiếm, lọc hoặc phân trang không hợp lệ');
    }
    const where = [];
    const params = [];
    if (status) { where.push('b.status = ?'); params.push(status); }
    if (search.trim()) { where.push('b.title LIKE ?'); params.push(`%${search.trim()}%`); }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM books b ${clause}`, params);
    const [rows] = await pool.query(
      `SELECT b.id, b.title, b.cover_url AS coverUrl, b.has_physical AS hasPhysical, b.has_ebook AS hasEbook,
              b.price, b.stock, b.status, b.created_at AS createdAt,
              (SELECT COUNT(*) FROM chapters c WHERE c.book_id = b.id) AS chapterCount
       FROM books b ${clause} ORDER BY b.id DESC LIMIT ? OFFSET ?`,
      [...params, Number(limit), (Number(page) - 1) * Number(limit)]
    );
    const items = rows.map((b) => ({ ...b, hasPhysical: !!b.hasPhysical, hasEbook: !!b.hasEbook, price: b.price === null ? null : Number(b.price) }));
    return success(res, 200, 'Lấy danh sách sách thành công', { items, page: Number(page), limit: Number(limit), total });
  } catch (error) {
    return serverError(res, 'Lấy danh sách sách (admin)', error);
  }
};

const getBook = async (req, res) => {
  try {
    if (!isPositiveInt(req.params.id)) return fail(res, 400, 'Mã sách không hợp lệ');
    const book = await findBookDetail(Number(req.params.id));
    if (!book) return fail(res, 404, 'Không tìm thấy sách');
    return success(res, 200, 'Lấy chi tiết sách thành công', book);
  } catch (error) {
    return serverError(res, 'Lấy chi tiết sách (admin)', error);
  }
};

const createBook = async (req, res) => {
  try {
    const { error, value: v } = parseBookBody(req.body, false);
    if (error) return fail(res, 400, error);
    const refError = await checkReferences(v);
    if (refError) return fail(res, 400, refError);
    const id = await withTransaction(async (conn) => {
      const [r] = await conn.execute(
        `INSERT INTO books (title, description, cover_url, publisher_id, has_physical, has_ebook, price, stock)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [v.title, v.description, v.coverUrl, v.publisherId, v.hasPhysical ? 1 : 0, v.hasEbook ? 1 : 0, v.price, v.stock]
      );
      await replaceLinks(conn, r.insertId, v);
      return r.insertId;
    });
    return success(res, 201, 'Thêm sách thành công', await findBookDetail(id));
  } catch (error) {
    return serverError(res, 'Thêm sách', error);
  }
};

const updateBook = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isPositiveInt(id)) return fail(res, 400, 'Mã sách không hợp lệ');
    const { error, value: v } = parseBookBody(req.body, true);
    if (error) return fail(res, 400, error);
    const current = await findBookDetail(Number(id));
    if (!current) return fail(res, 404, 'Không tìm thấy sách');
    const refError = await checkReferences(v);
    if (refError) return fail(res, 400, refError);
    await withTransaction(async (conn) => {
      await conn.execute(
        `UPDATE books SET title = ?, description = ?, cover_url = ?, publisher_id = ?, has_physical = ?, has_ebook = ?,
                price = ?, stock = ?, status = ? WHERE id = ?`,
        [v.title, v.description, v.coverUrl, v.publisherId, v.hasPhysical ? 1 : 0, v.hasEbook ? 1 : 0,
          v.price, v.stock, v.status ?? current.status, Number(id)]
      );
      await replaceLinks(conn, Number(id), v);
    });
    return success(res, 200, 'Cập nhật sách thành công', await findBookDetail(Number(id)));
  } catch (error) {
    return serverError(res, 'Cập nhật sách', error);
  }
};

// Xóa mềm (quy tắc 3)
const deleteBook = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isPositiveInt(id)) return fail(res, 400, 'Mã sách không hợp lệ');
    const [rows] = await pool.execute('SELECT id FROM books WHERE id = ? LIMIT 1', [Number(id)]);
    if (!rows.length) return fail(res, 404, 'Không tìm thấy sách');
    await pool.execute("UPDATE books SET status = 'inactive' WHERE id = ?", [Number(id)]);
    return success(res, 200, 'Đã ngừng hoạt động sách', null);
  } catch (error) {
    return serverError(res, 'Xóa sách', error);
  }
};

module.exports = { listBooks, getBook, createBook, updateBook, deleteBook, parseBookBody };
