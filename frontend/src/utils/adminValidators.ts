// utils/adminValidators.ts
// UC007 - validate form quản trị (danh mục, sách, chương) theo API-15..API-35. Server vẫn validate lại.
import { ADMIN, ADMIN_MESSAGES } from '../config/admin';

export const validateTaxonomyName = (v: string) => {
  const n = v.trim().length;
  if (n === 0) return ADMIN_MESSAGES.nameRequired;
  return n <= ADMIN.NAME_MAX ? '' : ADMIN_MESSAGES.nameTooLong;
};

// ---------- Sách ----------
export interface BookFormState {
  title: string;
  description: string;
  coverUrl: string;
  publisherId: string; // '' = không chọn
  hasPhysical: boolean;
  hasEbook: boolean;
  price: string;
  stock: string;
  authorIds: number[];
  categoryIds: number[];
  status: 'active' | 'inactive';
}

export type BookFormErrors = Partial<Record<'title' | 'coverUrl' | 'publisherId' | 'formats' | 'price' | 'stock' | 'authorIds' | 'categoryIds', string>>;

/** URL http(s), /uploads/..., hoặc data:image (EPUB / máy; cho phép charset= trong header) */
const isValidCoverUrl = (cover: string) => {
  if (/^https?:\/\/\S+/i.test(cover) || /^\/uploads\/\S+/i.test(cover)) return true;
  if (/^data:image\//i.test(cover)) return cover.length <= ADMIN.COVER_MAX;
  return false;
};

export const validateBookForm = (v: BookFormState): BookFormErrors => {
  const errors: BookFormErrors = {};
  const title = v.title.trim();
  if (!title) errors.title = ADMIN_MESSAGES.titleRequired;
  else if (title.length > ADMIN.TITLE_MAX) errors.title = ADMIN_MESSAGES.titleTooLong;

  const cover = v.coverUrl.trim();
  if (cover && !isValidCoverUrl(cover)) errors.coverUrl = ADMIN_MESSAGES.coverInvalid;

  if (!v.hasPhysical && !v.hasEbook) errors.formats = ADMIN_MESSAGES.formatRequired;

  if (v.hasPhysical) {
    const price = Number(v.price);
    if (v.price.trim() === '' || !Number.isFinite(price) || price < 0) errors.price = ADMIN_MESSAGES.priceInvalid;
    const stock = Number(v.stock);
    if (v.stock.trim() === '' || !Number.isInteger(stock) || stock < 0) errors.stock = ADMIN_MESSAGES.stockInvalid;
  }

  if (!v.publisherId.trim()) errors.publisherId = ADMIN_MESSAGES.publisherRequired;
  if (v.authorIds.length === 0) errors.authorIds = ADMIN_MESSAGES.authorRequired;
  if (v.categoryIds.length === 0) errors.categoryIds = ADMIN_MESSAGES.categoryRequired;
  return errors;
};

// ---------- Chương ----------
/** stt = thứ tự trong mục lục (bắt buộc); chapterNumber có thể trống (phần phụ) */
export type ChapterFormValues = Record<'stt' | 'chapterNumber' | 'title' | 'content', string>;

export const validateChapterForm = (v: ChapterFormValues): Record<keyof ChapterFormValues, string> => {
  const stt = Number(v.stt);
  const chRaw = v.chapterNumber.trim();
  const ch = Number(chRaw);
  const title = v.title.trim();
  return {
    stt:
      v.stt.trim() !== '' && Number.isInteger(stt) && stt >= 1
        ? ''
        : 'STT phải là số nguyên từ 1 trở lên',
    // Số chương: để trống = phần phụ (lời nói đầu…); nếu ghi thì phải là số nguyên ≥ 1
    chapterNumber:
      chRaw === ''
        ? ''
        : Number.isInteger(ch) && ch >= 1
          ? ''
          : ADMIN_MESSAGES.chapterNumberInvalid,
    title: !title ? ADMIN_MESSAGES.titleRequired : title.length > ADMIN.TITLE_MAX ? ADMIN_MESSAGES.titleTooLong : '',
    content: !v.content.trim() ? ADMIN_MESSAGES.contentRequired : v.content.length > ADMIN.CONTENT_MAX ? ADMIN_MESSAGES.contentTooLong : '',
  };
};
