// config/profile.ts
// UC012 - Quy tắc + thông báo form hồ sơ (API-08/09 đã chốt theo FE).
export const PROFILE_RULES = {
  AVATAR_URL_MAX: 2_000_000,
  AVATAR_URL_REGEX: /^(https?:\/\/\S+|data:image\/(jpeg|jpg|png|gif|webp);base64,|\/uploads\/\S+)/i,
  AVATAR_MAX_BYTES: 2 * 1024 * 1024,
  AVATAR_ACCEPT: 'image/jpeg,image/png,image/gif,image/webp',
} as const;

export const PROFILE_MESSAGES = {
  avatarInvalid: 'Ảnh phải là URL http(s), /uploads/... hoặc file ảnh (JPEG, PNG, GIF, WebP)',
  avatarTooLong: 'Ảnh quá lớn hoặc đường dẫn quá dài',
  avatarType: 'Chỉ chấp nhận ảnh JPEG, PNG, GIF hoặc WebP',
  avatarSize: 'Dung lượng ảnh tối đa 2MB',
  saved: 'Cập nhật thông tin cá nhân thành công',
  emailTaken: 'Email đã được sử dụng bởi tài khoản khác',
  passwordMismatch: 'Mật khẩu xác nhận không khớp',
  passwordWeak: 'Mật khẩu mới tối thiểu 8 ký tự',
  currentPasswordRequired: 'Vui lòng nhập mật khẩu hiện tại để đổi mật khẩu',
  currentPasswordWrong: 'Mật khẩu hiện tại không đúng',
} as const;

export const ROLE_LABELS = { USER: 'Người dùng', ADMIN: 'Quản trị viên' } as const;
