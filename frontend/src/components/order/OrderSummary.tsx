import type { ReactNode } from 'react';
import { formatPrice } from '../../utils/format';

export interface SummaryLine {
  key: string | number;
  title: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

interface OrderSummaryProps {
  title: string;
  lines: SummaryLine[];
  total: number;
  totalLabel?: string;
  children?: ReactNode; // nút hành động / thông báo đặt dưới tổng tiền
  className?: string;
}

// Khối tóm tắt "tên sách, số lượng x đơn giá, thành tiền, tổng". Dùng chung cho giỏ hàng, thanh toán và chi tiết đơn.
export default function OrderSummary({ title, lines, total, totalLabel = 'Tổng cộng', children, className = '' }: OrderSummaryProps) {
  return (
    <section className={`summary ${className}`} aria-label={title}>
      <h2 className="summary__title">{title}</h2>
      <ul className="summary__lines">
        {lines.map((l) => (
          <li key={l.key} className="summary__line">
            <span className="summary__name">{l.title}</span>
            <span className="summary__qty">{l.quantity} × {formatPrice(l.unitPrice)}</span>
            <span className="summary__sub">{formatPrice(l.subtotal)}</span>
          </li>
        ))}
      </ul>
      <p className="summary__total">
        <span>{totalLabel}</span>
        <strong>{formatPrice(total)}</strong>
      </p>
      {children}
    </section>
  );
}
