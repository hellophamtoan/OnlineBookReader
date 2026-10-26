import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ROUTES, profileFor } from '../../config/routes';
import { RULES } from '../../config/rules';
import type { Role } from '../../types';
import Avatar from '../common/Avatar';
import Logo from '../common/Logo';
import LogoutButton from '../common/LogoutButton';

const NAV_ITEMS: { to: string; label: string; end: boolean; roles?: Role[] }[] = [
  { to: ROUTES.HOME, label: 'Trang chủ', end: true },
  { to: ROUTES.BOOKS, label: 'Sách', end: false },
  { to: ROUTES.LIBRARY, label: 'Thư viện', end: false, roles: ['USER'] },
  { to: ROUTES.ADMIN_HOME, label: 'Quản trị', end: false, roles: ['ADMIN'] },
];

export default function Header() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [keyword, setKeyword] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);

  const visibleNav = NAV_ITEMS.filter((item) => !item.roles || (user && item.roles.includes(user.role)));

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [menuOpen]);

  const submitSearch = (e: FormEvent) => {
    e.preventDefault();
    const q = keyword.trim();
    navigate(q ? `${ROUTES.BOOKS}?search=${encodeURIComponent(q)}` : ROUTES.BOOKS);
    setMenuOpen(false);
  };

  const sideMenu =
    typeof document !== 'undefined'
      ? createPortal(
          <>
            {menuOpen && (
              <div className="side-nav-overlay" onClick={() => setMenuOpen(false)} aria-hidden="true" />
            )}
            <aside
              id="site-side-nav"
              className={`side-nav${menuOpen ? ' is-open' : ''}`}
              aria-hidden={!menuOpen}
              aria-label="Menu điều hướng"
            >
              <div className="side-nav__head">
                <span className="side-nav__title">Menu</span>
                <button type="button" className="btn btn--ghost" onClick={() => setMenuOpen(false)} aria-label="Đóng menu">
                  Đóng
                </button>
              </div>
              <nav className="side-nav__list">
                {visibleNav.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) => `side-nav__link${isActive ? ' is-active' : ''}`}
                    onClick={() => setMenuOpen(false)}
                  >
                    {item.label}
                  </NavLink>
                ))}
                {user ? (
                  <NavLink to={profileFor(user.role)} className="side-nav__link" onClick={() => setMenuOpen(false)}>
                    Thông tin cá nhân
                  </NavLink>
                ) : (
                  <>
                    <NavLink to={ROUTES.LOGIN} className="side-nav__link" onClick={() => setMenuOpen(false)}>
                      Đăng nhập
                    </NavLink>
                    <NavLink to={ROUTES.REGISTER} className="side-nav__link" onClick={() => setMenuOpen(false)}>
                      Đăng ký
                    </NavLink>
                  </>
                )}
              </nav>
            </aside>
          </>,
          document.body,
        )
      : null;

  return (
    <header className="header">
      <div className="header__inner container">
        <button
          type="button"
          className="header__menu-btn"
          aria-label={menuOpen ? 'Đóng menu' : 'Mở menu'}
          aria-expanded={menuOpen}
          aria-controls="site-side-nav"
          onClick={() => setMenuOpen((o) => !o)}
        >
          <span className="header__menu-icon" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
        </button>

        <Logo />

        <nav className="header__nav header__nav--desktop" aria-label="Menu chính">
          {visibleNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `header__link${isActive ? ' is-active' : ''}`}
            >
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
          <button type="submit" className="btn btn--primary">
            Tìm
          </button>
        </form>

        {/* Tên tài khoản + Đăng xuất luôn ở góc trên bên phải */}
        <div className="header__account">
          {user ? (
            <>
              <NavLink
                to={profileFor(user.role)}
                className="user user--link"
                aria-label={`Thông tin cá nhân của ${user.fullName}`}
              >
                <Avatar name={user.fullName} src={user.avatarUrl} size="sm" className="user__avatar" />
                <span className="user__text">
                  <span className="user__name">{user.fullName}</span>
                  {user.role === 'ADMIN' && <span className="user__role">Quản trị viên</span>}
                </span>
              </NavLink>
              <LogoutButton />
            </>
          ) : (
            <>
              <NavLink to={ROUTES.LOGIN} className="btn btn--ghost">
                Đăng nhập
              </NavLink>
              <NavLink to={ROUTES.REGISTER} className="btn btn--primary">
                Đăng ký
              </NavLink>
            </>
          )}
        </div>
      </div>
      {sideMenu}
    </header>
  );
}
