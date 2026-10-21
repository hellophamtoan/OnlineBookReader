// UC001 - Đăng ký tài khoản (API-01)
import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthLayout from '../components/layout/AuthLayout';
import Field from '../components/common/Field';
import { useForm } from '../hooks/useForm';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { authService } from '../services/authservice';
import { ApiError } from '../services/api';
import { AUTH, RULES } from '../config/rules';
import { ROUTES } from '../config/routes';
import { toMessage } from '../utils/errors';
import { hasErrors, validateRegister } from '../utils/validators';

export default function RegisterPage() {
  useDocumentTitle('Đăng ký');
  const navigate = useNavigate();
  const { values, errors, setErrors, setFieldError, onChange } = useForm({ fullName: '', email: '', password: '', confirmPassword: '' });
  const [generalError, setGeneralError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const timer = useRef<number>();

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setGeneralError('');

    // Bước 4: kiểm tra phía client (server vẫn kiểm tra lại)
    const errs = validateRegister(values);
    setErrors(errs);
    if (hasErrors(errs)) return;

    try {
      setLoading(true);
      await authService.register(values);
      // Bước 6: báo thành công rồi chuyển sang đăng nhập (không tự cấp JWT)
      setSuccess('Tạo tài khoản thành công. Đang chuyển đến trang đăng nhập...');
      timer.current = window.setTimeout(
        () => navigate(ROUTES.LOGIN, { state: { email: values.email.trim().toLowerCase(), registered: true } }),
        AUTH.REDIRECT_DELAY_MS
      );
    } catch (err) {
      setLoading(false);
      // Luồng 4a: báo lỗi ngay trên form, người dùng nhập lại
      if (err instanceof ApiError) {
        if (err.status === 409 || err.code === 'EMAIL_EXISTS') return setFieldError('email', err.message);
        const fieldErrors = err.errors.filter((fe) => fe.field in values);
        if (fieldErrors.length) return fieldErrors.forEach((fe) => setFieldError(fe.field as keyof typeof values, fe.message));
      }
      setGeneralError(toMessage(err));
    }
  };

  return (
    <AuthLayout
      title="Tạo tài khoản"
      subtitle="Đăng ký để đặt mua sách và đọc e-book."
      error={generalError}
      success={success}
      loading={loading}
      submitText="Đăng ký"
      onSubmit={handleSubmit}
      footerText="Đã có tài khoản?"
      footerLinkText="Đăng nhập"
      footerLinkTo={ROUTES.LOGIN}
    >
      <Field label="Họ và tên" name="fullName" autoComplete="name" maxLength={RULES.FULL_NAME_MAX}
        value={values.fullName} error={errors.fullName} onChange={onChange} />
      <Field label="Email" name="email" type="email" autoComplete="email" placeholder="ten@example.com"
        value={values.email} error={errors.email} onChange={onChange} />
      <Field label="Mật khẩu" name="password" password autoComplete="new-password"
        hint={`Tối thiểu ${RULES.PASSWORD_MIN} ký tự, gồm chữ và số`}
        value={values.password} error={errors.password} onChange={onChange} />
      <Field label="Nhập lại mật khẩu" name="confirmPassword" password autoComplete="new-password"
        value={values.confirmPassword} error={errors.confirmPassword} onChange={onChange} />
    </AuthLayout>
  );
}
