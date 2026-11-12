const pool = require('../config/db.config');
const { success, fail, serverError } = require('../utils/response');
const { isPositiveInt, isNonEmptyString } = require('../utils/validators');

// UC007 - CRUD dùng chung cho thể loại, tác giả, NXB.
// `table` chỉ lấy từ cấu hình cố định bên dưới (không bao giờ từ request) nên nối vào SQL an toàn;
// mọi giá trị người dùng đều đi qua dấu ?.
const makeCatalogController = ({ table, label, hasBio = false }) => {
  const cols = hasBio ? 'id, name, bio, status' : 'id, name, status';
  const findOne = async (id) => {
    const [rows] = await pool.execute(`SELECT ${cols} FROM ${table} WHERE id = ? LIMIT 1`, [id]);
    return rows[0];
  };
  const nameTaken = async (name, exceptId) => {
    const [rows] = await pool.execute(`SELECT id FROM ${table} WHERE name = ? AND id <> ? LIMIT 1`, [name, exceptId]);
    return rows.length > 0;
  };
  const parseBody = (body, isUpdate) => {
    const b = body || {};
    if (!isNonEmptyString(b.name) || b.name.trim().length > 150) {
      return { error: `Tên ${label} là bắt buộc và không vượt quá 150 ký tự` };
    }
    if (hasBio && b.bio !== undefined && b.bio !== null && (typeof b.bio !== 'string' || b.bio.length > 5000)) {
      return { error: 'Tiểu sử không hợp lệ (tối đa 5000 ký tự)' };
    }
    if (isUpdate && b.status !== undefined && !['active', 'inactive'].includes(b.status)) {
      return { error: 'Trạng thái không hợp lệ' };
    }
    return { value: { name: b.name.trim(), bio: b.bio, status: b.status } };
  };

  const list = async (req, res) => {
    try {
      const { status, search = '' } = req.query;
      if ((status !== undefined && !['active', 'inactive'].includes(status)) || typeof search !== 'string') {
        return fail(res, 400, 'Tham số lọc không hợp lệ');
      }
      const where = [];
      const params = [];
      if (status) { where.push('status = ?'); params.push(status); }
      if (search.trim()) { where.push('name LIKE ?'); params.push(`%${search.trim()}%`); }
      const [items] = await pool.query(
        `SELECT ${cols} FROM ${table} ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY name ASC`, params
      );
      return success(res, 200, `Lấy danh sách ${label} thành công`, { items });
    } catch (error) {
      return serverError(res, `Lấy danh sách ${label}`, error);
    }
  };

  const create = async (req, res) => {
    try {
      const { error, value } = parseBody(req.body, false);
      if (error) return fail(res, 400, error);
      if (await nameTaken(value.name, 0)) return fail(res, 409, `Tên ${label} đã tồn tại`);
      const [result] = hasBio
        ? await pool.execute(`INSERT INTO ${table} (name, bio) VALUES (?, ?)`, [value.name, value.bio ?? null])
        : await pool.execute(`INSERT INTO ${table} (name) VALUES (?)`, [value.name]);
      return success(res, 201, `Thêm ${label} thành công`, await findOne(result.insertId));
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') return fail(res, 409, `Tên ${label} đã tồn tại`);
      return serverError(res, `Thêm ${label}`, error);
    }
  };

  const update = async (req, res) => {
    try {
      const { id } = req.params;
      if (!isPositiveInt(id)) return fail(res, 400, 'Mã không hợp lệ');
      const { error, value } = parseBody(req.body, true);
      if (error) return fail(res, 400, error);
      const current = await findOne(Number(id));
      if (!current) return fail(res, 404, `Không tìm thấy ${label}`);
      if (await nameTaken(value.name, Number(id))) return fail(res, 409, `Tên ${label} đã tồn tại`);
      const sets = ['name = ?', 'status = ?'];
      const params = [value.name, value.status ?? current.status];
      if (hasBio) { sets.push('bio = ?'); params.push(value.bio === undefined ? current.bio : value.bio); }
      await pool.execute(`UPDATE ${table} SET ${sets.join(', ')} WHERE id = ?`, [...params, Number(id)]);
      return success(res, 200, `Cập nhật ${label} thành công`, await findOne(Number(id)));
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') return fail(res, 409, `Tên ${label} đã tồn tại`);
      return serverError(res, `Cập nhật ${label}`, error);
    }
  };

  // Xóa mềm (quy tắc 3): status = 'inactive', không DELETE
  const remove = async (req, res) => {
    try {
      const { id } = req.params;
      if (!isPositiveInt(id)) return fail(res, 400, 'Mã không hợp lệ');
      if (!(await findOne(Number(id)))) return fail(res, 404, `Không tìm thấy ${label}`);
      await pool.execute(`UPDATE ${table} SET status = 'inactive' WHERE id = ?`, [Number(id)]);
      return success(res, 200, `Đã ngừng hoạt động ${label}`, null);
    } catch (error) {
      return serverError(res, `Xóa ${label}`, error);
    }
  };

  return { list, create, update, remove };
};

module.exports = {
  categoryController: makeCatalogController({ table: 'categories', label: 'thể loại' }),
  authorController: makeCatalogController({ table: 'authors', label: 'tác giả', hasBio: true }),
  publisherController: makeCatalogController({ table: 'publishers', label: 'nhà xuất bản' }),
  makeCatalogController
};
