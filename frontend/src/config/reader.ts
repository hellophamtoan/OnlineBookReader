// config/reader.ts
// UC006 - Hằng số của trình đọc: font, cỡ chữ, thời gian tự lưu, thông báo.
import type { ReadingSettings } from '../types';

export const READER = {
  FONT_DEFAULT: 'Arial', // khớp mặc định của API-12 khi chưa có tiến trình
  FONT_SIZE_DEFAULT: 16,
  // Khoảng cho phép trên giao diện (API cho phép 8-72, giao diện thu hẹp lại cho dễ đọc)
  FONT_SIZE_MIN: 12,
  FONT_SIZE_MAX: 40,
  FONT_SIZE_STEP: 2,
  AUTOSAVE_DELAY_MS: 1500, // dừng cuộn / đổi cài đặt bao lâu thì tự lưu
  EXIT_DELAY_MS: 900, // hiện "Đã lưu tiến trình" bao lâu trước khi rời trang
  /** Số chương đầu miễn phí (khớp BE / mock FREE_CHAPTER_LIMIT) — dùng hiển thị 🔒 chương cần gói */
  FREE_CHAPTER_LIMIT: 10,
} as const;

export const DEFAULT_SETTINGS: ReadingSettings = { fontFamily: READER.FONT_DEFAULT, fontSize: READER.FONT_SIZE_DEFAULT };

// value = giá trị lưu xuống BE (fontFamily); stack = chuỗi font-family thật dùng để hiển thị
export const FONT_FAMILIES: { value: string; label: string; stack: string }[] = [
  { value: 'Arial', label: 'Arial', stack: 'Arial, Helvetica, sans-serif' },
  { value: 'Georgia', label: 'Georgia', stack: "Georgia, 'Times New Roman', serif" },
  { value: 'Times New Roman', label: 'Times New Roman', stack: "'Times New Roman', Times, serif" },
  { value: 'Verdana', label: 'Verdana', stack: 'Verdana, Geneva, sans-serif' },
  { value: 'Tahoma', label: 'Tahoma', stack: 'Tahoma, Geneva, sans-serif' },
  { value: 'Be Vietnam Pro', label: 'Be Vietnam Pro', stack: "'Be Vietnam Pro', system-ui, sans-serif" },
  { value: 'Courier New', label: 'Courier New', stack: "'Courier New', Courier, monospace" },
];

export const fontStack = (name: string) =>
  FONT_FAMILIES.find((f) => f.value === name)?.stack ?? `"${name.replace(/["\\]/g, '')}", sans-serif`;

export const READER_MESSAGES = {
  subscriptionRequired: 'Bạn đã hết nội dung miễn phí hoặc cần gói đọc còn hiệu lực để tiếp tục.',
  noEbook: 'Không tìm thấy sách hoặc sách chưa có bản e-book.',
  noChapters: 'Cuốn sách này chưa có chương nào. Vui lòng quay lại sau.',
  chapterNotFound: 'Chương này không tồn tại.',
  saved: 'Đã lưu tiến trình đọc',
} as const;
