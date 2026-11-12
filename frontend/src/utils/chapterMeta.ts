// Phần phụ (không tính chương) vs chương đánh số trên mục lục.
// DB không có cột countsAsChapter → lưu marker vô hình đầu tiêu đề khi bỏ tích.

/** Word joiner — không hiện trên UI, đánh dấu «không tính số chương» */
export const SECTION_MARK = '\u2060';

const FRONT_MATTER_TITLE =
  /^(nh?ời\s*nói\s*đầu|lời\s*nói\s*đầu|lời\s*tựa|lời\s*mở\s*đầu|lời\s*nhà\s*xuất\s*bản|lời\s*người\s*dịch|lời\s*kết|phần\s*kết|kết\s*luận|giới\s*thiệu|phần\s*mở\s*đầu|ghi\s*chú(\s+của\s+nhóm)?|cảm\s*nhận(\s+của\s+độc\s*giả)?|ý\s*kiến\s*bạn\s*đọc|sách\s*của\s*(soạn\s*giả|tác\s*giả)|tác\s*phẩm\s*cùng\s*tác\s*giả|về\s*tác\s*giả|tiểu\s*sử|phụ\s*lục|chú\s*thích|preface|foreword|introduction|intro|prologue|epilogue|afterword|acknowledg(?:e)?ments?|dedication|note to the reader|about the author|author'?s note|editor'?s note|publisher'?s note|to the reader|bibliography|index)\b/i;

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFC')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

/** Bỏ prefix số «1. –» / «Chương N.» để nhận diện phần phụ */
const stripLeadingChapterNoise = (s: string) =>
  s
    .replace(/^\d+\s*[.．。:：)）]?\s*[—–\-−]*\s*/u, '')
    .replace(/^chương\s*\d+\s*[.:：\-–—]?\s*/iu, '')
    .trim();

/** Tiêu đề hiển thị (bỏ marker vô hình) */
export function displayTitle(title: string): string {
  return (title || '').replace(new RegExp(`^${SECTION_MARK}+`), '').replace(/\s+/g, ' ').trim();
}

/** Đánh dấu phần phụ trước khi lưu DB */
export function markAsSection(title: string): string {
  const t = displayTitle(title);
  return t ? SECTION_MARK + t : SECTION_MARK;
}

/** Bỏ đánh dấu phần phụ (khi tích lại tính chương) */
export function unmarkSection(title: string): string {
  return displayTitle(title);
}

/**
 * true = không tính chương (bỏ tích / phần phụ).
 * Marker đã lưu + tiêu đề kiểu lời mở đầu / giới thiệu (kể cả «1. Lời mở đầu»).
 */
export function isSectionTitle(title: string): boolean {
  const raw = title || '';
  if (raw.startsWith(SECTION_MARK)) return true;
  const t = displayTitle(raw);
  if (!t) return false;
  const candidates = [t, stripLeadingChapterNoise(t), normalize(t), normalize(stripLeadingChapterNoise(t))];
  return candidates.some((x) => x && FRONT_MATTER_TITLE.test(x));
}

/** @deprecated dùng isSectionTitle */
export function isFrontMatterTitle(title: string): boolean {
  return isSectionTitle(title);
}

/**
 * Chỉ mục tính chương (c1, c2…) mới gắn «Chương N.»
 * Phần không có số chương / không tích: chỉ tiêu đề.
 * N = thứ tự trong các mục tính chương (c1 → Chương 1).
 */
export function formatTocLabel(displayChapter: number | null, title: string): string {
  const t = displayTitle(title) || '(Không tiêu đề)';
  if (displayChapter == null || displayChapter < 1 || isSectionTitle(title)) return t;
  const stripped = stripLeadingChapterNoise(t);
  return `Chương ${displayChapter}. ${stripped || t}`;
}

/**
 * Sắp theo STT (chapterNumber ASC).
 * displayChapter: null nếu phần phụ; 1..n theo các mục tính chương (khớp c1, c2…).
 */
export function withTocDisplayOrder<T extends { chapterNumber: number; title: string }>(
  items: T[],
): Array<T & { displayChapter: number | null; label: string; titleDisplay: string }> {
  const sorted = [...items].sort((a, b) => a.chapterNumber - b.chapterNumber);
  let storyN = 0;
  return sorted.map((c) => {
    const section = isSectionTitle(c.title);
    const displayChapter = section ? null : ++storyN;
    const titleDisplay = displayTitle(c.title);
    return {
      ...c,
      displayChapter,
      titleDisplay,
      label: formatTocLabel(displayChapter, c.title),
    };
  });
}
