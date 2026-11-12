import type { ReactNode } from 'react';

// Ba trạng thái dùng lại ở mọi trang: đang tải / lỗi / rỗng.
// Lỗi nói rõ chuyện gì xảy ra và cách xử lý; trạng thái rỗng gợi ý việc nên làm tiếp.

// [Giao diện] Khối "Đang tải..." khi chờ dữ liệu.
export function LoadingBlock({ label = 'Đang tải...' }: { label?: string }) {
  return (
    <div className="state" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      <p>{label}</p>
    </div>
  );
}

// [Giao diện] Khối báo lỗi kèm nút Thử lại.
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="state state--error" role="alert">
      <p className="state__title">Không tải được dữ liệu</p>
      <p>{message}</p>
      {onRetry && <button type="button" className="btn btn--ghost" onClick={onRetry}>Thử lại</button>}
    </div>
  );
}

// [Giao diện] Khối báo danh sách trống (chưa có sách, đơn hàng...).
export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="state">
      <p className="state__title">{title}</p>
      {hint && <p>{hint}</p>}
      {action}
    </div>
  );
}
