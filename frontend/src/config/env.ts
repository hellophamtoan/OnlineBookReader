// config/env.ts
// Gom mọi biến môi trường về 1 chỗ. Các file khác KHÔNG đọc import.meta.env trực tiếp.
//
// Nối backend thật:
//   1. Tạo file .env (cùng package.json của Vite):
//        VITE_API_URL=http://localhost:5000/api
//        VITE_USE_MOCK=false
//   2. Khởi động BE trước, rồi npm run dev
//   3. Kiểm tra CORS: BE phải cho origin của FE (vd http://localhost:5173)
//
// Hợp đồng: Base URL đã gồm /api. FE chỉ nối thêm path kiểu /auth/login.

const toBool = (value: unknown, fallback: boolean) =>
  value === undefined || value === '' ? fallback : String(value).trim().toLowerCase() === 'true';

const API_URL = (import.meta.env.VITE_API_URL?.trim() || 'http://localhost:5000/api').replace(/\/+$/, '');

export const env = {
  API_URL,
  // Gốc server để ghép /uploads/... (bỏ hậu tố /api)
  ASSET_ORIGIN: API_URL.replace(/\/api$/, ''),
  // true = mock (chạy độc lập); false = gọi BE thật tại API_URL
  USE_MOCK: toBool(import.meta.env.VITE_USE_MOCK, true),
} as const;
