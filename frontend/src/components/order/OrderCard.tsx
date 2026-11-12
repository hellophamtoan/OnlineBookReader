import { Link } from 'react-router-dom';
import { ROUTES } from '../../config/routes';
import type { Order } from '../../types';
import { formatDateTime, formatPrice } from '../../utils/format';
import { paymentLabel } from '../../utils/order';
import CancelOrderButton from './CancelOrderButton';
import OrderStatusBadge from './OrderStatusBadge';

// Một đơn trong danh sách "Đơn hàng của tôi" (O02)
export default function OrderCard({ order, onChanged }: { order: Order; onChanged: () => void }) {
  const quantity = order.items.reduce((n, i) => n + i.quantity, 0);
  const shown = order.items.slice(0, 2).map((i) => i.title).join(', ');
  const rest = order.items.length - 2;

  return (
    <article className="order-card">
      <header className="order-card__head">
        <Link to={ROUTES.ORDER_DETAIL(order.id)} className="order-card__id">Đơn hàng #{order.id}</Link>
        <OrderStatusBadge status={order.status} />
      </header>
      <p className="order-card__date">Đặt lúc {formatDateTime(order.createdAt)}</p>
      <p className="order-card__items">{shown}{rest > 0 && ` và ${rest} sách khác`}</p>
      <p className="order-card__meta">
        <span>{quantity} cuốn</span>
        <span>{paymentLabel(order.paymentMethod)}</span>
      </p>
      <footer className="order-card__foot">
        <strong className="order-card__total">{formatPrice(order.totalAmount)}</strong>
        <div className="order-card__actions">
          <CancelOrderButton order={order} onChanged={onChanged} />
          <Link to={ROUTES.ORDER_DETAIL(order.id)} className="btn btn--ghost">Xem chi tiết</Link>
        </div>
      </footer>
    </article>
  );
}
