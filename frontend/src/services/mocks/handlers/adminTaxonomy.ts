// services/mocks/handlers/adminTaxonomy.ts
// Giả lập API-14..API-25 (UC007): Thể loại, Tác giả, Nhà xuất bản. Ba nhóm API cùng khuôn nên sinh route từ một hàm.
// Xóa = xóa mềm (status 'inactive'); sửa kèm status 'active' = kích hoạt lại. Trùng tên -> 409.
import { normalizeText } from '../../../utils/text';
import { ADMIN } from '../../../config/admin';
import { getCatalog, nextId, updateCatalog } from '../catalogdb';
import type { CatalogRef, EntityStatus, RefKind } from '../catalogdb';
import type { Route } from '../router';
import { badRequest, conflict, failValidation, idParam, notFound, str } from './common';
import type { FieldErr } from './common';
import { requireAdmin } from './guards';

const LABEL: Record<RefKind, string> = { categories: 'Thể loại', authors: 'Tác giả', publishers: 'Nhà xuất bản' };

const view = (kind: RefKind, r: CatalogRef) => (kind === 'authors' ? { id: r.id, name: r.name, bio: r.bio ?? '', status: r.status } : { id: r.id, name: r.name, status: r.status });

const isStatus = (v: unknown): v is EntityStatus => v === 'active' || v === 'inactive';

// Đọc + kiểm tra body (name bắt buộc ≤150, status tùy chọn, bio của tác giả)
const parseBody = (kind: RefKind, body: unknown, allowStatus: boolean) => {
  const b = (body ?? {}) as Record<string, unknown>;
  const name = str(b.name).trim();
  const errors: FieldErr[] = [];
  if (!name) errors.push({ field: 'name', message: 'Vui lòng nhập tên' });
  else if (name.length > ADMIN.NAME_MAX) errors.push({ field: 'name', message: `Tên tối đa ${ADMIN.NAME_MAX} ký tự` });
  if (allowStatus && b.status !== undefined && b.status !== null && !isStatus(b.status)) errors.push({ field: 'status', message: 'Trạng thái không hợp lệ' });
  if (errors.length) throw failValidation(errors);
  return {
    name,
    status: allowStatus && isStatus(b.status) ? b.status : undefined,
    bio: kind === 'authors' ? str(b.bio).trim() : undefined,
  };
};

const duplicate = (kind: RefKind, name: string, exceptId?: number) =>
  getCatalog()[kind].some((r) => r.id !== exceptId && normalizeText(r.name) === normalizeText(name));

const routesFor = (kind: RefKind): Route[] => {
  const base = `/admin/${kind}`;
  const label = LABEL[kind];
  return [
    // ===== GET /admin/{kind} ===== gồm cả mục ngừng hoạt động
    {
      method: 'GET',
      path: base,
      handler: ({ token, query }) => {
        requireAdmin(token);
        const status = query.get('status');
        if (status !== null && status !== '' && !isStatus(status)) throw badRequest('status không hợp lệ');
        const kw = normalizeText(query.get('search') ?? '');
        const items = getCatalog()[kind]
          .filter((r) => (!status || r.status === status) && (!kw || normalizeText(r.name).includes(kw)))
          .sort((a, b) => a.name.localeCompare(b.name, 'vi'))
          .map((r) => view(kind, r));
        return { message: `Lấy danh sách ${label.toLowerCase()} thành công`, data: { items } };
      },
    },

    // ===== POST /admin/{kind} =====
    {
      method: 'POST',
      path: base,
      handler: ({ token, body }) => {
        requireAdmin(token);
        const p = parseBody(kind, body, false);
        if (duplicate(kind, p.name)) throw conflict(`${label} đã tồn tại`, 'name');
        let created!: CatalogRef;
        updateCatalog((s) => {
          created = { id: nextId(s[kind]), name: p.name, status: 'active', ...(kind === 'authors' ? { bio: p.bio ?? '' } : {}) };
          return { ...s, [kind]: [...s[kind], created] };
        });
        return { status: 201, message: `Thêm ${label.toLowerCase()} thành công`, data: view(kind, created) };
      },
    },

    // ===== PUT /admin/{kind}/:id ===== status 'active' để kích hoạt lại
    {
      method: 'PUT',
      path: `${base}/:id`,
      handler: ({ token, params, body }) => {
        requireAdmin(token);
        const id = idParam(params.id);
        const p = parseBody(kind, body, true);
        const current = getCatalog()[kind].find((r) => r.id === id);
        if (!current) throw notFound(`Không tìm thấy ${label.toLowerCase()}`);
        if (duplicate(kind, p.name, id)) throw conflict(`${label} đã tồn tại`, 'name');
        const next: CatalogRef = {
          ...current,
          name: p.name,
          status: p.status ?? current.status,
          ...(kind === 'authors' ? { bio: p.bio ?? current.bio ?? '' } : {}),
        };
        updateCatalog((s) => ({ ...s, [kind]: s[kind].map((r) => (r.id === id ? next : r)) }));
        return { message: `Cập nhật ${label.toLowerCase()} thành công`, data: view(kind, next) };
      },
    },

    // ===== DELETE /admin/{kind}/:id ===== xóa mềm
    {
      method: 'DELETE',
      path: `${base}/:id`,
      handler: ({ token, params }) => {
        requireAdmin(token);
        const id = idParam(params.id);
        if (!getCatalog()[kind].some((r) => r.id === id)) throw notFound(`Không tìm thấy ${label.toLowerCase()}`);
        updateCatalog((s) => ({ ...s, [kind]: s[kind].map((r) => (r.id === id ? { ...r, status: 'inactive' as const } : r)) }));
        return { message: `Đã chuyển ${label.toLowerCase()} sang ngừng hoạt động`, data: null };
      },
    },
  ];
};

export const adminTaxonomyRoutes: Route[] = [...routesFor('categories'), ...routesFor('authors'), ...routesFor('publishers')];
