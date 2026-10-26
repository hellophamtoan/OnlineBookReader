// UC004 - Giỏ hàng (K01-K05): xem, đổi số lượng, xóa dòng, xóa toàn bộ, rồi sang trang thanh toán.
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import CartItemRow from '../components/cart/CartItemRow';
import ConfirmDialog from '../components/common/ConfirmDialog';
import { EmptyState, ErrorState, LoadingBlock } from '../components/common/States';
import OrderSummary from '../components/order/OrderSummary';
import { useCart } from '../context/CartContext';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { ROUTES } from '../config/routes';
import { toMessage } from '../utils/errors';
import { cartProblems } from '../utils/order';

export default function CartPage() {
  useDocumentTitle('Giỏ hàng');
  const navigate = useNavigate();
  const { cart, refresh, updateItem, removeItem, clear } = useCart();

  const [ready, setReady] = useState(false); // đã lấy giỏ mới nhất từ server ít nhất một lần
  const [loadError, setLoadError] = useState('');
  const [busyId, setBusyId] = useState<number | 'all' | null>(null);
  const [error, setError] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);

  // Vào trang là lấy giỏ mới nhất: giá và tồn kho có thể đã đổi từ lúc thêm vào giỏ
  const load = () => {
    setLoadError('');
    refresh()
      .catch((e) => setLoadError(toMessage(e)))
      .finally(() => setReady(true));
  };
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Chạy một thao tác trên giỏ; lỗi (vd. OUT_OF_STOCK) thì báo và đồng bộ lại giỏ cho khớp server
  const run = async (id: number | 'all', action: () => Promise<void>) => {
    setBusyId(id);
    setError('');
    try {
      await action();
    } catch (e) {
      setError(toMessage(e));
      await refresh().catch(() => {});
    } finally {
      setBusyId(null);
    }
  };

  const items = cart.items;
  const problems = cartProblems(cart);

  if (!ready && items.length === 0) return <div className="container page"><LoadingBlock label="Đang tải giỏ hàng..." /></div>;
  if (loadError && items.length === 0) return <div className="container page"><ErrorState message={loadError} onRetry={load} /></div>;
  if (items.length === 0) {
    return (
      <div className="container page">
        <EmptyState
          title="Giỏ hàng của bạn đang trống"
          hint="Chọn vài cuốn sách yêu thích rồi quay lại đây để đặt hàng."
          action={<Link className="btn btn--primary" to={ROUTES.BOOKS}>Xem tất cả sách</Link>}
        />
      </div>
    );
  }

  return (
    <div className="container page">
      <h1 className="page__title">Giỏ hàng</h1>
      {error && <div className="alert alert--error cart__alert" role="alert">{error}</div>}

      <div className="cart">
        <section className="cart__list" aria-label="Sách trong giỏ hàng">
          <ul>
            {items.map((item) => (
              <CartItemRow
                key={item.bookId}
                item={item}
                busy={busyId === item.bookId || busyId === 'all'}
                onQuantity={(bookId, q) => run(bookId, () => updateItem(bookId, q))}
                onRemove={(bookId) => run(bookId, () => removeItem(bookId))}
              />
            ))}
          </ul>
          <div className="cart__tools">
            <Link to={ROUTES.BOOKS} className="btn btn--ghost">Tiếp tục mua sắm</Link>
            <button type="button" className="btn btn--ghost btn--danger" onClick={() => setConfirmClear(true)} disabled={busyId !== null}>
              Xóa toàn bộ giỏ hàng
            </button>
          </div>
        </section>

        <OrderSummary
          title="Tạm tính"
          className="cart__summary"
          lines={items.map((i) => ({ key: i.bookId, title: i.title, quantity: i.quantity, unitPrice: i.unitPrice, subtotal: i.subtotal }))}
          total={cart.totalAmount}
        >
          {problems.length > 0 && (
            <p className="field__error" role="alert">
              Có {problems.length} sách không thể đặt (hết hàng hoặc vượt tồn kho). Hãy giảm số lượng hoặc xóa khỏi giỏ để tiếp tục.
            </p>
          )}
          <button
            type="button"
            className="btn btn--primary btn--block btn--lg"
            disabled={problems.length > 0 || busyId !== null}
            onClick={() => navigate(ROUTES.CHECKOUT)}
          >
            Tiến hành đặt hàng
          </button>
        </OrderSummary>
      </div>

      <ConfirmDialog
        open={confirmClear}
        title="Xóa toàn bộ giỏ hàng?"
        message="Tất cả sách trong giỏ sẽ bị xóa. Bạn có thể thêm lại từ trang sách."
        confirmLabel="Xóa hết"
        cancelLabel="Giữ lại"
        busy={busyId === 'all'}
        onConfirm={async () => {
          await run('all', clear);
          setConfirmClear(false);
        }}
        onCancel={() => setConfirmClear(false)}
      />
    </div>
  );
}
