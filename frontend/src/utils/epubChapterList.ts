// utils/epubChapterList.ts
// Logic thuần cho danh sách chương nạp từ EPUB (BookForm). Không phụ thuộc React.
import type { EpubParsedChapter } from '../types';
import { markAsSection, unmarkSection } from './chapterMeta';

/** Đánh số chương 1..n chỉ phần countsAsChapter; phần phụ chapterNumber = 0 */
export const assignChapterNumbers = (list: EpubParsedChapter[]): EpubParsedChapter[] => {
  let n = 0;
  return list.map((c) => {
    if (c.countsAsChapter === false) return { ...c, chapterNumber: 0 };
    n += 1;
    return { ...c, chapterNumber: n, countsAsChapter: true };
  });
};

/** Đổi STT (1-based): chuyển phần fromIdx tới vị trí toStt */
export const moveToStt = (list: EpubParsedChapter[], fromIdx: number, toStt: number) => {
  const to = Math.max(0, Math.min(list.length - 1, Math.floor(toStt) - 1));
  if (fromIdx === to) return assignChapterNumbers(list);
  const next = [...list];
  const [row] = next.splice(fromIdx, 1);
  next.splice(to, 0, row);
  return assignChapterNumbers(next);
};

/** STT = thứ tự list (1..n). Phần không tích → đánh dấu section (mục lục chỉ hiện tiêu đề). */
export const prepareChaptersForSave = (list: EpubParsedChapter[]): EpubParsedChapter[] =>
  list.map((c, i) => {
    const title = c.countsAsChapter === false ? markAsSection(c.title) : unmarkSection(c.title);
    return { ...c, chapterNumber: i + 1, title };
  });

