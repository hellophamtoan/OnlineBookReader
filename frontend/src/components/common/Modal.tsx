import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  busy?: boolean; // đang gửi dữ liệu: khóa việc đóng
  wide?: boolean;
  children: ReactNode;
}

// Hộp thoại chứa form (ConfirmDialog chỉ dành cho câu hỏi Có/Không). Esc hoặc bấm nền = đóng.
// Vẽ qua portal ra <body> vì cùng lý do với ConfirmDialog (cha có backdrop-filter làm "fixed" bị kẹt).
export default function Modal({ open, title, onClose, busy, wide, children }: ModalProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !busy && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, busy, onClose]);

  if (!open) return null;
  return createPortal(
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div ref={ref} tabIndex={-1} className={`dialog${wide ? ' dialog--wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <h2 id="modal-title" className="dialog__title">{title}</h2>
        {children}
      </div>
    </div>,
    document.body
  );
}
