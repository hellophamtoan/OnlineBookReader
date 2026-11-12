import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../../config/routes';
import { useAuth } from '../../context/AuthContext';
import { authService } from '../../services/authservice';
import ConfirmDialog from './ConfirmDialog';

// UC002 nhánh B: nút "Đăng xuất" + hộp thoại xác nhận. Dùng ở Header (khung site) và AdminLayout (khung quản trị).
export default function LogoutButton({ className = 'btn btn--ghost' }: { className?: string }) {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    setBusy(true);
    await authService.logout();
    logout();
    setBusy(false);
    setOpen(false);
    navigate(ROUTES.HOME);
  };

  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>Đăng xuất</button>
      <ConfirmDialog
        open={open}
        title="Đăng xuất khỏi tài khoản?"
        message="Phiên đăng nhập hiện tại sẽ kết thúc. Bạn có thể đăng nhập lại bất cứ lúc nào."
        confirmLabel="Đăng xuất"
        cancelLabel="Ở lại"
        busy={busy}
        onConfirm={confirm}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}
