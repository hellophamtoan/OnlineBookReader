// UC004 bước 3-9 - Thanh toán / đặt hàng (O01).
// Bước 3: hiện giỏ + form. Bước 4-5: nhập thông tin nhận hàng, chọn thanh toán. Bước 6-8: gửi đơn, server kiểm tra rồi tạo đơn.
// Luồng 7a: lỗi thì giữ nguyên form để người dùng sửa lại (không mất dữ liệu đã nhập).
import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
import { cartProblems } from '../utils/order';
import { hasErrors, validateCheckout } from '../utils/validators';
import type { CheckoutFormValues } from '../utils/validators';

export default function CheckoutPage() {
  useDocumentTitle('Đặt hàng');
  const navigate = useNavigate();
  const { cart, refresh, reset } = useCart();
  const { values, setValues, errors, setErrors, setFieldError, onChange } = useForm<CheckoutFormValues>({
    receiverName: '', receiverPhone: '', shippingAddress: '', paymentMethod: 'COD', note: '',
  });

  const [ready, setReady] = useState(false);
  const [generalError, setGeneralError] = useState('');
  const [loading, setLoading] = useState(false);

  // Hồ sơ (U01): điền sẵn thông tin nhận hàng + biết số dư ví. Lỗi thì bỏ qua, người dùng tự nhập.
  const profile = useAsync(() => userService.getProfile(), []);
  const balance = profile.data ? profile.data.walletBalance : null;

  // Lấy giỏ mới nhất (giá, tồn kho có thể đã đổi)
  useEffect(() => {
    refresh().catch(() => {}).finally(() => setReady(true));
  }, [refresh]);

  // Điền sẵn đúng một lần, không ghi đè những gì người dùng đã gõ
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

  // Ví không đủ tiền (sau khi giỏ đổi) thì tự về COD
  useEffect(() => {
    if (values.paymentMethod === 'WALLET' && balance !== null && balance < cart.totalAmount) {
      setValues((v) => ({ ...v, paymentMethod: 'COD' }));
    }
  }, [balance, cart.totalAmount, values.paymentMethod, setValues]);

  const problems = cartProblems(cart);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setGeneralError('');
    if (problems.length > 0) return setGeneralError('Giỏ hàng còn sách không thể đặt. Hãy quay lại giỏ hàng để chỉnh sửa.');

    // Bước 7 (phía client): kiểm tra thông tin; server vẫn kiểm tra lại cùng với tồn kho và số dư ví
    const errs = validateCheckout(values);
    setErrors(errs);
    if (hasErrors(errs)) return;

    try {
      setLoading(true);
      const order = await orderService.createOrder({ ...values, paymentMethod: values.paymentMethod as PaymentMethod });
      reset(); // BE đã xóa giỏ trong cùng giao dịch
      navigate(ROUTES.ORDER_DETAIL(order.id), { replace: true, state: { justOrdered: true } }); // bước 9
    } catch (err) {
      setLoading(false);
      // Luồng 7a: báo lỗi, giữ nguyên form
      if (err instanceof ApiError) {
        const fieldErrors = err.errors.filter((fe) => fe.field in values);
        if (fieldErrors.length) return fieldErrors.forEach((fe) => setFieldError(fe.field as keyof CheckoutFormValues, fe.message));
        if (err.code === 'OUT_OF_STOCK' || err.code === 'EMPTY_CART') {
          setGeneralError(err.message);
          return void refresh().catch(() => {}); // cập nhật lại giỏ để thấy dòng nào hết hàng
        }
        if (err.code === 'INSUFFICIENT_BALANCE') {
          setGeneralError(err.message);
          return profile.reload(); // lấy lại số dư ví mới nhất
        }
      }
      setGeneralError(toMessage(err));
    }
  };

  if (!ready && cart.items.length === 0) return <div className="container page"><LoadingBlock label="Đang chuẩn bị đơn hàng..." /></div>;
  if (cart.items.length === 0) {
    return (
      <div className="container page">
        <EmptyState
          title="Giỏ hàng đang trống"
          hint="Hãy thêm sách vào giỏ trước khi đặt hàng."
          action={<Link className="btn btn--primary" to={ROUTES.BOOKS}>Xem tất cả sách</Link>}
        />
      </div>
    );
  }

  return (
    <div className="container page">
      <h1 className="page__title">Đặt hàng</h1>

      <div className="checkout">
        <form id="checkout-form" className="checkout__form" onSubmit={handleSubmit} noValidate>
          {generalError && <div className="alert alert--error" role="alert">{generalError}</div>}
          {problems.length > 0 && (
            <div className="alert alert--error" role="alert">
              Có {problems.length} sách không thể đặt (hết hàng hoặc vượt tồn kho). <Link to={ROUTES.CART}>Quay lại giỏ hàng</Link> để chỉnh sửa.
            </div>
          )}

          <fieldset className="form-section">
            <legend className="form-section__title">Thông tin nhận hàng</legend>
            <Field label="Họ tên người nhận" name="receiverName" autoComplete="name" maxLength={RULES.RECEIVER_NAME_MAX}
              value={values.receiverName} error={errors.receiverName} onChange={onChange} />
            <Field label="Số điện thoại" name="receiverPhone" type="tel" inputMode="numeric" autoComplete="tel" maxLength={10} placeholder="09xxxxxxxx"
              value={values.receiverPhone} error={errors.receiverPhone} onChange={onChange} />
            <Field label="Địa chỉ giao hàng" name="shippingAddress" autoComplete="street-address" maxLength={RULES.ADDRESS_MAX}
              hint="Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành phố"
              value={values.shippingAddress} error={errors.shippingAddress} onChange={onChange} />
            <Field label="Ghi chú (không bắt buộc)" name="note" maxLength={RULES.NOTE_MAX} placeholder="Ví dụ: giao giờ hành chính"
              value={values.note} error={errors.note} onChange={onChange} />
          </fieldset>

          <PaymentMethodPicker
            value={values.paymentMethod}
            total={cart.totalAmount}
            walletBalance={balance}
            error={errors.paymentMethod}
            disabled={loading}
            onChange={(m) => setValues((v) => ({ ...v, paymentMethod: m }))}
          />
        </form>

        <OrderSummary
          title="Đơn hàng của bạn"
          className="checkout__summary"
          lines={cart.items.map((i) => ({ key: i.bookId, title: i.title, quantity: i.quantity, unitPrice: i.unitPrice, subtotal: i.subtotal }))}
          total={cart.totalAmount}
        >
          <button type="submit" form="checkout-form" className="btn btn--primary btn--block btn--lg" disabled={loading || problems.length > 0}>
            {loading ? 'Đang xử lý...' : 'Đặt hàng'}
          </button>
          <Link to={ROUTES.CART} className="summary__back">Chỉnh sửa giỏ hàng</Link>
        </OrderSummary>
      </div>
    </div>
  );
}
