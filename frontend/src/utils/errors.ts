// utils/errors.ts
import { ApiError } from '../services/api';
import { MESSAGES } from '../config/rules';

// Lấy câu thông báo hiển thị cho người dùng từ mọi loại lỗi
export const toMessage = (err: unknown, fallback: string = MESSAGES.generic) =>
  err instanceof ApiError && err.message ? err.message : fallback;
