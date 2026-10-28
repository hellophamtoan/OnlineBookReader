// importChapters.ts
// - Tạo đủ chương EPUB, không bỏ sót; sau đó quét lại API và bổ sung thiếu.
// - So sánh EPUB với chương đã có (trang quản lý chương): thêm mới / thay thế / giữ.
import { ADMIN } from '../config/admin';
import { chapterAdminService } from '../services/admin/chapteradminservice';
import type { EpubParsedChapter } from '../types';
import type { ChapterSummary } from '../types';
import { toMessage } from './errors';

export type ChapterImportFailure = {
  chapterNumber: number;
  title: string;
  message: string;
};

export type ChapterImportResult = {
  total: number;
  ok: number;
  failed: ChapterImportFailure[];
  /** Đã xử lý hết danh sách đầu vào (ok + failed) */
  complete: boolean;
  /** Số chương bổ sung sau bước quét lại */
  filledAfterVerify?: number;
  /** Số chương vẫn thiếu sau verify (so với EPUB) */
  stillMissing?: number;
};

const validateChapter = (c: EpubParsedChapter): string | null => {
  const title = (c.title || '').trim();
  if (!title) return 'Thiếu tiêu đề chương';
  if (title.length > ADMIN.TITLE_MAX) return `Tiêu đề vượt quá ${ADMIN.TITLE_MAX} ký tự`;
  const n = Number(c.chapterNumber);
  if (!Number.isInteger(n) || n < 1) return 'Số chương không hợp lệ';
  const content = c.content ?? '';
  if (!String(content).trim()) return 'Nội dung chương trống';
  if (content.length > ADMIN.CONTENT_MAX) {
    return `Nội dung quá dài (${content.length.toLocaleString('vi-VN')}/${ADMIN.CONTENT_MAX.toLocaleString('vi-VN')} ký tự) — có thể do ảnh nhúng`;
  }
  return null;
};

/**
 * Tạo lần lượt mọi chương. Lỗi từng chương được ghi nhận, không dừng sớm.
 */
export async function importEpubChapters(
  bookId: number,
  chapters: EpubParsedChapter[],
): Promise<ChapterImportResult> {
  const list = Array.isArray(chapters) ? chapters : [];
  const failed: ChapterImportFailure[] = [];
  let ok = 0;

  for (const c of list) {
    const num = Number(c.chapterNumber) || 0;
    const title = (c.title || `Chương ${num}`).trim();
    const pre = validateChapter(c);
    if (pre) {
      failed.push({ chapterNumber: num, title, message: pre });
      continue;
    }
    try {
      await chapterAdminService.create(bookId, {
        chapterNumber: num,
        title,
        content: c.content,
      });
      ok += 1;
    } catch (err) {
      failed.push({ chapterNumber: num, title, message: toMessage(err) });
    }
  }

  return {
    total: list.length,
    ok,
    failed,
    // complete chỉ khi không có lỗi — quét lại sẽ xác nhận trên server
    complete: failed.length === 0 && ok === list.length && list.length > 0,
  };
}

/**
 * Sau khi import: đọc lại danh sách chương trên server, tìm số chương EPUB còn thiếu, tạo bổ sung.
 */
