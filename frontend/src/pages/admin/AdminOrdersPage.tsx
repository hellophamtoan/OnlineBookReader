// UC009 — Danh sách đơn hàng admin (status khớp BE: PREPARING thay cho CONFIRMED)
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import { EmptyState, ErrorState, LoadingBlock } from '../../components/common/States';
import { ORDER_STATUSES, PAYMENT_METHODS } from '../../config/orders';
import { ROUTES } from '../../config/routes';
import { useAsync } from '../../hooks/useAsync';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { orderAdminService } from '../../services/admin/orderadminservice';
import { formatDateTime, formatPrice } from '../../utils/format';
import { toMessage } from '../../utils/errors';
import { statusMeta } from '../../utils/order';
import type { OrderStatus } from '../../types';

export default function AdminOrdersPage() {
  useDocumentTitle('Đơn hàng');
  const [sp, setSp] = useSearchParams();
  const status = (sp.get('status') || '') as OrderStatus | '';
  const paymentMethod = sp.get('paymentMethod') || '';
  const q = sp.get('q') || '';
  const from = sp.get('from') || '';
  const to = sp.get('to') || '';
  const page = Math.max(1, Number(sp.get('page')) || 1);

  const [qInput, setQInput] = useState(q);

  const query = useMemo(
    () => ({
      page,
      limit: 20,
      status: status || undefined,
      paymentMethod: paymentMethod || undefined,
      q: q || undefined,
      from: from || undefined,
      to: to || undefined,
    }),
    [page, status, paymentMethod, q, from, to],
  );

  const list = useAsync(
    () => orderAdminService.list(query),
    [query.page, query.status, query.paymentMethod, query.q, query.from, query.to],
  );

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
        title="Đơn hàng bán lẻ"
        subtitle="Xác nhận (Đang chuẩn bị), giao hàng, hủy — hoàn kho/ví khi cần."
        crumbs={[{ label: 'Tổng quan', to: ROUTES.ADMIN_HOME }, { label: 'Đơn hàng' }]}
      />

      <div className="admin-toolbar" style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <form
          style={{ display: 'flex', gap: 8, flex: '1 1 260px' }}
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
            placeholder="Mã đơn, SĐT, tên, email..."
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
          />
          <button type="submit" className="btn btn--primary">
            Tìm
          </button>
        </form>
        <select
          className="input"
          style={{ maxWidth: 180 }}
          value={status}
          onChange={(e) =>
            patch((n) => {
              if (e.target.value) n.set('status', e.target.value);
              else n.delete('status');
              n.set('page', '1');
            })
          }
        >
          <option value="">Mọi trạng thái</option>
          {ORDER_STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <select
          className="input"
          style={{ maxWidth: 140 }}
          value={paymentMethod}
          onChange={(e) =>
            patch((n) => {
              if (e.target.value) n.set('paymentMethod', e.target.value);
              else n.delete('paymentMethod');
              n.set('page', '1');
            })
          }
        >
          <option value="">Mọi TT</option>
          {PAYMENT_METHODS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
        <input
          type="date"
          className="input"
          style={{ maxWidth: 150 }}
          value={from}
          onChange={(e) =>
            patch((n) => {
              if (e.target.value) n.set('from', e.target.value);
              else n.delete('from');
              n.set('page', '1');
            })
          }
          aria-label="Từ ngày"
        />
        <input
          type="date"
          className="input"
          style={{ maxWidth: 150 }}
          value={to}
          onChange={(e) =>
            patch((n) => {
              if (e.target.value) n.set('to', e.target.value);
              else n.delete('to');
              n.set('page', '1');
            })
          }
          aria-label="Đến ngày"
        />
      </div>

      {list.error ? (
        <ErrorState message={toMessage(list.error)} onRetry={list.reload} />
      ) : !data ? (
        <LoadingBlock label="Đang tải đơn hàng..." />
      ) : data.items.length === 0 ? (
        <EmptyState title="Không có đơn hàng" hint="Thử đổi bộ lọc hoặc từ khóa." />
      ) : (
        <>
          <p className="admin-count">
            Có <b>{data.total}</b> đơn
          </p>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Mã</th>
                  <th>Khách</th>
                  <th>Người nhận</th>
                  <th>Trạng thái</th>
                  <th>Thanh toán</th>
                  <th className="table__num">Tổng</th>
                  <th>Ngày tạo</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((o) => {
                  const meta = statusMeta(o.status);
                  return (
                    <tr key={o.id}>
                      <td className="table__strong">#{o.id}</td>
                      <td>
                        <div>{o.userFullName}</div>
                        <div className="field__hint">{o.userEmail}</div>
                      </td>
                      <td>
                        <div>{o.receiverName}</div>
                        <div className="field__hint">{o.receiverPhone}</div>
                      </td>
                      <td>
                        <span className={`tag tag--${meta.tone}`}>{meta.label}</span>
                      </td>
                      <td>
                        {o.paymentMethod}
                        <div className="field__hint">{o.paymentStatus}</div>
                      </td>
                      <td className="table__num">{formatPrice(o.totalAmount)}</td>
                      <td>{formatDateTime(o.createdAt)}</td>
                      <td>
                        <Link className="btn btn--ghost btn--sm" to={ROUTES.ADMIN_ORDER_DETAIL(o.id)}>
                          Chi tiết
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="admin-pager" style={{ display: 'flex', gap: 8, marginTop: 16 }}>
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
                Trang {page}/{totalPages}
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
