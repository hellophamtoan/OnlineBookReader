import { useRef, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { RULES } from '../../config/rules';
import { PROFILE_MESSAGES, PROFILE_RULES } from '../../config/profile';
import { useForm } from '../../hooks/useForm';
import { ApiError } from '../../services/api';
import { userService } from '../../services/userservice';
import type { UserProfile } from '../../types';
import { toMessage } from '../../utils/errors';
import { validateAvatarUrl, validateProfile } from '../../utils/profileValidators';
import type { ProfileFormValues } from '../../utils/profileValidators';
import { hasErrors } from '../../utils/validators';
import Avatar from '../common/Avatar';
import Field from '../common/Field';

interface ProfileFormProps {
  profile: UserProfile;
  onSaved: (next: UserProfile) => void;
  onCancel: () => void;
}

const readFileAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Không đọc được file ảnh'));
    reader.readAsDataURL(file);
  });

// UC012: form sửa họ tên, email, SĐT, ảnh đại diện (URL hoặc file máy), mật khẩu mới tùy chọn.
export default function ProfileForm({ profile, onSaved, onCancel }: ProfileFormProps) {
  const { values, errors, setErrors, setFieldError, onChange, setValues } = useForm<ProfileFormValues>({
    fullName: profile.fullName,
    email: profile.email,
    phone: profile.phone ?? '',
    avatarUrl: profile.avatarUrl ?? '',
    currentPassword: '',
    newPassword: '',
    confirmNewPassword: '',
  });
  const [generalError, setGeneralError] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!PROFILE_RULES.AVATAR_ACCEPT.split(',').includes(file.type)) {
      setFieldError('avatarUrl', PROFILE_MESSAGES.avatarType);
      return;
    }
    if (file.size > PROFILE_RULES.AVATAR_MAX_BYTES) {
      setFieldError('avatarUrl', PROFILE_MESSAGES.avatarSize);
      return;
    }
    try {
      setUploading(true);
      const dataUrl = await readFileAsDataUrl(file);
      setValues((v) => ({ ...v, avatarUrl: dataUrl }));
      setFieldError('avatarUrl', '');
    } catch {
      setFieldError('avatarUrl', 'Không đọc được file ảnh');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setGeneralError('');
    const errs = validateProfile(values);
    setErrors(errs);
    if (hasErrors(errs)) return;

    try {
      setLoading(true);
      onSaved(
        await userService.updateProfile({
          fullName: values.fullName,
          email: values.email,
          phone: values.phone,
          avatarUrl: values.avatarUrl,
          currentPassword: values.currentPassword || undefined,
          newPassword: values.newPassword || undefined,
          confirmNewPassword: values.confirmNewPassword || undefined,
        }),
      );
    } catch (err) {
      setLoading(false);
      if (err instanceof ApiError) {
        if (err.status === 409 || err.code === 'EMAIL_EXISTS') return setFieldError('email', err.message);
        const fieldErrors = err.errors.filter((fe) => fe.field in values);
        if (fieldErrors.length) {
          fieldErrors.forEach((fe) => setFieldError(fe.field as keyof ProfileFormValues, fe.message));
          return;
        }
      }
      setGeneralError(toMessage(err));
    }
  };

  const previewSrc =
    values.avatarUrl.trim() && !validateAvatarUrl(values.avatarUrl) ? values.avatarUrl.trim() : null;
  const avatarDisplay = values.avatarUrl.startsWith('data:') ? '(đã chọn ảnh từ máy)' : values.avatarUrl;

  return (
    <form className="profile-card profile-form" onSubmit={handleSubmit} noValidate aria-label="Sửa thông tin cá nhân">
      {generalError && (
        <div className="alert alert--error" role="alert">
          {generalError}
        </div>
      )}

      <div className="profile-form__avatar">
        <Avatar name={values.fullName || profile.fullName} src={previewSrc} size="lg" />
        <div className="profile-form__avatar-field">
          <Field
            label="Ảnh đại diện (URL hoặc chọn từ máy)"
            name="avatarUrl"
            type="text"
            autoComplete="off"
            placeholder="https://... hoặc chọn file bên dưới"
            hint="Để trống nếu không dùng ảnh. Có thể dán URL hoặc tải ảnh từ máy (tối đa 2MB)."
            value={avatarDisplay}
            error={errors.avatarUrl}
            onChange={(e) => {
              const v = e.target.value;
              if (v === '(đã chọn ảnh từ máy)') return;
              setValues((prev) => ({ ...prev, avatarUrl: v }));
              setFieldError('avatarUrl', '');
            }}
          />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
            <input
              ref={fileRef}
              type="file"
              accept={PROFILE_RULES.AVATAR_ACCEPT}
              hidden
              onChange={handleFile}
            />
            <button
              type="button"
              className="btn btn--ghost"
              disabled={loading || uploading}
              onClick={() => fileRef.current?.click()}
            >
              {uploading ? 'Đang đọc ảnh...' : 'Chọn ảnh từ máy'}
            </button>
            {values.avatarUrl ? (
              <button
                type="button"
                className="btn btn--ghost"
                disabled={loading}
                onClick={() => {
                  setValues((v) => ({ ...v, avatarUrl: '' }));
                  setFieldError('avatarUrl', '');
                }}
              >
                Xóa ảnh
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <Field
        label="Họ và tên"
        name="fullName"
        autoComplete="name"
        maxLength={RULES.FULL_NAME_MAX}
        value={values.fullName}
        error={errors.fullName}
        onChange={onChange}
      />
      <Field
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        maxLength={RULES.EMAIL_MAX}
        value={values.email}
        error={errors.email}
        onChange={onChange}
      />
      <Field
        label="Số điện thoại"
        name="phone"
        type="tel"
        inputMode="numeric"
        autoComplete="tel"
        maxLength={10}
        placeholder="09xxxxxxxx"
        hint="Để trống nếu không muốn lưu"
        value={values.phone}
        error={errors.phone}
        onChange={onChange}
      />

      <fieldset style={{ border: 'none', padding: 0, margin: '16px 0 0' }}>
        <legend style={{ fontWeight: 600, marginBottom: 8 }}>Đổi mật khẩu (để trống nếu không đổi)</legend>
        <Field
          label="Mật khẩu hiện tại"
          name="currentPassword"
          password
          autoComplete="current-password"
          value={values.currentPassword}
          error={errors.currentPassword}
          onChange={onChange}
          hint="Bắt buộc khi đổi mật khẩu"
        />
        <Field
          label="Mật khẩu mới"
          name="newPassword"
          password
          autoComplete="new-password"
          value={values.newPassword}
          error={errors.newPassword}
          onChange={onChange}
          hint={`Tối thiểu ${RULES.PASSWORD_MIN} ký tự`}
        />
        <Field
          label="Nhập lại mật khẩu mới"
          name="confirmNewPassword"
          password
          autoComplete="new-password"
          value={values.confirmNewPassword}
          error={errors.confirmNewPassword}
          onChange={onChange}
        />
      </fieldset>

      <div className="profile-card__actions">
        <button type="submit" className="btn btn--primary" disabled={loading || uploading}>
          {loading ? 'Đang lưu...' : 'Lưu thay đổi'}
        </button>
        <button type="button" className="btn btn--ghost" onClick={onCancel} disabled={loading}>
          Hủy
        </button>
      </div>
    </form>
  );
}
