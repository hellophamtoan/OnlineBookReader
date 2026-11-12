// UC010 — Danh sách người dùng
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import { EmptyState, ErrorState, LoadingBlock } from '../../components/common/States';
import { ROUTES } from '../../config/routes';
import { useAsync } from '../../hooks/useAsync';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { userAdminService } from '../../services/admin/useradminservice';
import { formatPrice } from '../../utils/format';
import { toMessage } from '../../utils/errors';

// [Trang] Admin > Người dùng (/admin/users): danh sách tài khoản, lọc, khóa / mở khóa.
export default function AdminUsersPage() {
  useDocumentTitle('Người dùng');
  const [sp, setSp] = useSearchParams();
  const role = sp.get('role') || 'USER';
  const isActive = sp.get('isActive') || '';
  const q = sp.get('q') || '';
  const page = Math.max(1, Number(sp.get('page')) || 1);
  const [qInput, setQInput] = useState(q);

  const query = useMemo(
    () => ({
      page,
      limit: 20,
      role: role || undefined,
      isActive: isActive || undefined,
      q: q || undefined,
    }),
    [page, role, isActive, q],
  );

  const list = useAsync(() => userAdminService.list(query), [query.page, query.role, query.isActive, query.q]);
  const data = list.data;
  const totalPages = data?.totalPages ?? 1;

  const patch = (mut: (n: URLSearchParams) => void) => {
    const next = new URLSearchParams(sp);
    mut(next);
    setSp(next);
  };

  return (
    <>
      <AdminPageHeader
        title="Người dùng"
        subtitle="Xem tài khoản khách hàng, khóa hoặc mở khóa."
        crumbs={[{ label: 'Tổng quan', to: ROUTES.ADMIN_HOME }, { label: 'Người dùng' }]}
      />

      <div className="admin-toolbar" style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <form
          style={{ display: 'flex', gap: 8, flex: '1 1 240px' }}
          onSubmit={(e) => {
            e.preventDefault();
            patch((n) => {
              if (qInput.trim()) n.set('q', qInput.trim());
              else n.delete('q');
              n.set('page', '1');
            });
          }}
        >
          <input
            className="input"
            placeholder="Tên, email, SĐT, ID..."
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
          />
          <button type="submit" className="btn btn--primary">
            Tìm
          </button>
        </form>
        <select
          className="input"
          style={{ maxWidth: 140 }}
          value={role}
          onChange={(e) =>
            patch((n) => {
              n.set('role', e.target.value);
              n.set('page', '1');
            })
          }
        >
          <option value="">Mọi role</option>
          <option value="USER">USER</option>
          <option value="ADMIN">ADMIN</option>
        </select>
        <select
          className="input"
          style={{ maxWidth: 160 }}
          value={isActive}
          onChange={(e) =>
            patch((n) => {
              if (e.target.value) n.set('isActive', e.target.value);
              else n.delete('isActive');
              n.set('page', '1');
            })
          }
        >
          <option value="">Mọi trạng thái</option>
          <option value="true">Đang hoạt động</option>
          <option value="false">Đã khóa</option>
        </select>
      </div>

      {list.error ? (
        <ErrorState message={toMessage(list.error)} onRetry={list.reload} />
      ) : !data ? (
        <LoadingBlock label="Đang tải người dùng..." />
      ) : data.items.length === 0 ? (
        <EmptyState title="Không có tài khoản phù hợp" />
      ) : (
        <>
          <p className="admin-count">
            Có <b>{data.total}</b> tài khoản
          </p>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Họ tên</th>
                  <th>Email / SĐT</th>
                  <th>Role</th>
                  <th>TT</th>
                  <th className="table__num">Ví</th>
                  <th>Gói</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((u) => (
                  <tr key={u.id}>
                    <td>{u.id}</td>
                    <td className="table__strong">{u.fullName}</td>
                    <td>
                      <div>{u.email}</div>
                      <div className="field__hint">{u.phone || '—'}</div>
                    </td>
                    <td>{u.role}</td>
                    <td>
                      <span className={`tag ${u.isActive ? 'tag--ok' : 'tag'}`}>{u.isActive ? 'Hoạt động' : 'Đã khóa'}</span>
                    </td>
                    <td className="table__num">{formatPrice(u.walletBalance)}</td>
                    <td>{u.hasActiveSubscription ? 'Còn hạn' : '—'}</td>
                    <td>
                      <Link className="btn btn--ghost btn--sm" to={ROUTES.ADMIN_USER_DETAIL(u.id)}>
                        Chi tiết
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button
                type="button"
                className="btn btn--ghost"
                disabled={page <= 1}
                onClick={() =>
                  patch((n) => {
                    n.set('page', String(page - 1));
                  })
                }
              >
                Trước
              </button>
              <span className="field__hint" style={{ alignSelf: 'center' }}>
                {page}/{totalPages}
              </span>
              <button
                type="button"
                className="btn btn--ghost"
                disabled={page >= totalPages}
                onClick={() =>
                  patch((n) => {
                    n.set('page', String(page + 1));
                  })
                }
              >
                Sau
              </button>
            </div>
          )}
        </>
      )}
    </>
  );
}
