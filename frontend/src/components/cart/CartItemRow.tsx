import { Link } from 'react-router-dom';
import { ROUTES } from '../../config/routes';
import type { CartItem } from '../../types';
import { formatPrice } from '../../utils/format';
import { lineProblem } from '../../utils/order';
import BookCover from '../book/BookCover';
import QuantityStepper from '../common/QuantityStepper';

interface CartItemRowProps {
  item: CartItem;
  busy: boolean;
  selected: boolean;
  onToggle: (bookId: number, selected: boolean) => void;
  onQuantity: (bookId: number, quantity: number) => void;
  onRemove: (bookId: number) => void;
}

export default function CartItemRow({ item, busy, selected, onToggle, onQuantity, onRemove }: CartItemRowProps) {
  const problem = lineProblem(item);
  const locked = !!problem;
  const to = ROUTES.BOOK_DETAIL(item.bookId);

  return (
    <li
      className={`cart-row${locked ? ' has-problem is-unavailable' : ''}${busy ? ' is-busy' : ''}`}
      style={locked ? { opacity: 0.55, filter: 'grayscale(0.35)' } : undefined}
    >
      <label className="cart-row__check">
        <input
          type="checkbox"
          checked={selected && !locked}
          disabled={locked || busy}
          onChange={(e) => onToggle(item.bookId, e.target.checked)}
          aria-label={`Chọn ${item.title} để đặt hàng`}
        />
      </label>
      <Link to={to} className="cart-row__cover" aria-hidden="true" tabIndex={-1}>
        <BookCover book={{ id: item.bookId, title: item.title, coverUrl: item.coverUrl, authors: [] }} />
      </Link>
      <div className="cart-row__main">
        <Link to={to} className="cart-row__title">
          {item.title}
        </Link>
        <p className="cart-row__price">{formatPrice(item.unitPrice)}</p>
        {problem && (
          <p className="field__error" role="status">
            {problem} — không thể đặt mua, chỉ có thể xóa khỏi giỏ
          </p>
        )}
      </div>
      {locked ? (
        <span className="cart-row__qty-locked" aria-label="Không đổi số lượng">
          SL: {item.quantity}
        </span>
      ) : (
        <QuantityStepper
          value={item.quantity}
          max={item.stockQuantity}
          disabled={busy}
          label={`Số lượng ${item.title}`}
          onChange={(q) => onQuantity(item.bookId, q)}
        />
      )}
      <p className="cart-row__subtotal">{formatPrice(item.subtotal)}</p>
      <button
        type="button"
        className="cart-row__remove"
        disabled={busy}
        onClick={() => onRemove(item.bookId)}
        aria-label={`Xóa ${item.title} khỏi giỏ hàng`}
      >
        Xóa
      </button>
    </li>
  );
}
