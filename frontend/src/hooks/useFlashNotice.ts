// hooks/useFlashNotice.ts
// Thông báo "một lần" truyền qua điều hướng: navigate(to, { state: { notice: 'Đã lưu...' } }).
// Trang đích hiện thông báo rồi xóa state để F5 không hiện lại (cùng cách làm với OrderDetailPage).
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

export function useFlashNotice() {
  const location = useLocation();
  const navigate = useNavigate();
  const incoming = (location.state as { notice?: string } | null)?.notice ?? '';
  const [notice, setNotice] = useState(incoming);

  useEffect(() => {
    if (incoming) navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return [notice, setNotice] as const;
}
