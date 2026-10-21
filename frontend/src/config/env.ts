// config/env.ts
// Gom mọi biến môi trường về 1 chỗ. Các file khác KHÔNG đọc import.meta.env trực tiếp.

const toBool = (value: unknown, fallback: boolean) =>
  value === undefined || value === '' ? fallback : String(value).trim().toLowerCase() === 'true';

// Base URL đã gồm /api (khớp mục "Base URL" của hợp đồng API)
const API_URL = (import.meta.env.VITE_API_URL?.trim() || 'http://localhost:5000/api').replace(/\/+$/, '');

export const env = {
  API_URL,
  // Gốc của server để ghép với đường dẫn tương đối như /uploads/covers/a.jpg
  ASSET_ORIGIN: API_URL.replace(/\/api$/, ''),
  // Mặc định bật mock để FE chạy độc lập. Nối BE thật: VITE_USE_MOCK=false
  USE_MOCK: toBool(import.meta.env.VITE_USE_MOCK, true),
} as const;
