// services/mocks/handlers/common.ts
// Tiện ích dùng chung cho các handler của UC006/UC007/UC012 (đọc tham số, ném lỗi 400/404 đúng khuôn hợp đồng).
import { MockHttpError } from '../http';

export interface FieldErr {
  field: string;
  message: string;
}

export const str = (v: unknown) => (typeof v === 'string' ? v : '');

// Số từ body JSON: chấp nhận số hoặc chuỗi số; không hợp lệ -> NaN
export const toNumber = (v: unknown): number =>
  typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;

// 400 kèm danh sách lỗi theo ô nhập; message = lỗi đầu tiên
export const failValidation = (errors: FieldErr[]) => new MockHttpError(400, errors[0].message, 'VALIDATION_ERROR', errors);

export const badRequest = (message: string) => new MockHttpError(400, message, 'VALIDATION_ERROR');
export const notFound = (message: string) => new MockHttpError(404, message, 'NOT_FOUND');
export const conflict = (message: string, field?: string) =>
  new MockHttpError(409, message, 'CONFLICT', field ? [{ field, message }] : undefined);

// Tham số đường dẫn phải là số nguyên dương, ngược lại 400
export const idParam = (v: string, label = 'id'): number => {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1) throw badRequest(`${label} không hợp lệ`);
  return n;
};
