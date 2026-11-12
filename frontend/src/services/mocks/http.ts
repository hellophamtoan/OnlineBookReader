// services/mocks/http.ts
// Tiện ích dùng chung cho "máy chủ giả".
export class MockHttpError extends Error {
  status: number;
  code?: string;
  errors?: { field: string; message: string }[];
  constructor(status: number, message: string, code?: string, errors?: { field: string; message: string }[]) {
    super(message);
    this.status = status;
    this.code = code;
    this.errors = errors;
  }
}

// Độ trễ giả để thấy được trạng thái "đang tải"
export const delay = (min = 250, max = 500) =>
  new Promise<void>((resolve) => setTimeout(resolve, min + Math.random() * (max - min)));

// Tester bật trong console: localStorage.setItem('mock_error_500','1') để thử nhánh lỗi máy chủ
export const flag = (key: string) => {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
};

// Đọc số nguyên từ body JSON (chấp nhận số hoặc chuỗi toàn chữ số); sai kiểu -> NaN
export const toInt = (v: unknown): number =>
  typeof v === 'number' ? v : typeof v === 'string' && /^-?\d+$/.test(v.trim()) ? Number(v) : NaN;