/** So sánh danh sách hiện tại với EPUB gốc (dạng xem sách ban đầu) */
export const buildChapterChangeLog = (
  original: EpubParsedChapter[],
  current: EpubParsedChapter[],
): string[] => {
  const lines: string[] = [];
  if (!original.length && !current.length) return ['Chưa có dữ liệu chương.'];

  const norm = (s: string) => s.trim().toLowerCase();
  const textLen = (c: EpubParsedChapter) =>
    c.textLength ??
    c.content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().length;
  const label = (c: EpubParsedChapter, i: number) => {
    const title = (c.title || '(không tiêu đề)').trim();
    const ch = c.countsAsChapter === false ? '—' : c.chapterNumber > 0 ? `c${c.chapterNumber}` : '?';
    return `STT ${i + 1} [${ch}] «${title}»`;
  };
  const fp = (c: EpubParsedChapter) => `${norm(c.title)}||${c.content.length}:${c.content.slice(0, 120)}`;

  const storyCount = current.filter((c) => c.countsAsChapter !== false).length;
  const nonCount = current.filter((c) => c.countsAsChapter === false).length;

  lines.push('── Tóm tắt ──');
  lines.push(
    `• Gốc EPUB (khi nạp): ${original.length} phần · tính chương c1…c${original.length || 0}.`,
  );
  lines.push(
    `• Hiện tại: ${current.length} phần · ${storyCount} tính chương (c1…c${storyCount || 0}) · ${nonCount} không tính chương (—).`,
  );

  const pairList: { oi: number; ci: number }[] = [];
  const matchedCur = new Set<number>();
  original.forEach((o, oi) => {
    let j = current.findIndex((c, ci) => !matchedCur.has(ci) && fp(c) === fp(o));
    if (j < 0) {
      j = current.findIndex(
        (c, ci) => !matchedCur.has(ci) && norm(c.title) === norm(o.title) && !!norm(c.title),
      );
    }
    if (j >= 0) {
      matchedCur.add(j);
      pairList.push({ oi, ci: j });
    }
  });
  const matchedOrig = new Set(pairList.map((p) => p.oi));

  const removed = original.map((o, oi) => ({ o, oi })).filter(({ oi }) => !matchedOrig.has(oi));
  const added = current.map((c, ci) => ({ c, ci })).filter(({ ci }) => !matchedCur.has(ci));

  lines.push('── Chi tiết thay đổi ──');

  if (removed.length) {
    lines.push(`• Đã xóa ${removed.length} phần (có trong EPUB, không còn trong danh sách):`);
    removed.forEach(({ o, oi }) => {
      lines.push(
        `    − STT gốc ${oi + 1} (c${o.chapterNumber || oi + 1}): «${o.title || '(không tiêu đề)'}»`,
      );
    });
  } else {
    lines.push('• Không xóa phần nào so với EPUB.');
  }

  if (added.length) {
    lines.push(`• Đã thêm ${added.length} phần (không có trong EPUB gốc):`);
    added.forEach(({ c, ci }) => {
      const ch = c.countsAsChapter === false ? '—' : `c${c.chapterNumber}`;
      lines.push(`    + STT ${ci + 1} [${ch}]: «${c.title || '(không tiêu đề)'}»`);
    });
  } else {
    lines.push('• Không thêm phần mới.');
  }

  const titleChanges: string[] = [];
  const contentChanges: string[] = [];
  const flagChanges: string[] = [];
  const orderChanges: string[] = [];

  pairList.forEach(({ oi, ci }) => {
    const o = original[oi];
    const c = current[ci];
    if (o.title.trim() !== c.title.trim()) {
      titleChanges.push(`«${o.title}» → «${c.title}» (STT gốc ${oi + 1} → STT ${ci + 1})`);
    }
    if (o.content !== c.content) {
      contentChanges.push(
        `«${c.title || o.title}»: nội dung đổi (${textLen(o)} → ${textLen(c)} ký tự), STT hiện ${ci + 1}`,
      );
    }
    const oStory = o.countsAsChapter !== false;
    const cStory = c.countsAsChapter !== false;
    if (oStory !== cStory) {
      flagChanges.push(
        cStory
          ? `«${c.title}»: bật tính chương → c${c.chapterNumber}`
          : `«${c.title}»: tắt tính chương (trước c${o.chapterNumber || oi + 1} → —)`,
      );
    }
    if (oi !== ci) {
      orderChanges.push(
        `«${c.title || o.title}»: STT gốc ${oi + 1} → STT ${ci + 1}` +
          (cStory ? ` (hiện c${c.chapterNumber})` : ' (không tính chương)'),
      );
    }
  });

  if (titleChanges.length) {
    lines.push(`• Đã đổi tiêu đề (${titleChanges.length}):`);
    titleChanges.forEach((x) => lines.push(`    · ${x}`));
  } else {
    lines.push('• Không đổi tiêu đề phần nào (so khớp với EPUB).');
  }
  if (contentChanges.length) {
    lines.push(`• Đã sửa nội dung trong phần (${contentChanges.length}):`);
    contentChanges.forEach((x) => lines.push(`    · ${x}`));
  } else {
    lines.push('• Không sửa nội dung phần nào (so khớp với EPUB).');
  }
  if (flagChanges.length) {
    lines.push(`• Đổi trạng thái «Tính chương» (${flagChanges.length}):`);
    flagChanges.forEach((x) => lines.push(`    · ${x}`));
  }
  if (orderChanges.length) {
    lines.push(`• Đổi thứ tự / STT (${orderChanges.length}):`);
    orderChanges.forEach((x) => lines.push(`    · ${x}`));
  }

  lines.push('── Mục lục hiện tại (sau chỉnh) ──');
  current.forEach((c, i) => lines.push(`    ${label(c, i)}`));
  lines.push('── Mục lục EPUB gốc (khi nạp) ──');
  original.forEach((c, i) => {
    const title = (c.title || '(không tiêu đề)').trim();
    lines.push(`    STT ${i + 1} [c${c.chapterNumber || i + 1}] «${title}»`);
  });

  const noDetail =
    !removed.length &&
    !added.length &&
    !titleChanges.length &&
    !contentChanges.length &&
    !flagChanges.length &&
    !orderChanges.length;
  if (noDetail) {
    return [
      'Chưa có thay đổi so với nội dung EPUB ban đầu (dạng xem sách khi nạp).',
      `Gốc và hiện tại đều ${current.length} phần, cùng thứ tự và nội dung.`,
    ];
  }
  return lines;
};
