// UC007 - Quản lý sách & kho (API-26, API-30; kích hoạt lại dùng API-27 + API-29).
// Danh sách có tìm kiếm, lọc trạng thái, phân trang (lưu trên URL). Thao tác: Thêm, Sửa, Chương e-book, Ngừng hoạt động / Kích hoạt lại.
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import AdminListToolbar from '../../components/admin/AdminListToolbar';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import EntityStatusBadge from '../../components/admin/EntityStatusBadge';
import BookCover from '../../components/book/BookCover';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import Pagination from '../../components/common/Pagination';
import { EmptyState, ErrorState, LoadingBlock } from '../../components/common/States';
import { ADMIN } from '../../config/admin';
import { ROUTES } from '../../config/routes';
import { useAsync } from '../../hooks/useAsync';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useFlashNotice } from '../../hooks/useFlashNotice';
import { bookAdminService } from '../../services/admin/bookadminservice';
import type { AdminBookListItem } from '../../types';
import { parseAdminFilters, patchAdminParams } from '../../utils/adminFilters';
import { toMessage } from '../../utils/errors';
import { formatPrice } from '../../utils/format';

export default function AdminBooksPage() {
  useDocumentTitle('Quản lý sách');
  const [sp, setSp] = useSearchParams();
  const filters = useMemo(() => parseAdminFilters(sp), [sp]);
  const [notice, setNotice] = useFlashNotice();
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [removing, setRemoving] = useState<AdminBookListItem | null>(null);

  const result = useAsync(
    () => bookAdminService.list({ search: filters.search || undefined, status: filters.status, page: filters.page, limit: ADMIN.PAGE_SIZE }),
    [sp.toString()]
  );
  const data = result.data;
  const totalPages = data?.pagination.totalPages ?? 1;
  const filtered = !!(filters.search || filters.status);

  // Đang ở trang vượt quá số trang (vd. vừa ngừng hoạt động hết ở trang cuối) -> về trang cuối
  useEffect(() => {
    if (data && data.pagination.total > 0 && filters.page > totalPages) setSp(patchAdminParams(sp, { page: totalPages }), { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const run = async (id: number, action: () => Promise<unknown>, okMessage: string) => {
    setBusyId(id);
    setError('');
    setNotice('');
    try {
      await action();
      setNotice(okMessage);
      result.reload();
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <AdminPageHeader
        title="Quản lý sách & kho"
        subtitle="Sách giấy, e-book, tồn kho. Sách ngừng hoạt động bị ẩn khỏi trang bán nhưng vẫn giữ nguyên lịch sử đơn hàng."
        crumbs={[{ label: 'Tổng quan', to: ROUTES.ADMIN_HOME }, { label: 'Sách & kho' }]}
        actions={<Link to={ROUTES.ADMIN_BOOK_NEW} className="btn btn--primary">Thêm sách</Link>}
      />

      {notice && <div className="alert alert--success admin-alert" role="status">{notice}</div>}
      {error && <div className="alert alert--error admin-alert" role="alert">{error}</div>}

      <AdminListToolbar
        search={filters.search}
        status={filters.status}
        placeholder="Tìm theo tên sách"
        onSearch={(q) => setSp(patchAdminParams(sp, { search: q }))}
        onStatus={(s) => setSp(patchAdminParams(sp, { status: s }))}
      />

      {result.error ? (
        <ErrorState message={toMessage(result.error)} onRetry={result.reload} />
      ) : !data ? (
        <LoadingBlock label="Đang tải danh sách sách..." />
      ) : data.items.length === 0 ? (
        <EmptyState
          title={filtered ? 'Không tìm thấy sách phù hợp' : 'Chưa có sách nào'}
          hint={filtered ? 'Hãy kiểm tra lại từ khóa hoặc bộ lọc.' : 'Bấm "Thêm sách" để tạo cuốn đầu tiên.'}
        />
      ) : (
        <div className={result.loading ? 'is-loading' : undefined}>
          <p className="admin-count">Có <b>{data.pagination.total}</b> cuốn sách</p>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Sách</th>
                  <th scope="col">Hình thức</th>
                  <th scope="col" className="table__num">Giá</th>
                  <th scope="col" className="table__num">Tồn kho</th>
                  <th scope="col" className="table__num">Chương</th>
                  <th scope="col">Trạng thái</th>
                  <th scope="col" className="table__actions-col">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((b) => (
                  <tr key={b.id} className={b.status === 'inactive' ? 'is-muted' : undefined}>
                    <td>
                      <Link to={ROUTES.ADMIN_BOOK_DETAIL(b.id)} className="table__book table__book-link">
                        <BookCover book={{ id: b.id, title: b.title, coverUrl: b.coverUrl, authors: [] }} className="table__cover" />
                        <span className="table__strong">{b.title}</span>
                      </Link>
                    </td>
                    <td>
                      <span className="table__tags">
                        {b.hasPhysical && <span className="tag">Sách giấy</span>}
                        {b.hasEbook && <span className="tag tag--brand">E-book</span>}
                      </span>
                    </td>
                    <td className="table__num">{b.hasPhysical && b.price !== null ? formatPrice(b.price) : '—'}</td>
                    <td className="table__num">
                      {b.hasPhysical ? (b.stock <= ADMIN.LOW_STOCK ? <span className={`tag ${b.stock <= 0 ? 'tag--out' : 'tag--low'}`}>{b.stock}</span> : b.stock) : '—'}
                    </td>
                    <td className="table__num">{b.hasEbook ? b.chapterCount : '—'}</td>
                    <td><EntityStatusBadge status={b.status} /></td>
                    <td className="table__actions">
                      <Link to={ROUTES.ADMIN_BOOK_EDIT(b.id)} className="btn btn--ghost">Sửa</Link>
                      {b.hasEbook && <Link to={ROUTES.ADMIN_BOOK_CHAPTERS(b.id)} className="btn btn--ghost">Chương</Link>}
                      {b.status === 'active' ? (
                        <button type="button" className="btn btn--ghost btn--danger" disabled={busyId === b.id} onClick={() => setRemoving(b)}>Ngừng hoạt động</button>
                      ) : (
                        <button type="button" className="btn btn--ghost" disabled={busyId === b.id}
                          onClick={() => run(b.id, () => bookAdminService.activate(b.id), `Đã kích hoạt lại sách "${b.title}"`)}>
                          Kích hoạt lại
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={data.pagination.page}
            totalPages={totalPages}
            onChange={(page) => {
              setSp(patchAdminParams(sp, { page }));
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        </div>
      )}

      <ConfirmDialog
        open={removing !== null}
        title="Ngừng hoạt động sách này?"
        message={`"${removing?.title ?? ''}" sẽ bị ẩn khỏi trang bán sách (xóa mềm). Đơn hàng và lịch sử đọc đã có không bị ảnh hưởng. Bạn có thể kích hoạt lại bất cứ lúc nào.`}
        confirmLabel="Ngừng hoạt động"
        cancelLabel="Giữ lại"
        busy={busyId !== null}
        onConfirm={async () => {
          const target = removing;
          if (!target) return;
          await run(target.id, () => bookAdminService.deactivate(target.id), `Đã chuyển sách "${target.title}" sang ngừng hoạt động`);
          setRemoving(null);
        }}
        onCancel={() => setRemoving(null)}
      />
    </>
  );
}
