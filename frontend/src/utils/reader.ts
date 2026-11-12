// utils/reader.ts
// Hàm thuần của trình đọc (UC006): cuộn theo phần trăm, đổi cỡ chữ, đọc tham số chương.
import { READER } from '../config/reader';

const maxScroll = () => Math.max(0, document.documentElement.scrollHeight - window.innerHeight);

// Vị trí đọc hiện tại: 0-100, hai chữ số thập phân (khớp DECIMAL(5,2) của BE)
export const getScrollPercent = (): number => {
  const max = maxScroll();
  if (max <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((window.scrollY / max) * 10000) / 100));
};

export const scrollToPercent = (percent: number) => {
  window.scrollTo({ top: (Math.min(100, Math.max(0, percent)) / 100) * maxScroll(), behavior: 'auto' });
};

// dir = +1 / -1; luôn nằm trong khoảng giao diện cho phép
export const stepFontSize = (current: number, dir: 1 | -1) =>
  Math.min(READER.FONT_SIZE_MAX, Math.max(READER.FONT_SIZE_MIN, current + dir * READER.FONT_SIZE_STEP));

// ?chapter=3 -> 3; thiếu / sai -> undefined
export const parseChapterParam = (v: string | null): number | undefined => {
  const n = Number(v);
  return v !== null && Number.isInteger(n) && n >= 1 ? n : undefined;
};
