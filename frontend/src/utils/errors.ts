// utils/errors.ts
import { ApiError } from '../services/api';
import { MESSAGES } from '../config/rules';

// Lấy câu thông báo hiển thị cho người dùng từ mọi loại lỗi (ApiError, Error thường, chuỗi)
export const toMessage = (err: unknown, fallback: string = MESSAGES.generic) => {
  if (err instanceof ApiError && err.message) return err.message;
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === 'string' && err.trim()) return err;
  return fallback;
};
