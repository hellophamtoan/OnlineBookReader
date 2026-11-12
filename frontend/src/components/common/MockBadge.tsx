import { env } from '../../config/env';
import { TOKEN_KEY, USER_KEY } from '../../services/api';

// Nhãn nhỏ góc trái dưới khi đang chạy dữ liệu giả, để biết mình đang test mock hay BE thật.
// Bấm vào nhãn để xóa dữ liệu mock (tài khoản đã đăng ký, phiên đăng nhập) và tải lại trang.
export default function MockBadge() {
  if (!env.USE_MOCK) return null;

  const reset = () => {
    if (!window.confirm('Xóa dữ liệu mock (tài khoản đã đăng ký, phiên đăng nhập) và tải lại trang?')) return;
    Object.keys(localStorage)
      .filter((k) => k.startsWith('mock_'))
      .forEach((k) => localStorage.removeItem(k));
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    window.location.reload();
  };

  return (
    <button type="button" className="mock-badge" onClick={reset} title="Đang dùng dữ liệu giả. Bấm để xóa dữ liệu mock.">
      Dữ liệu giả
    </button>
  );
}
