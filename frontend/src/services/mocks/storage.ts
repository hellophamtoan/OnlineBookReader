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
    // QuotaExceeded: vẫn giữ bản memory trong phiên; thử ghi bản rút gọn không data URL khổng lồ
    try {
      const raw = JSON.stringify(value);
      if (raw.length > 4_000_000 && key === 'mock_catalog') {
        const slim = JSON.parse(raw) as { books?: { coverUrl?: string | null }[] };
        if (Array.isArray(slim.books)) {
          for (const b of slim.books) {
            if (typeof b.coverUrl === 'string' && b.coverUrl.startsWith('data:') && b.coverUrl.length > 200_000) {
              // Giữ preview ngắn sẽ vỡ ảnh — tốt hơn là giữ memory; không ghi localStorage
            }
          }
        }
      }
    } catch {
      /* ignore */
    }
  }
};
