import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { ROUTES } from '../../config/routes';
import type { Book } from '../../types';
import { isPhysical } from '../../utils/book';
import { formatPrice } from '../../utils/format';
import { toMessage } from '../../utils/errors';
import ReadBookButton from '../reader/ReadBookButton';

/** Chi tiết sách (USER): icon giỏ + mua ngay. ADMIN không hiện khối mua. */
export default function BookActions({ book, hideRead = false }: { book: Book; hideRead?: boolean }) {
  const { user } = useAuth();
  const { addItem } = useCart();
  const navigate = useNavigate();
  const location = useLocation();
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Admin / chưa phải USER: không hiện mua hàng
  if (user?.role === 'ADMIN') {
    return !hideRead ? <ReadBookButton book={book} /> : null;
  }

  const physical = isPhysical(book);
  const stock = book.stockQuantity ?? 0;
  const canBuy = physical && stock > 0;
  const isUser = user?.role === 'USER';
  const maxQty = Math.min(99, Math.max(1, stock));

  const goLogin = () => navigate(ROUTES.LOGIN, { state: { from: location } });

  const addToCart = async () => {
    if (!isUser) return goLogin();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await addItem(book.id, qty);
      setNotice('Đã thêm vào giỏ hàng');
      setQty(1);
    } catch (e) {
      setError(toMessage(e));
    } finally {
      setBusy(false);
    }
  };

  /** Chỉ đặt đúng sách + số lượng đang chọn trên trang chi tiết */
  const buyNow = () => {
    if (!isUser) return goLogin();
    if (!canBuy) return;
    navigate(ROUTES.CHECKOUT, {
      state: {
        orderItems: [
          {
            bookId: book.id,
            quantity: qty,
            title: book.title,
            unitPrice: book.price ?? 0,
            coverUrl: book.coverUrl,
            subtotal: (book.price ?? 0) * qty,
          },
        ],
        buyNow: true,
      },
    });
  };

  return (
    <>
      {physical && (
        <div className="buy" style={{ marginTop: 16 }}>
          {!canBuy ? (
            <p className="detail__note">Sách giấy đã hết hàng hoặc không thể đặt mua.</p>
          ) : (
            <>
              <div className="buy__row">
                <div className="qty" role="group" aria-label="Số lượng">
                  <button
                    type="button"
                    className="qty__btn"
                    disabled={busy || qty <= 1}
                    onClick={() => setQty((q) => Math.max(1, q - 1))}
                    aria-label="Giảm số lượng"
                  >
                    −
                  </button>
                  <input className="qty__input" type="text" inputMode="numeric" value={qty} readOnly aria-label="Số lượng" />
                  <button
                    type="button"
                    className="qty__btn"
                    disabled={busy || qty >= maxQty}
                    onClick={() => setQty((q) => Math.min(maxQty, q + 1))}
                    aria-label="Tăng số lượng"
                  >
                    +
                  </button>
                </div>
                <button
                  type="button"
                  className="header__cart buy__cart-btn"
                  disabled={busy}
                  onClick={addToCart}
                  aria-label="Thêm vào giỏ hàng"
                  title="Thêm vào giỏ hàng"
                >
                  <span aria-hidden="true">🛒</span>
                </button>
                <button type="button" className="btn btn--primary" disabled={busy} onClick={buyNow}>
                  Mua ngay
                </button>
              </div>
              {book.price != null && (
                <p className="buy__hint">Thành tiền tạm tính: {formatPrice(book.price * qty)}</p>
              )}
              {notice && (
                <p className="buy__hint" role="status">
                  {notice} · <Link to={ROUTES.CART}>Xem giỏ hàng</Link>
                </p>
              )}
              {error && (
                <p className="buy__hint" role="alert" style={{ color: 'var(--danger)' }}>
                  {error}
                </p>
              )}
              {!user && <p className="buy__hint">Đăng nhập để thêm sách vào giỏ và đặt hàng.</p>}
            </>
          )}
        </div>
      )}
      {!hideRead && <ReadBookButton book={book} />}
    </>
  );
}
