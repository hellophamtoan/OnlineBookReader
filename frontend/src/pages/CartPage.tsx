// UC004 - Giỏ hàng: chọn sách cần đặt, đổi SL, xóa, sang thanh toán
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import CartItemRow from '../components/cart/CartItemRow';
import ConfirmDialog from '../components/common/ConfirmDialog';
import { EmptyState, ErrorState, LoadingBlock } from '../components/common/States';
import OrderSummary from '../components/order/OrderSummary';
import { useCart } from '../context/CartContext';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { ROUTES } from '../config/routes';
import { toMessage } from '../utils/errors';
import { lineProblem } from '../utils/order';

export default function CartPage() {
  useDocumentTitle('Giỏ hàng');
  const navigate = useNavigate();
  const { cart, refresh, updateItem, removeItem, clear } = useCart();

  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [busyId, setBusyId] = useState<number | 'all' | null>(null);
  const [error, setError] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const didInitSelect = useRef(false);

  const load = () => {
    setLoadError('');
    refresh()
      .catch((e) => setLoadError(toMessage(e)))
      .finally(() => setReady(true));
  };
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Đồng bộ chọn: lần đầu chọn hết dòng hợp lệ; sau đó chỉ bỏ id không còn trong giỏ / bị lỗi
  useEffect(() => {
    const validIds = cart.items.filter((i) => !lineProblem(i)).map((i) => i.bookId);
    setSelected((prev) => {
      if (!didInitSelect.current) {
        didInitSelect.current = true;
        return new Set(validIds);
      }
      const next = new Set<number>();
      for (const id of prev) {
        if (validIds.includes(id)) next.add(id);
      }
      return next;
    });
  }, [cart.items]);

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
  const selectable = useMemo(() => items.filter((i) => !lineProblem(i)), [items]);
  const selectedItems = useMemo(() => items.filter((i) => selected.has(i.bookId) && !lineProblem(i)), [items, selected]);
  const selectedTotal = selectedItems.reduce((s, i) => s + i.subtotal, 0);
  const allSelected = selectable.length > 0 && selectable.every((i) => selected.has(i.bookId));
  const canCheckout = selectedItems.length > 0;

  const toggle = (bookId: number, on: boolean) => {
    setSelected((prev) => {
      const n = new Set(prev);
      if (on) n.add(bookId);
      else n.delete(bookId);
      return n;
    });
  };

  const toggleAll = (on: boolean) => {
    if (!on) setSelected(new Set());
    else setSelected(new Set(selectable.map((i) => i.bookId)));
  };

  if (!ready && items.length === 0) {
    return (
      <div className="container page">
        <LoadingBlock label="Đang tải giỏ hàng..." />
      </div>
    );
  }
  if (loadError && items.length === 0) {
    return (
      <div className="container page">
        <ErrorState message={loadError} onRetry={load} />
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <div className="container page">
        <EmptyState
          title="Giỏ hàng của bạn đang trống"
          hint="Chọn vài cuốn sách yêu thích rồi quay lại đây để đặt hàng."
          action={
            <Link className="btn btn--primary" to={ROUTES.BOOKS}>
              Xem tất cả sách
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="container page">
      <h1 className="page__title">Giỏ hàng</h1>
      {error && (
        <div className="alert alert--error cart__alert" role="alert">
          {error}
        </div>
      )}

      <div className="cart">
        <section className="cart__list" aria-label="Sách trong giỏ hàng">
          <div className="cart__select-all">
            <label>
              <input
                type="checkbox"
                checked={allSelected}
                onChange={(e) => toggleAll(e.target.checked)}
                disabled={selectable.length === 0 || busyId !== null}
              />{' '}
              Chọn tất cả sách có thể đặt ({selectable.length})
            </label>
          </div>
          <ul>
            {items.map((item) => (
              <CartItemRow
                key={item.bookId}
                item={item}
                busy={busyId === item.bookId || busyId === 'all'}
                selected={selected.has(item.bookId)}
                onToggle={toggle}
                onQuantity={(bookId, q) => run(bookId, () => updateItem(bookId, q))}
                onRemove={(bookId) => run(bookId, () => removeItem(bookId))}
              />
            ))}
          </ul>
          <div className="cart__tools">
            <Link to={ROUTES.BOOKS} className="btn btn--ghost">
              Tiếp tục mua sắm
            </Link>
            <button
              type="button"
              className="btn btn--ghost btn--danger"
              onClick={() => setConfirmClear(true)}
              disabled={busyId !== null}
            >
              Xóa toàn bộ giỏ hàng
            </button>
          </div>
        </section>

        <OrderSummary
          title="Tạm tính (đã chọn)"
          className="cart__summary"
          lines={selectedItems.map((i) => ({
            key: i.bookId,
            title: i.title,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            subtotal: i.subtotal,
          }))}
          total={selectedTotal}
        >
          {selectedItems.length === 0 && (
            <p className="field__error" role="alert">
              Hãy chọn ít nhất một sách để đặt hàng.
            </p>
          )}
          <button
            type="button"
            className="btn btn--primary btn--block btn--lg"
            disabled={!canCheckout || busyId !== null}
            onClick={() =>
              navigate(ROUTES.CHECKOUT, {
                state: {
                  orderItems: selectedItems.map((i) => ({
                    bookId: i.bookId,
                    quantity: i.quantity,
                    title: i.title,
                    unitPrice: i.unitPrice,
                    coverUrl: i.coverUrl,
                    subtotal: i.subtotal,
                  })),
                },
              })
            }
          >
            Đặt hàng ({selectedItems.length} loại)
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