export async function verifyAndFillMissingChapters(
  bookId: number,
  expected: EpubParsedChapter[],
  previous?: ChapterImportResult,
): Promise<ChapterImportResult> {
  const base: ChapterImportResult = previous ?? {
    total: expected.length,
    ok: 0,
    failed: [],
    complete: true,
  };

  let serverNumbers = new Set<number>();
  try {
    const listed = await chapterAdminService.list(bookId);
    serverNumbers = new Set(listed.items.map((i) => i.chapterNumber));
  } catch (err) {
    return {
      ...base,
      failed: [
        ...base.failed,
        {
          chapterNumber: 0,
          title: '(quét lại)',
          message: `Không đọc được danh sách chương sau khi lưu: ${toMessage(err)}`,
        },
      ],
      complete: false,
    };
  }

  const missing = expected.filter((c) => {
    const n = Number(c.chapterNumber);
    return Number.isInteger(n) && n >= 1 && !serverNumbers.has(n);
  });

  let filled = 0;
  const extraFailed: ChapterImportFailure[] = [];

  for (const c of missing) {
    const num = Number(c.chapterNumber);
    const title = (c.title || `Chương ${num}`).trim();
    const pre = validateChapter(c);
    if (pre) {
      extraFailed.push({ chapterNumber: num, title, message: `Bổ sung thất bại — ${pre}` });
      continue;
    }
    try {
      await chapterAdminService.create(bookId, {
        chapterNumber: num,
        title,
        content: c.content,
      });
      filled += 1;
      serverNumbers.add(num);
    } catch (err) {
      extraFailed.push({
        chapterNumber: num,
        title,
        message: `Bổ sung thất bại — ${toMessage(err)}`,
      });
    }
  }

  // Gỡ khỏi failed những số đã bổ sung thành công (trùng số với lần import trước)
  const filledNums = new Set(
    missing.filter((c) => serverNumbers.has(Number(c.chapterNumber))).map((c) => Number(c.chapterNumber)),
  );
  // Recompute: after fill, which expected still missing?
  let stillMissing = 0;
  try {
    const listed2 = await chapterAdminService.list(bookId);
    const have = new Set(listed2.items.map((i) => i.chapterNumber));
    stillMissing = expected.filter((c) => {
      const n = Number(c.chapterNumber);
      return Number.isInteger(n) && n >= 1 && !have.has(n);
    }).length;
  } catch {
    stillMissing = missing.length - filled;
  }

  const mergedFailed = [
    ...base.failed.filter((f) => !filledNums.has(f.chapterNumber)),
    ...extraFailed,
  ];

  const okTotal = base.ok + filled;
  const complete =
    stillMissing === 0 &&
    mergedFailed.length === 0 &&
    okTotal >= expected.length;

  return {
    total: expected.length,
    ok: okTotal,
    failed: mergedFailed,
    complete,
    filledAfterVerify: filled,
    stillMissing,
  };
}

/** Import + quét lại + bổ sung thiếu */
export async function importEpubChaptersFully(
  bookId: number,
  chapters: EpubParsedChapter[],
): Promise<ChapterImportResult> {
  const first = await importEpubChapters(bookId, chapters);
  return verifyAndFillMissingChapters(bookId, chapters, first);
}

export function formatChapterImportReport(
  bookTitle: string,
  r: ChapterImportResult,
  opts?: { bookCreated?: boolean },
): { notice: string; isError: boolean } {
  const bookBit = opts?.bookCreated !== false ? `sách «${bookTitle}»` : `«${bookTitle}»`;
  const fillBit =
    r.filledAfterVerify && r.filledAfterVerify > 0
      ? ` (đã bổ sung thêm ${r.filledAfterVerify} chương khi quét lại)`
      : '';

  if (r.total === 0) {
    return { notice: `Đã lưu ${bookBit} (không có chương EPUB để nạp)`, isError: false };
  }

  // Chỉ báo hoàn thành khi số OK khớp tổng kỳ vọng và server không còn thiếu
  if (r.failed.length === 0 && (r.stillMissing ?? 0) === 0 && r.ok >= r.total && r.total > 0) {
    return {
      notice: `Đã lưu ${bookBit} và đủ ${r.ok}/${r.total} chương${fillBit}`,
      isError: false,
    };
  }

  if (r.ok < r.total || (r.stillMissing ?? 0) > 0) {
    // rơi xuống nhánh lỗi bên dưới
  }

  const detail = r.failed
    .slice(0, 8)
    .map((f) => `Chương ${f.chapterNumber || '?'} «${f.title}»: ${f.message}`)
    .join(' · ');
  const more = r.failed.length > 8 ? ` · … và ${r.failed.length - 8} mục khác` : '';
  const miss =
    (r.stillMissing ?? 0) > 0 ? ` · vẫn thiếu ${r.stillMissing} chương trên server` : '';

  if (r.ok === 0) {
    return {
      notice: `Đã lưu ${bookBit} nhưng không nạp được chương nào. ${detail}${more}${miss}`,
      isError: true,
    };
  }

  return {
    notice: `Đã lưu ${bookBit}: OK ${r.ok}/${r.total}${fillBit}; còn vấn đề. ${detail}${more}${miss}`,
    isError: true,
  };
}

// ---------- Diff EPUB vs chương đã có (trang quản lý chương) ----------

export type EpubDiffKind = 'new' | 'same' | 'conflict' | 'serverOnly';

export type EpubDiffRow = {
  kind: EpubDiffKind;
  chapterNumber: number;
  epubTitle?: string;
  serverTitle?: string;
  serverId?: number;
  epub?: EpubParsedChapter;
  /** Hành động mặc định / do user chọn */
  action: 'add' | 'replace' | 'keep' | 'skip';
};

