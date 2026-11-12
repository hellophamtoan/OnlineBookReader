import { useState } from 'react';
import { ApiError } from '../../services/api';
import { orderService } from '../../services/orderservice';
import type { Order } from '../../types';
import { toMessage } from '../../utils/errors';
import { canCancel } from '../../utils/order';
import ConfirmDialog from '../common/ConfirmDialog';

interface CancelOrderButtonProps {
  order: Pick<Order, 'id' | 'status' | 'paymentMethod'>;
  onChanged: () => void; // đơn đã đổi (hủy xong, hoặc trạng thái đã khác) -> nơi gọi tải lại dữ liệu
}

// Nút "Hủy đơn" + hộp thoại xác nhận (O04). Chỉ hiện với đơn PENDING. Dùng ở danh sách và trang chi tiết đơn.
export default function CancelOrderButton({ order, onChanged }: CancelOrderButtonProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!canCancel(order)) return null;

  const confirm = async () => {
    setBusy(true);
    setError('');
    try {
      await orderService.cancelOrder(order.id);
      setOpen(false);
      onChanged();
    } catch (err) {
      setOpen(false);
      setError(toMessage(err));
      // Cửa hàng đã xác nhận đơn trước đó (INVALID_STATUS_TRANSITION): tải lại để thấy trạng thái mới
      if (err instanceof ApiError && err.code === 'INVALID_STATUS_TRANSITION') onChanged();
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button type="button" className="btn btn--ghost btn--danger" onClick={() => setOpen(true)}>Hủy đơn</button>
      {error && <p className="field__error" role="alert">{error}</p>}
      <ConfirmDialog
        open={open}
        title={`Hủy đơn hàng #${order.id}?`}
        message={
          order.paymentMethod === 'WALLET'
            ? 'Số lượng sách được hoàn lại kho và tiền được hoàn vào ví của bạn. Thao tác này không thể hoàn tác.'
            : 'Số lượng sách được hoàn lại kho. Thao tác này không thể hoàn tác.'
        }
        confirmLabel="Hủy đơn"
        cancelLabel="Giữ lại"
        busy={busy}
        onConfirm={confirm}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}
