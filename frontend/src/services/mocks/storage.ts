// services/mocks/storage.ts
// Lưu trạng thái của máy chủ giả vào localStorage (F5 không mất giỏ hàng, đơn hàng).
// Mọi khóa bắt đầu bằng "mock_" nên nút "Dữ liệu giả" (MockBadge) xóa được hết. localStorage lỗi -> dùng bộ nhớ tạm.
const memory = new Map<string, unknown>();

export const readJson = <T>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    if (raw !== null) return JSON.parse(raw) as T;
  } catch {
    /* dùng bản trong bộ nhớ */
  }
  return memory.has(key) ? (memory.get(key) as T) : fallback;
};

export const writeJson = (key: string, value: unknown) => {
  memory.set(key, value);
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* bỏ qua, đã có bản trong bộ nhớ */
  }
};
