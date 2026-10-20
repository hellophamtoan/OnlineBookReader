import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

// Hộp thoại xác nhận (UC002 nhánh B: xác nhận đăng xuất). Esc hoặc bấm nền = hủy.
// Vẽ qua portal ra <body>: Header có backdrop-filter nên nếu để hộp thoại nằm trong Header,
// "position: fixed" sẽ tính theo Header (bị kẹt ở trên cùng) thay vì theo cả màn hình.
export default function ConfirmDialog({ open, title, message, confirmLabel, cancelLabel, busy, onConfirm, onCancel }: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !busy && onCancel();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, busy, onCancel]);

  if (!open) return null;
  return createPortal(
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && !busy && onCancel()}>
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="dlg-title">
        <h2 id="dlg-title" className="dialog__title">{title}</h2>
        <p className="dialog__text">{message}</p>
        <div className="dialog__actions">
          <button ref={cancelRef} type="button" className="btn btn--ghost" onClick={onCancel} disabled={busy}>{cancelLabel}</button>
          <button type="button" className="btn btn--primary" onClick={onConfirm} disabled={busy}>{busy ? 'Đang xử lý...' : confirmLabel}</button>
        </div>
      </div>
    </div>,
    document.body
  );
}