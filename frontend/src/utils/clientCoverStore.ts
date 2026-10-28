// Lưu ảnh bìa data:image trên trình duyệt khi BE không nhận data URL (chỉ http(s) hoặc /uploads/).
// Dùng khi VITE_USE_MOCK=false và không sửa backend.

const KEY = 'obr_client_covers';

type CoverMap = Record<string, string>;

const read = (): CoverMap => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as CoverMap;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const write = (map: CoverMap) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    // Quota: bỏ ảnh lớn nhất rồi thử lại
    try {
      const entries = Object.entries(map).sort((a, b) => b[1].length - a[1].length);
      const slim: CoverMap = {};
      for (const [id, url] of entries.slice(1)) slim[id] = url;
      localStorage.setItem(KEY, JSON.stringify(slim));
    } catch {
      /* bỏ qua */
    }
  }
};

export const isDataImageUrl = (url: string | null | undefined): boolean =>
  !!url && /^data:image\//i.test(url.trim());

/** Lưu / cập nhật bìa local theo id sách */
export const saveClientCover = (bookId: number, dataUrl: string | null | undefined) => {
  if (!bookId || !isDataImageUrl(dataUrl)) return;
  const map = read();
  map[String(bookId)] = dataUrl!.trim();
  write(map);
};

export const removeClientCover = (bookId: number) => {
  const map = read();
  delete map[String(bookId)];
  write(map);
};

export const getClientCover = (bookId: number): string | null => {
  const v = read()[String(bookId)];
  return typeof v === 'string' && v.startsWith('data:') ? v : null;
};

/** Ưu tiên cover từ BE; nếu trống thì lấy bìa local (EPUB) */
export const mergeClientCover = (bookId: number, coverUrl: string | null | undefined): string | null => {
  if (coverUrl && String(coverUrl).trim()) return String(coverUrl).trim();
  return getClientCover(bookId);
};
