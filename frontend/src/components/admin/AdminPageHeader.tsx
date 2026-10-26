import { Fragment } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

export interface Crumb {
  label: string;
  to?: string; // bỏ trống = mục hiện tại
}

interface AdminPageHeaderProps {
  title: string;
  subtitle?: string;
  crumbs?: Crumb[];
  actions?: ReactNode;
}

// Đầu trang của mọi trang quản trị: đường dẫn, tiêu đề, nút hành động
export default function AdminPageHeader({ title, subtitle, crumbs, actions }: AdminPageHeaderProps) {
  return (
    <header className="admin-head">
      {crumbs && (
        <nav className="breadcrumb" aria-label="Vị trí trang">
          {crumbs.map((c, i) => (
            <Fragment key={c.label}>
              {i > 0 && <span aria-hidden="true">/</span>}
              {c.to ? <Link to={c.to}>{c.label}</Link> : <span aria-current="page">{c.label}</span>}
            </Fragment>
          ))}
        </nav>
      )}
      <div className="admin-head__row">
        <div>
          <h1 className="admin-head__title">{title}</h1>
          {subtitle && <p className="admin-head__sub">{subtitle}</p>}
        </div>
        {actions && <div className="admin-head__actions">{actions}</div>}
      </div>
    </header>
  );
}
