// UC004 - Đơn hàng của tôi (O02): danh sách, lọc theo trạng thái, phân trang, hủy đơn chờ xác nhận (O04).
// Bộ lọc lưu trên URL (?status=PENDING&page=2) giống trang Sách.
import { useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Pagination from '../components/common/Pagination';
import { EmptyState, ErrorState, LoadingBlock } from '../components/common/States';
import OrderCard from '../components/order/OrderCard';
import { ORDER_STATUSES } from '../config/orders';
import { PAGINATION } from '../config/rules';
import { ROUTES } from '../config/routes';
import { useAsync } from '../hooks/useAsync';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { orderService } from '../services/orderservice';
import type { OrderStatus } from '../types';
import { toMessage } from '../utils/errors';
import { parseOrderFilters, patchOrderParams, toOrderQuery } from '../utils/orderFilters';

export default function MyOrdersPage() {
  useDocumentTitle('Đơn hàng của tôi');
  const [sp, setSp] = useSearchParams();
  const filters = useMemo(() => parseOrderFilters(sp), [sp]);

  const result = useAsync(
    () => orderService.getMyOrders(toOrderQuery(filters, PAGINATION.ORDERS_PER_PAGE)),
    [sp.toString()]
  );
  const data = result.data;
  const totalPages = data?.pagination.totalPages ?? 1;

  // Đang ở trang vượt quá số trang (vd. vừa hủy hết đơn ở trang cuối) -> về trang cuối
  useEffect(() => {
    if (data && data.pagination.total > 0 && filters.page > totalPages) setSp(patchOrderParams(sp, { page: totalPages }), { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const setStatus = (status: OrderStatus | '') => setSp(patchOrderParams(sp, { status }));
  const goToPage = (page: number) => {
    setSp(patchOrderParams(sp, { page }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="container page">
      <h1 className="page__title">Đơn hàng của tôi</h1>

      <div className="tabs" role="group" aria-label="Lọc theo trạng thái">
        <button type="button" className="tabs__item" aria-pressed={!filters.status} onClick={() => setStatus('')}>Tất cả</button>
        {ORDER_STATUSES.map((s) => (
          <button key={s.value} type="button" className="tabs__item" aria-pressed={filters.status === s.value} onClick={() => setStatus(s.value)}>
            {s.label}
          </button>
        ))}
      </div>

      <section aria-live="polite">
        {result.error ? (
          <ErrorState message={toMessage(result.error)} onRetry={result.reload} />
        ) : !data ? (
          <LoadingBlock label="Đang tải đơn hàng..." />
        ) : data.items.length === 0 ? (
          filters.status ? (
            <EmptyState
              title="Không có đơn hàng ở trạng thái này"
              action={<button type="button" className="btn btn--ghost" onClick={() => setStatus('')}>Xem tất cả đơn hàng</button>}
            />
          ) : (
            <EmptyState
              title="Bạn chưa có đơn hàng nào"
              hint="Đơn hàng sau khi đặt sẽ hiện ở đây để bạn theo dõi."
              action={<Link className="btn btn--primary" to={ROUTES.BOOKS}>Xem tất cả sách</Link>}
            />
          )
        ) : (
          <div className={result.loading ? 'is-loading' : undefined}>
            <ul className="orders">
              {data.items.map((o) => (
                <li key={o.id}><OrderCard order={o} onChanged={result.reload} /></li>
              ))}
            </ul>
            <Pagination page={data.pagination.page} totalPages={totalPages} onChange={goToPage} />
          </div>
        )}
      </section>
    </div>
  );
}
