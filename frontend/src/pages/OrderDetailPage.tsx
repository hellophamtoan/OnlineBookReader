// UC004 - Chi tiết & theo dõi một đơn hàng (O03). Cũng là trang báo "Đặt hàng thành công" (bước 9) sau khi đặt xong.
import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { EmptyState, ErrorState, LoadingBlock } from '../components/common/States';
import CancelOrderButton from '../components/order/CancelOrderButton';
import OrderStatusBadge from '../components/order/OrderStatusBadge';
import OrderSummary from '../components/order/OrderSummary';
import OrderTimeline from '../components/order/OrderTimeline';
import { ROUTES } from '../config/routes';
import { useAsync } from '../hooks/useAsync';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { ApiError } from '../services/api';
import { orderService } from '../services/orderservice';
import { toMessage } from '../utils/errors';
import { formatDateTime } from '../utils/format';
import { paymentLabel } from '../utils/order';

export default function OrderDetailPage() {
  const id = Number(useParams().id);
  const validId = Number.isInteger(id) && id >= 1;
  const navigate = useNavigate();
  const location = useLocation();

  // CheckoutPage chuyển sang đây kèm state.justOrdered: giữ lại thông báo rồi xóa state để F5 không hiện lại
  const [justOrdered] = useState(!!(location.state as { justOrdered?: boolean } | null)?.justOrdered);
  useEffect(() => {
    if (justOrdered) navigate(location.pathname, { replace: true, state: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { data: order, loading, error, reload } = useAsync(
    () => (validId ? orderService.getOrder(id) : Promise.reject(new ApiError('Không tìm thấy đơn hàng', 404))),
    [id]
  );
  useDocumentTitle(order ? `Đơn hàng #${order.id}` : 'Đơn hàng');

  if (loading && !order) return <div className="container page"><LoadingBlock label="Đang tải đơn hàng..." /></div>;

  if (error || !order) {
    const notFound = error instanceof ApiError && (error.status === 404 || error.status === 400);
    return (
      <div className="container page">
        {notFound ? (
          <EmptyState title="Không tìm thấy đơn hàng" hint="Đơn hàng không tồn tại hoặc không thuộc về tài khoản của bạn." action={<Link className="btn btn--ghost" to={ROUTES.MY_ORDERS}>Về đơn hàng của tôi</Link>} />
        ) : (
          <ErrorState message={toMessage(error)} onRetry={reload} />
        )}
      </div>
    );
  }

  return (
    <div className="container page">
      <nav className="breadcrumb" aria-label="Vị trí trang">
        <Link to={ROUTES.MY_ORDERS}>Đơn hàng của tôi</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">Đơn #{order.id}</span>
      </nav>

      {justOrdered && (
        <div className="alert alert--success order-detail__done" role="status">
          Đặt hàng thành công. Cửa hàng sẽ xác nhận đơn của bạn sớm nhất có thể; bạn theo dõi trạng thái ngay tại trang này.
        </div>
      )}

      <header className="order-detail__head">
        <h1 className="order-detail__title">Đơn hàng #{order.id}</h1>
        <OrderStatusBadge status={order.status} />
      </header>

      <OrderTimeline status={order.status} />

      <div className="order-detail">
        <section className="order-detail__info" aria-label="Thông tin đơn hàng">
          <h2 className="form-section__title">Thông tin đơn hàng</h2>
          <dl className="detail__meta">
            <dt>Ngày đặt</dt><dd>{formatDateTime(order.createdAt)}</dd>
            <dt>Người nhận</dt><dd>{order.receiverName}</dd>
            <dt>Số điện thoại</dt><dd>{order.receiverPhone}</dd>
            <dt>Địa chỉ giao hàng</dt><dd>{order.shippingAddress}</dd>
            <dt>Thanh toán</dt><dd>{paymentLabel(order.paymentMethod)}</dd>
            {order.note && (<><dt>Ghi chú</dt><dd>{order.note}</dd></>)}
          </dl>
          <div className="order-detail__actions">
            <CancelOrderButton order={order} onChanged={reload} />
            <Link to={ROUTES.BOOKS} className="btn btn--ghost">Tiếp tục mua sắm</Link>
          </div>
        </section>

        <OrderSummary
          title="Sách đã đặt"
          lines={order.items.map((i) => ({ key: i.bookId, title: i.title, quantity: i.quantity, unitPrice: i.unitPrice, subtotal: i.subtotal }))}
          total={order.totalAmount}
          totalLabel="Tổng tiền"
        />
      </div>
    </div>
  );
}
