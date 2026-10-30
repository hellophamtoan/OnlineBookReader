import type { FormEvent, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import Logo from '../common/Logo';

interface AuthLayoutProps {
  title: string;
  subtitle: string;
  error?: string;
  success?: string;
  loading: boolean;
  submitText: string;
  onSubmit: (e: FormEvent) => void;
  footerText: string;
  footerLinkText: string;
  footerLinkTo: string;
  children: ReactNode; // các ô nhập (Field)
}

// Khung chung của Đăng nhập / Đăng ký: logo, tiêu đề, thông báo, form, nút gửi, dòng chuyển trang
export default function AuthLayout({
  title, subtitle, error, success, loading, submitText, onSubmit, footerText, footerLinkText, footerLinkTo, children,
}: AuthLayoutProps) {
  return (
    <div className="auth">
      <div className="auth__card">
        <Logo />
        <h1 className="auth__title">{title}</h1>
        <p className="auth__subtitle">{subtitle}</p>

        {error && <div className="alert alert--error" role="alert">{error}</div>}
        {success && <div className="alert alert--success" role="status">{success}</div>}

        <form onSubmit={onSubmit} noValidate className="auth__form">
          {children}
          <button type="submit" className="btn btn--primary btn--block" disabled={loading}>
            {loading ? 'Đang xử lý...' : submitText}
          </button>
        </form>

        <p className="auth__footer">
          {footerText}{' '}
          <Link to={footerLinkTo}>{footerLinkText}</Link>
        </p>
      </div>
    </div>
  );
}