export function diffEpubAgainstExisting(
  epubChapters: EpubParsedChapter[],
  existing: ChapterSummary[],
): EpubDiffRow[] {
  const byNum = new Map(existing.map((e) => [e.chapterNumber, e]));
  const rows: EpubDiffRow[] = [];
  const seen = new Set<number>();

  for (const c of epubChapters) {
    const n = Number(c.chapterNumber);
    if (!Number.isInteger(n) || n < 1) continue;
    seen.add(n);
    const server = byNum.get(n);
    if (!server) {
      rows.push({
        kind: 'new',
        chapterNumber: n,
        epubTitle: c.title,
        epub: c,
        action: 'add',
      });
      continue;
    }
    const sameTitle =
      (server.title || '').trim().toLowerCase() === (c.title || '').trim().toLowerCase();
    rows.push({
      kind: sameTitle ? 'same' : 'conflict',
      chapterNumber: n,
      epubTitle: c.title,
      serverTitle: server.title,
      serverId: server.id,
      epub: c,
      action: sameTitle ? 'keep' : 'keep', // conflict: mặc định giữ server, user chọn replace
    });
  }

  for (const e of existing) {
    if (seen.has(e.chapterNumber)) continue;
    rows.push({
      kind: 'serverOnly',
      chapterNumber: e.chapterNumber,
      serverTitle: e.title,
      serverId: e.id,
      action: 'skip',
    });
  }

  rows.sort((a, b) => a.chapterNumber - b.chapterNumber);
  return rows;
}

export type ApplyDiffResult = {
  added: number;
  replaced: number;
  kept: number;
  skipped: number;
  failed: ChapterImportFailure[];
};

/** Áp dụng lựa chọn add/replace/keep trên từng dòng diff */
export async function applyEpubChapterDiff(
  bookId: number,
  rows: EpubDiffRow[],
): Promise<ApplyDiffResult> {
  let added = 0;
  let replaced = 0;
  let kept = 0;
  let skipped = 0;
  const failed: ChapterImportFailure[] = [];

  for (const row of rows) {
    if (row.action === 'skip' || row.kind === 'serverOnly') {
      skipped += 1;
      continue;
    }
    if (row.action === 'keep') {
      kept += 1;
      continue;
    }

    const epub = row.epub;
    if (!epub) {
      failed.push({
        chapterNumber: row.chapterNumber,
        title: row.epubTitle || '',
        message: 'Thiếu dữ liệu EPUB',
      });
      continue;
    }

    const pre = validateChapter(epub);
    if (pre) {
      failed.push({ chapterNumber: row.chapterNumber, title: epub.title, message: pre });
      continue;
    }

    try {
      if (row.action === 'add') {
        await chapterAdminService.create(bookId, {
          chapterNumber: epub.chapterNumber,
          title: epub.title.trim(),
          content: epub.content,
        });
        added += 1;
      } else if (row.action === 'replace' && row.serverId) {
        await chapterAdminService.update(row.serverId, {
          chapterNumber: epub.chapterNumber,
          title: epub.title.trim(),
          content: epub.content,
        });
        replaced += 1;
      } else if (row.action === 'replace' && !row.serverId) {
        failed.push({
          chapterNumber: row.chapterNumber,
          title: epub.title,
          message: 'Không có id chương trên server để cập nhật',
        });
      }
    } catch (err) {
      failed.push({
        chapterNumber: row.chapterNumber,
        title: epub.title,
        message: toMessage(err),
      });
    }
  }

  return { added, replaced, kept, skipped, failed };
}

export function formatApplyDiffReport(r: ApplyDiffResult): { notice: string; isError: boolean } {
  const parts = [
    r.added ? `thêm ${r.added}` : '',
    r.replaced ? `thay ${r.replaced}` : '',
    r.kept ? `giữ ${r.kept}` : '',
    r.skipped ? `bỏ qua ${r.skipped}` : '',
  ].filter(Boolean);

  if (r.failed.length === 0) {
    return {
      notice: parts.length ? `Đồng bộ EPUB xong: ${parts.join(', ')}` : 'Không có thay đổi nào được áp dụng',
      isError: false,
    };
  }

  const detail = r.failed
    .slice(0, 6)
    .map((f) => `Ch.${f.chapterNumber}: ${f.message}`)
    .join(' · ');
  return {
    notice: `Đồng bộ một phần (${parts.join(', ') || '0'}). Lỗi: ${detail}`,
    isError: true,
  };
}
