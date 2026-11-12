// utils/taxonomyMatch.ts
// Khớp tên từ EPUB với danh mục admin (tác giả / NXB / thể loại).
import type { TaxonomyItem } from '../types';

// [Xử lý] Tên tác giả/thể loại trong EPUB chưa có trong hệ thống.
export const unmatchedNames = (names: string[], items: TaxonomyItem[]) =>
  names
    .map((n) => n.trim())
    .filter(Boolean)
    .filter((n) => !items.some((it) => it.name.trim().toLowerCase() === n.toLowerCase()));

// [Xử lý] Ghép tên trong EPUB với mã tác giả/thể loại sẵn có.
export const matchTaxonomyIds = (names: string[], items: TaxonomyItem[]): number[] => {
  const ids: number[] = [];
  for (const name of names) {
    const n = name.trim().toLowerCase();
    if (!n) continue;
    const found = items.find((it) => it.name.trim().toLowerCase() === n);
    if (found && !ids.includes(found.id)) ids.push(found.id);
  }
  return ids;
};
