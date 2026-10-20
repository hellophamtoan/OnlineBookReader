import { useState } from 'react';
import type { FormEvent } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { authService } from '../../services/authservice';
import { ROUTES } from '../../config/routes';
import { RULES } from '../../config/rules';
import Logo from '../common/Logo';
import ConfirmDialog from '../common/ConfirmDialog';

// Menu chính. Thêm UC mới = thêm 1 dòng (vd. { to: ROUTES.PLANS, label: 'Gói đọc sách' } khi làm UC005).
const NAV_ITEMS = [
  { to: ROUTES.HOME, label: 'Trang chủ', end: true },
  { to: ROUTES.BOOKS, label: 'Sách', end: false },
];

export default function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [keyword, setKeyword] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const submitSearch = (e: FormEvent) => {
    e.preventDefault();
    const q = keyword.trim();
    navigate(q ? `${ROUTES.BOOKS}?search=${encodeURIComponent(q)}` : ROUTES.BOOKS);
  };

  // UC002 nhánh B: xác nhận -> xóa phiên -> về trang chủ
  const confirmLogout = async () => {
    setBusy(true);
    await authService.logout();
    logout();
    setBusy(false);
    setConfirmOpen(false);
    navigate(ROUTES.HOME);
  };

  return (
    <header className="header">
      <div className="header__inner container">
        <Logo />

        <nav className="header__nav" aria-label="Menu chính">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => `header__link${isActive ? ' is-active' : ''}`}>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <form className="header__search" role="search" onSubmit={submitSearch}>
          <input
            type="search"
            className="input"
            placeholder="Tìm tên sách hoặc tác giả"
            aria-label="Tìm sách"
            value={keyword}
            maxLength={RULES.SEARCH_MAX}
            onChange={(e) => setKeyword(e.target.value)}
          />
          <button type="submit" className="btn btn--primary">Tìm</button>
        </form>

        <div className="header__account">
          {user ? (
            <>
              <div className="user">
                <span className="user__avatar" aria-hidden="true">{user.fullName.charAt(0).toUpperCase()}</span>
                <span className="user__text">
                  <span className="user__name">{user.fullName}</span>
                  {user.role === 'ADMIN' && <span className="user__role">Quản trị viên</span>}
                </span>
              </div>
              <button type="button" className="btn btn--ghost" onClick={() => setConfirmOpen(true)}>Đăng xuất</button>
            </>
          ) : (
            <>
              <NavLink to={ROUTES.LOGIN} className="btn btn--ghost">Đăng nhập</NavLink>
              <NavLink to={ROUTES.REGISTER} className="btn btn--primary">Đăng ký</NavLink>
            </>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Đăng xuất khỏi tài khoản?"
        message="Phiên đăng nhập hiện tại sẽ kết thúc. Bạn có thể đăng nhập lại bất cứ lúc nào."
        confirmLabel="Đăng xuất"
        cancelLabel="Ở lại"
        busy={busy}
        onConfirm={confirmLogout}
        onCancel={() => setConfirmOpen(false)}
      />
    </header>
  );
}
