import { Link } from 'react-router-dom';
import { ROUTES } from '../../config/routes';
import type { CartItem } from '../../types';
import { formatPrice } from '../../utils/format';
import { lineProblem } from '../../utils/order';
import BookCover from '../book/BookCover';
import QuantityStepper from '../common/QuantityStepper';

interface CartItemRowProps {
  item: CartItem;
  busy: boolean; // đang gọi API cho dòng này
  onQuantity: (bookId: number, quantity: number) => void;
  onRemove: (bookId: number) => void;
}

// Một dòng trong giỏ hàng (K01). Dòng có vấn đề (hết hàng / vượt tồn kho) hiện cảnh báo và chặn thanh toán ở trang giỏ.
export default function CartItemRow({ item, busy, onQuantity, onRemove }: CartItemRowProps) {
  const problem = lineProblem(item);
  const to = ROUTES.BOOK_DETAIL(item.bookId);

  return (
    <li className={`cart-row${problem ? ' has-problem' : ''}${busy ? ' is-busy' : ''}`}>
      <Link to={to} className="cart-row__cover" aria-hidden="true" tabIndex={-1}>
        <BookCover book={{ id: item.bookId, title: item.title, coverUrl: item.coverUrl, authors: [] }} />
      </Link>

      <div className="cart-row__main">
        <Link to={to} className="cart-row__title">{item.title}</Link>
        <p className="cart-row__price">{formatPrice(item.unitPrice)}</p>
        {problem && <p className="field__error" role="alert">{problem}</p>}
      </div>

      <QuantityStepper
        value={item.quantity}
        max={item.available ? item.stockQuantity : 0}
        disabled={busy}
        label={`Số lượng ${item.title}`}
        onChange={(q) => onQuantity(item.bookId, q)}
      />

      <p className="cart-row__subtotal">{formatPrice(item.subtotal)}</p>

      <button type="button" className="cart-row__remove" disabled={busy} onClick={() => onRemove(item.bookId)} aria-label={`Xóa ${item.title} khỏi giỏ hàng`}>
        Xóa
      </button>
    </li>
  );
}
