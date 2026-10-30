// UC004 — Đặt hàng: từ giỏ (sách đã chọn) hoặc Mua ngay (1 sách + SL trên trang chi tiết)
import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Field from '../components/common/Field';
import { EmptyState, LoadingBlock } from '../components/common/States';
import OrderSummary from '../components/order/OrderSummary';
import PaymentMethodPicker from '../components/order/PaymentMethodPicker';
import { RULES } from '../config/rules';
import { ROUTES } from '../config/routes';
import { useCart } from '../context/CartContext';
import { useAsync } from '../hooks/useAsync';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useForm } from '../hooks/useForm';
import { ApiError } from '../services/api';
import { orderService } from '../services/orderservice';
import { userService } from '../services/userservice';
import type { PaymentMethod } from '../types';
import { toMessage } from '../utils/errors';
import { hasErrors, validateCheckout } from '../utils/validators';
import type { CheckoutFormValues } from '../utils/validators';

export type CheckoutOrderItem = {
  bookId: number;
  quantity: number;
  title: string;
  unitPrice: number;
  coverUrl?: string | null;
  subtotal: number;
};

type CheckoutLocationState = {
  orderItems?: CheckoutOrderItem[];
  buyNow?: boolean;
};

export default function CheckoutPage() {
  useDocumentTitle('Đặt hàng');
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state ?? {}) as CheckoutLocationState;
  const { cart, refresh, reset } = useCart();
  const { values, setValues, errors, setErrors, setFieldError, onChange } = useForm<CheckoutFormValues>({
    receiverName: '',
    receiverPhone: '',
    shippingAddress: '',
    paymentMethod: 'COD',
    note: '',
  });

  const [ready, setReady] = useState(false);
  const [generalError, setGeneralError] = useState('');
  const [loading, setLoading] = useState(false);

  const profile = useAsync(() => userService.getProfile(), []);
  const balance = profile.data ? profile.data.walletBalance : null;

  // Ưu tiên orderItems từ giỏ (đã chọn) hoặc Mua ngay; không thì cả giỏ
  const orderItems: CheckoutOrderItem[] = useMemo(() => {
    if (state.orderItems && state.orderItems.length > 0) return state.orderItems;
    return cart.items.map((i) => ({
      bookId: i.bookId,
      quantity: i.quantity,
      title: i.title,
      unitPrice: i.unitPrice,
      coverUrl: i.coverUrl,
      subtotal: i.subtotal,
    }));
  }, [state.orderItems, cart.items]);

  const totalAmount = orderItems.reduce((s, i) => s + i.subtotal, 0);

  useEffect(() => {
    refresh()
      .catch(() => {})
      .finally(() => setReady(true));
  }, [refresh]);

  const prefilled = useRef(false);
  useEffect(() => {
    const p = profile.data;
    if (!p || prefilled.current) return;
    prefilled.current = true;
    setValues((v) => ({
      ...v,
      receiverName: v.receiverName || p.fullName,
      receiverPhone: v.receiverPhone || p.phone || '',
      shippingAddress: v.shippingAddress || p.address || '',
    }));
  }, [profile.data, setValues]);

  useEffect(() => {
    if (values.paymentMethod === 'WALLET' && balance !== null && balance < totalAmount) {
      setValues((v) => ({ ...v, paymentMethod: 'COD' }));
    }
  }, [balance, totalAmount, values.paymentMethod, setValues]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setGeneralError('');
    if (orderItems.length === 0) {
      setGeneralError('Không có sách để đặt hàng.');
      return;
    }

    const errs = validateCheckout(values);
    setErrors(errs);
    if (hasErrors(errs)) return;

    try {
      setLoading(true);
      const order = await orderService.createOrder({
        ...values,
        paymentMethod: values.paymentMethod as PaymentMethod,
        source: state.buyNow ? 'buy_now' : 'cart',
        items: orderItems.map((i) => ({ bookId: i.bookId, quantity: i.quantity })),
      });
      // Làm mới giỏ (mock chỉ xóa các dòng đã đặt)
      await refresh().catch(() => reset());
      navigate(ROUTES.ORDER_DETAIL(order.id), { replace: true, state: { justOrdered: true } });
    } catch (err) {
      setLoading(false);
      if (err instanceof ApiError) {
        const fieldErrors = err.errors.filter((fe) => fe.field in values);
        if (fieldErrors.length) {
          return fieldErrors.forEach((fe) => setFieldError(fe.field as keyof CheckoutFormValues, fe.message));
        }
        if (err.code === 'OUT_OF_STOCK' || err.code === 'EMPTY_CART') {
          setGeneralError(err.message);
          return void refresh().catch(() => {});
        }
        if (err.code === 'INSUFFICIENT_BALANCE') {
          setGeneralError(err.message);
          return profile.reload();
        }
      }
      setGeneralError(toMessage(err));
    }
  };

  if (!ready && orderItems.length === 0) {
    return (
      <div className="container page">
        <LoadingBlock label="Đang chuẩn bị đơn hàng..." />
      </div>
    );
  }

  if (orderItems.length === 0) {
    return (
      <div className="container page">
        <EmptyState
          title="Không có sách để đặt"
          hint="Hãy chọn sách trong giỏ hoặc mua ngay từ trang chi tiết."
          action={
            <Link className="btn btn--primary" to={ROUTES.CART}>
              Về giỏ hàng
            </Link>
          }
        />
      </div>
    );
  }

  const backTo = state.buyNow ? ROUTES.BOOKS : ROUTES.CART;

  return (
    <div className="container page">
      <div className="page-back-row">
        <Link className="btn btn--ghost page-back-row__btn" to={backTo}>
          ← Trở lại
        </Link>
      </div>
      <h1 className="page__title">{state.buyNow ? 'Mua ngay' : 'Đặt hàng'}</h1>
      {generalError && (
        <div className="alert alert--error" role="alert">
          {generalError}
        </div>
      )}

      <div className="checkout">
        <form className="checkout__form" onSubmit={handleSubmit} noValidate>
          <fieldset className="form-section">
            <legend className="form-section__title">Thông tin nhận hàng</legend>
            <p className="field__hint">Đã điền từ hồ sơ cá nhân — bạn có thể sửa trước khi đặt.</p>
            <Field
              label="Họ và tên người nhận"
              name="receiverName"
              value={values.receiverName}
              error={errors.receiverName}
              onChange={onChange}
              maxLength={RULES.RECEIVER_NAME_MAX}
            />
            <Field
              label="Số điện thoại"
              name="receiverPhone"
              value={values.receiverPhone}
              error={errors.receiverPhone}
              onChange={onChange}
              maxLength={10}
            />
            <Field
              label="Địa chỉ giao hàng"
              name="shippingAddress"
              value={values.shippingAddress}
              error={errors.shippingAddress}
              onChange={onChange}
              maxLength={RULES.ADDRESS_MAX}
              hint="Lấy từ hồ sơ; có thể đổi cho đơn này"
            />
            <Field
              label="Ghi chú"
              name="note"
              value={values.note}
              error={errors.note}
              onChange={onChange}
              maxLength={RULES.NOTE_MAX}
              hint="Không bắt buộc"
            />
          </fieldset>

          <fieldset className="form-section">
            <legend className="form-section__title">Thanh toán</legend>
            <PaymentMethodPicker
              value={values.paymentMethod}
              total={totalAmount}
              walletBalance={balance}
              onChange={(m) => setValues((v) => ({ ...v, paymentMethod: m }))}
            />
          </fieldset>

          <button type="submit" className="btn btn--primary btn--lg" disabled={loading}>
            {loading ? 'Đang đặt hàng...' : 'Xác nhận đặt hàng'}
          </button>
        </form>

        <OrderSummary
          title={state.buyNow ? 'Sách mua ngay' : 'Sách đặt hàng'}
          className="checkout__summary"
          lines={orderItems.map((i) => ({
            key: i.bookId,
            title: i.title,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            subtotal: i.subtotal,
          }))}
          total={totalAmount}
        />
      </div>
    </div>
  );
}
