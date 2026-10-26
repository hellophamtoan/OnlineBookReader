import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { ADMIN_NAV_GROUPS } from '../../config/admin';
import { ROUTES } from '../../config/routes';
import { useAuth } from '../../context/AuthContext';
import Avatar from '../common/Avatar';
import Logo from '../common/Logo';
import LogoutButton from '../common/LogoutButton';

// Khung quản trị: sidebar + top bar. Trên màn hẹp: nút 3 gạch mở menu;
// hàng tên tài khoản + đăng xuất luôn nằm trên đầu khi thu hẹp.
export default function AdminLayout() {
  const { user } = useAuth();
  const [sideOpen, setSideOpen] = useState(false);

  useEffect(() => {
    if (!sideOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSideOpen(false);
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [sideOpen]);

  const closeSide = () => setSideOpen(false);

  return (
    <div className={`admin${sideOpen ? ' is-side-open' : ''}`}>
      <a href="#admin-main" className="skip-link">
        Bỏ qua, tới nội dung chính
      </a>

      {sideOpen && <div className="admin__overlay" onClick={closeSide} aria-hidden="true" />}

      <aside className="admin__side" aria-label="Menu quản trị" id="admin-side-nav">
        <div className="admin__brand">
          <Logo />
          <span className="admin__badge">Quản trị</span>
          <button type="button" className="admin__side-close btn btn--ghost" onClick={closeSide} aria-label="Đóng menu">
            ✕
          </button>
        </div>
        <nav className="admin__nav">
          {ADMIN_NAV_GROUPS.map((g) => (
            <div key={g.title} className="admin__group">
              <p className="admin__group-title">{g.title}</p>
              <ul>
                {g.items.map((i) => (
                  <li key={i.to}>
                    <NavLink
                      to={i.to}
                      end={i.end}
                      className={({ isActive }) => `admin__link${isActive ? ' is-active' : ''}`}
                      onClick={closeSide}
                    >
                      {i.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </aside>

      <div className="admin__body">
        <header className="admin__top">
          <div className="admin__top-left">
            <button
              type="button"
              className="admin__menu-btn"
              aria-label={sideOpen ? 'Đóng menu' : 'Mở menu'}
              aria-expanded={sideOpen}
              aria-controls="admin-side-nav"
              onClick={() => setSideOpen((o) => !o)}
            >
              <span className="admin__menu-icon" aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
            </button>
            <Link to={ROUTES.HOME} className="admin__site-link">
              ← Xem trang bán sách
            </Link>
          </div>
          <div className="admin__user">
            {user && (
              <Link to={ROUTES.ADMIN_PROFILE} className="user user--link" aria-label="Thông tin cá nhân">
                <Avatar name={user.fullName} src={user.avatarUrl} size="sm" className="user__avatar" />
                <span className="user__text">
                  <span className="user__name">{user.fullName}</span>
                  <span className="user__role">Quản trị viên</span>
                </span>
              </Link>
            )}
            <LogoutButton />
          </div>
        </header>
        <main id="admin-main" className="admin__content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
