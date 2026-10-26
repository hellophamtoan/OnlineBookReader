// UC007 - Quản lý Thể loại / Tác giả / Nhà xuất bản (API-14..API-25). Ba trang dùng chung một component, khác nhau ở prop `kind`.
// Luồng: danh sách -> Thêm / Sửa (hộp thoại) / Xóa mềm (ngừng hoạt động) hoặc Kích hoạt lại -> thông báo + làm mới danh sách.
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import AdminListToolbar from '../../components/admin/AdminListToolbar';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import EntityStatusBadge from '../../components/admin/EntityStatusBadge';
import TaxonomyFormDialog from '../../components/admin/TaxonomyFormDialog';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import { EmptyState, ErrorState, LoadingBlock } from '../../components/common/States';
import { TAXONOMY } from '../../config/admin';
import { ROUTES } from '../../config/routes';
import { useAsync } from '../../hooks/useAsync';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { taxonomyService } from '../../services/admin/taxonomyservice';
import type { TaxonomyItem, TaxonomyKind } from '../../types';
import { parseAdminFilters, patchAdminParams } from '../../utils/adminFilters';
import { toMessage } from '../../utils/errors';

export default function AdminTaxonomyPage({ kind }: { kind: TaxonomyKind }) {
  const config = TAXONOMY[kind];
  useDocumentTitle(config.title);

  const [sp, setSp] = useSearchParams();
  const filters = useMemo(() => parseAdminFilters(sp), [sp]);
  const list = useAsync(() => taxonomyService.list(kind, { search: filters.search || undefined, status: filters.status }), [kind, sp.toString()]);

  const [dialog, setDialog] = useState<{ open: boolean; item: TaxonomyItem | null }>({ open: false, item: null });
  const [removing, setRemoving] = useState<TaxonomyItem | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const items = list.data ?? [];
  const filtered = !!(filters.search || filters.status);

  const run = async (id: number, action: () => Promise<unknown>, okMessage: string) => {
    setBusyId(id);
    setError('');
    setNotice('');
    try {
      await action();
      setNotice(okMessage);
      list.reload();
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <AdminPageHeader
        title={config.title}
        crumbs={[{ label: 'Tổng quan', to: ROUTES.ADMIN_HOME }, { label: config.title }]}
        actions={<button type="button" className="btn btn--primary" onClick={() => setDialog({ open: true, item: null })}>Thêm {config.singular}</button>}
      />

      {notice && <div className="alert alert--success admin-alert" role="status">{notice}</div>}
      {error && <div className="alert alert--error admin-alert" role="alert">{error}</div>}

      <AdminListToolbar
        search={filters.search}
        status={filters.status}
        placeholder={`Tìm ${config.singular}`}
        onSearch={(q) => setSp(patchAdminParams(sp, { search: q }))}
        onStatus={(s) => setSp(patchAdminParams(sp, { status: s }))}
      />

      {list.error ? (
        <ErrorState message={toMessage(list.error)} onRetry={list.reload} />
      ) : !list.data ? (
        <LoadingBlock label="Đang tải danh sách..." />
      ) : items.length === 0 ? (
        <EmptyState
          title={filtered ? `Không tìm thấy ${config.singular} phù hợp` : `Chưa có ${config.singular} nào`}
          hint={filtered ? 'Hãy kiểm tra lại từ khóa hoặc bộ lọc.' : `Bấm "Thêm ${config.singular}" để tạo mới.`}
        />
      ) : (
        <div className={`table-wrap${list.loading ? ' is-loading' : ''}`}>
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Tên</th>
                {config.hasBio && <th scope="col">Tiểu sử</th>}
                <th scope="col">Trạng thái</th>
                <th scope="col" className="table__actions-col">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id} className={it.status === 'inactive' ? 'is-muted' : undefined}>
                  <td className="table__strong">{it.name}</td>
                  {config.hasBio && <td className="table__bio">{it.bio || '—'}</td>}
                  <td><EntityStatusBadge status={it.status} /></td>
                  <td className="table__actions">
                    <button type="button" className="btn btn--ghost" disabled={busyId === it.id} onClick={() => setDialog({ open: true, item: it })}>Sửa</button>
                    {it.status === 'active' ? (
                      <button type="button" className="btn btn--ghost btn--danger" disabled={busyId === it.id} onClick={() => setRemoving(it)}>Ngừng hoạt động</button>
                    ) : (
                      <button type="button" className="btn btn--ghost" disabled={busyId === it.id}
                        onClick={() => run(it.id, () => taxonomyService.activate(kind, it), `Đã kích hoạt lại ${config.singular} "${it.name}"`)}>
                        Kích hoạt lại
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <TaxonomyFormDialog
        config={config}
        open={dialog.open}
        item={dialog.item}
        onClose={() => setDialog({ open: false, item: null })}
        onSaved={(message) => {
          setDialog({ open: false, item: null });
          setError('');
          setNotice(message);
          list.reload();
        }}
      />

      <ConfirmDialog
        open={removing !== null}
        title={`Ngừng hoạt động ${config.singular} này?`}
        message={`"${removing?.name ?? ''}" sẽ được chuyển sang trạng thái ngừng hoạt động (xóa mềm): không còn để chọn mới nhưng không ảnh hưởng đến sách, đơn hàng và lịch sử đọc đã có. Bạn có thể kích hoạt lại bất cứ lúc nào.`}
        confirmLabel="Ngừng hoạt động"
        cancelLabel="Giữ lại"
        busy={busyId !== null}
        onConfirm={async () => {
          const target = removing;
          if (!target) return;
          await run(target.id, () => taxonomyService.deactivate(kind, target.id), `Đã chuyển ${config.singular} "${target.name}" sang ngừng hoạt động`);
          setRemoving(null);
        }}
        onCancel={() => setRemoving(null)}
      />
    </>
  );
}
