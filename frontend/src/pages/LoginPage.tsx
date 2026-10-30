// UC002 - Đăng nhập (API-02). Đăng xuất nằm ở Header (hộp thoại xác nhận).
import { useState } from 'react';
import type { FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import AuthLayout from '../components/layout/AuthLayout';
import Field from '../components/common/Field';
import { useAuth } from '../context/AuthContext';
import { useForm } from '../hooks/useForm';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { authService } from '../services/authservice';
import { ROUTES, homeFor } from '../config/routes';
import { toMessage } from '../utils/errors';
import { hasErrors, validateLogin } from '../utils/validators';

interface LocationState {
  from?: { pathname: string; search?: string }; // ProtectedRoute gửi tới để quay lại sau khi đăng nhập
  email?: string; // RegisterPage gửi tới để điền sẵn
  registered?: boolean;
}

export default function LoginPage() {
  useDocumentTitle('Đăng nhập');
  const { login } = useAuth();
  const navigate = useNavigate();
  const state = (useLocation().state ?? {}) as LocationState;

  const { values, errors, setErrors, onChange } = useForm({ email: state.email ?? '', password: '' });
  const [generalError, setGeneralError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setGeneralError('');

    const errs = validateLogin(values);
    setErrors(errs);
    if (hasErrors(errs)) return;

    try {
      setLoading(true);
      const { token, user } = await authService.login(values.email, values.password);
      login(token, user);
      // Bước A5: vào trang chủ bán sách; nếu bị chặn từ trang khác thì quay lại trang đó
      const target = state.from ? `${state.from.pathname}${state.from.search ?? ''}` : homeFor(user.role);
      navigate(target, { replace: true });
    } catch (err) {
      setLoading(false);
      // Luồng A4a: sai thông tin / tài khoản bị khóa -> báo lỗi, giữ lại email để nhập lại mật khẩu
      setGeneralError(toMessage(err));
    }
  };

  return (
    <AuthLayout
      title="Đăng nhập"
      subtitle="Chào mừng bạn quay lại."
      error={generalError}
      success={state.registered && !generalError ? 'Tạo tài khoản thành công. Hãy đăng nhập để tiếp tục.' : ''}
      loading={loading}
      submitText="Đăng nhập"
      onSubmit={handleSubmit}
      footerText="Chưa có tài khoản?"
      footerLinkText="Đăng ký"
      footerLinkTo={ROUTES.REGISTER}
    >
      <Field label="Email" name="email" type="email" autoComplete="email" placeholder="ten@example.com"
        value={values.email} error={errors.email} onChange={onChange} />
      <Field label="Mật khẩu" name="password" password autoComplete="current-password"
        value={values.password} error={errors.password} onChange={onChange} />
    </AuthLayout>
  );
}
