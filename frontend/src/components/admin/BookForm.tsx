import { useRef, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { ADMIN, ADMIN_MESSAGES } from '../../config/admin';
import { ApiError } from '../../services/api';
import { bookAdminService } from '../../services/admin/bookadminservice';
import type {
  AdminBookDetail,
  AdminBookPayload,
  EntityStatus,
  EpubParsedChapter,
  TaxonomyItem,
} from '../../types';
import { validateBookForm } from '../../utils/adminValidators';
import type { BookFormErrors, BookFormState } from '../../utils/adminValidators';
import { toMessage } from '../../utils/errors';
import { markAsSection, unmarkSection } from '../../utils/chapterMeta';
import Field from '../common/Field';
import SelectField from '../common/SelectField';
import TextAreaField from '../common/TextAreaField';
import TaxonomyChipSelect from './TaxonomyChipSelect';
import { taxonomyService } from '../../services/admin/taxonomyservice';

interface BookFormProps {
  initial?: AdminBookDetail; // có = sửa, không = thêm mới
  authors: TaxonomyItem[];
  categories: TaxonomyItem[];
  publishers: TaxonomyItem[];
  /** chapters = danh sách chương từ EPUB (chỉ khi thêm mới) */
  onSubmit: (payload: AdminBookPayload, chapters?: EpubParsedChapter[]) => Promise<void>;
  onCancel: () => void;
}

type TextKey = 'title' | 'description' | 'coverUrl' | 'publisherId' | 'price' | 'stock' | 'status';

const initialState = (b?: AdminBookDetail): BookFormState => ({
  title: b?.title ?? '',
  description: b?.description ?? '',
  coverUrl: b?.coverUrl ?? '',
  publisherId: b?.publisherId ? String(b.publisherId) : '',
  hasPhysical: b?.hasPhysical ?? true,
  hasEbook: b?.hasEbook ?? false,
  price: b?.price !== null && b?.price !== undefined ? String(b.price) : '',
  stock: b ? String(b.stock) : '0',
  authorIds: b?.authors.map((a) => a.id) ?? [],
  categoryIds: b?.categories.map((c) => c.id) ?? [],
  status: b?.status ?? 'active',
});

const toPayload = (s: BookFormState, isEdit: boolean): AdminBookPayload => ({
  title: s.title.trim(),
  description: s.description.trim(),
  coverUrl: s.coverUrl.trim() || null,
  publisherId: s.publisherId ? Number(s.publisherId) : null,
  hasPhysical: s.hasPhysical,
  hasEbook: s.hasEbook,
  price: s.hasPhysical ? Number(s.price) : null, // chỉ e-book: không có giá bán giấy
  stock: s.hasPhysical ? Number(s.stock) : 0,
  authorIds: s.authorIds,
  categoryIds: s.categoryIds,
  ...(isEdit ? { status: s.status } : {}),
});

// Tên trường lỗi của BE -> ô trên form
const FIELD_MAP: Record<string, keyof BookFormErrors> = {
  title: 'title', coverUrl: 'coverUrl', publisherId: 'publisherId', price: 'price', stock: 'stock',
  authorIds: 'authorIds', categoryIds: 'categoryIds', hasPhysical: 'formats', hasEbook: 'formats',
};

// UC007 nhánh A1/B1: nhập thông tin sách (tên, tác giả, NXB, thể loại, giá, tồn kho, ảnh bìa, hình thức giấy/e-book).
// Thêm mới: có thể nhập EPUB (file máy hoặc URL) → điền form + xem trước chương.
export default function BookForm({ initial, authors, categories, publishers, onSubmit, onCancel }: BookFormProps) {
  const isEdit = !!initial;
  const [s, setS] = useState<BookFormState>(() => initialState(initial));
  const [errors, setErrors] = useState<BookFormErrors>({});
  const [generalError, setGeneralError] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const coverFileRef = useRef<HTMLInputElement>(null);
  const epubFileRef = useRef<HTMLInputElement>(null);
  const [epubUrl, setEpubUrl] = useState('');
  const [epubBusy, setEpubBusy] = useState(false);
  const [epubError, setEpubError] = useState('');
  const [epubNotice, setEpubNotice] = useState('');
  const [importedChapters, setImportedChapters] = useState<EpubParsedChapter[]>([]);
  /** Bản gốc ngay sau khi parse EPUB — dùng để ghi lại thay đổi */
  const [epubChapterSnapshot, setEpubChapterSnapshot] = useState<EpubParsedChapter[]>([]);
  const [openChapter, setOpenChapter] = useState<number | null>(null);
  /** Tên từ EPUB chưa khớp danh mục */
  const [pendingAuthors, setPendingAuthors] = useState<string[]>([]);
  const [pendingCategories, setPendingCategories] = useState<string[]>([]);
  const [pendingPublishers, setPendingPublishers] = useState<string[]>([]);
  /** C2: chỉ tạo danh mục thiếu khi user bật */
  const [createMissingTaxonomy, setCreateMissingTaxonomy] = useState(false);
  /** index dòng đang xem nội dung (click tiêu đề) */
  const [viewIdx, setViewIdx] = useState<number | null>(null);
  /** index dòng đang sửa tiêu đề + nội dung */
  const [editIdx, setEditIdx] = useState<number | null>(null);
  /** STT đang gõ (chỉ áp dụng khi Enter); key = index dòng */
  const [sttDraft, setSttDraft] = useState<Record<number, string>>({});

  const clear = (key: keyof BookFormErrors) => setErrors((e) => ({ ...e, [key]: undefined }));

  /** Đánh số chương 1..n chỉ phần countsAsChapter; phần phụ chapterNumber = 0 */
  const assignChapterNumbers = (list: EpubParsedChapter[]): EpubParsedChapter[] => {
    let n = 0;
    return list.map((c) => {
      if (c.countsAsChapter === false) return { ...c, chapterNumber: 0 };
      n += 1;
      return { ...c, chapterNumber: n, countsAsChapter: true };
    });
  };

  /** Đổi STT (1-based): chuyển phần fromIdx tới vị trí toStt */
  const moveToStt = (list: EpubParsedChapter[], fromIdx: number, toStt: number) => {
    const to = Math.max(0, Math.min(list.length - 1, Math.floor(toStt) - 1));
    if (fromIdx === to) return assignChapterNumbers(list);
    const next = [...list];
    const [row] = next.splice(fromIdx, 1);
    next.splice(to, 0, row);
    return assignChapterNumbers(next);
  };

  /** API cần chapterNumber unique > 0: phần phụ lấy số sau các chương thật */

  /** So sánh danh sách hiện tại với EPUB gốc (dạng xem sách ban đầu) */
  const buildChapterChangeLog = (
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
      if (j < 0) j = current.findIndex((c, ci) => !matchedCur.has(ci) && norm(c.title) === norm(o.title) && !!norm(c.title));
      if (j >= 0) {
        matchedCur.add(j);
        pairList.push({ oi, ci: j });
      }
    });
    const matchedOrig = new Set(pairList.map((p) => p.oi));

    const removed = original
      .map((o, oi) => ({ o, oi }))
      .filter(({ oi }) => !matchedOrig.has(oi));
    const added = current
      .map((c, ci) => ({ c, ci }))
      .filter(({ ci }) => !matchedCur.has(ci));

    lines.push('── Chi tiết thay đổi ──');

    if (removed.length) {
      lines.push(`• Đã xóa ${removed.length} phần (có trong EPUB, không còn trong danh sách):`);
      removed.forEach(({ o, oi }) => {
        lines.push(`    − STT gốc ${oi + 1} (c${o.chapterNumber || oi + 1}): «${o.title || '(không tiêu đề)'}»`);
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

  /** STT = thứ tự list (1..n). Phần không tích → đánh dấu section (mục lục chỉ hiện tiêu đề). */
  const prepareChaptersForSave = (list: EpubParsedChapter[]) =>
    list.map((c, i) => {
      const title =
        c.countsAsChapter === false ? markAsSection(c.title) : unmarkSection(c.title);
      return {
        ...c,
        chapterNumber: i + 1,
        title,
      };
    });

  const unmatchedNames = (names: string[], items: TaxonomyItem[]) =>
    names
      .map((n) => n.trim())
      .filter(Boolean)
      .filter((n) => !items.some((it) => it.name.trim().toLowerCase() === n.toLowerCase()));

  const matchTaxonomyIds = (names: string[], items: TaxonomyItem[]): number[] => {
    const ids: number[] = [];
    for (const name of names) {
      const n = name.trim().toLowerCase();
      if (!n) continue;
      const found = items.find((it) => it.name.trim().toLowerCase() === n);
      if (found && !ids.includes(found.id)) ids.push(found.id);
    }
    return ids;
  };

  const applyEpubResult = (result: {
    title: string;
    description: string;
    authors: string[];
    publishers: string[];
    subjects?: string[];
    coverUrl: string | null;
    illustrationCount: number;
    tocTitles: string[];
    chapters: EpubParsedChapter[];
    skipped: { title: string; reason: string | null }[];
  }) => {
    const matchedAuthorIds = matchTaxonomyIds(result.authors, authors);
    const matchedPublisherIds = matchTaxonomyIds(result.publishers, publishers);
    const matchedCategoryIds = matchTaxonomyIds(result.subjects ?? [], categories);
    const publisherId = matchedPublisherIds.length > 0 ? String(matchedPublisherIds[0]) : undefined;

    const pendA = unmatchedNames(result.authors, authors);
    const pendC = unmatchedNames(result.subjects ?? [], categories);
    const pendP = unmatchedNames(result.publishers, publishers);

    setPendingAuthors(pendA);
    setPendingCategories(pendC);
    setPendingPublishers(pendP);
    if (pendA.length || pendC.length || pendP.length) setCreateMissingTaxonomy(false);

    setS((v) => ({
      ...v,
      title: result.title || v.title,
      description: result.description || v.description,
      coverUrl: result.coverUrl || v.coverUrl,
      hasEbook: true,
      authorIds: matchedAuthorIds.length ? matchedAuthorIds : v.authorIds,
      categoryIds: matchedCategoryIds.length ? matchedCategoryIds : v.categoryIds,
      publisherId: publisherId ?? v.publisherId,
    }));
    const seeded = assignChapterNumbers(
      result.chapters.map((c) => ({ ...c, countsAsChapter: c.countsAsChapter !== false })),
    );
    setImportedChapters(seeded);
    setEpubChapterSnapshot(seeded.map((c) => ({ ...c })));
    setOpenChapter(null);
    setViewIdx(null);
    setEditIdx(null);
    clear('title');
    clear('formats');
    if (result.coverUrl) clear('coverUrl');
    if (matchedAuthorIds.length) clear('authorIds');
    if (matchedCategoryIds.length) clear('categoryIds');
    if (publisherId) clear('publisherId');

    const parts: string[] = [];
    if (result.title) parts.push(`tên: «${result.title}»`);
    if (result.description) parts.push('giới thiệu');
    if (result.coverUrl) parts.push('ảnh bìa');
    if (result.authors.length) {
      const unmatched = result.authors.filter(
        (a) => !authors.some((it) => it.name.trim().toLowerCase() === a.trim().toLowerCase()),
      );
      parts.push(
        unmatched.length === result.authors.length
          ? `tác giả (chưa có trong danh mục: ${result.authors.join(', ')})`
          : unmatched.length
            ? `tác giả (đã chọn khớp; chưa có: ${unmatched.join(', ')})`
            : `tác giả: ${result.authors.join(', ')}`,
      );
    }
    if (result.publishers.length) {
      const unmatched = result.publishers.filter(
        (p) => !publishers.some((it) => it.name.trim().toLowerCase() === p.trim().toLowerCase()),
      );
      parts.push(
        unmatched.length === result.publishers.length
          ? `NXB (chưa có trong danh mục: ${result.publishers.join(', ')})`
          : unmatched.length
            ? `NXB (đã chọn khớp; chưa có: ${unmatched.join(', ')})`
            : `NXB: ${result.publishers.join(', ')}`,
      );
    }
    if ((result.subjects ?? []).length) {
      const subjects = result.subjects ?? [];
      const unmatched = subjects.filter(
        (s) => !categories.some((it) => it.name.trim().toLowerCase() === s.trim().toLowerCase()),
      );
      parts.push(
        unmatched.length === subjects.length
          ? `thể loại gợi ý (chưa có trong danh mục: ${subjects.join(', ')})`
          : unmatched.length
            ? `thể loại (đã chọn khớp; chưa có: ${unmatched.join(', ')})`
            : `thể loại: ${subjects.join(', ')}`,
      );
    }
    const storyN = result.chapters.filter((c) => c.countsAsChapter !== false).length;
    const frontN = result.chapters.length - storyN;
    parts.push(
      `${result.chapters.length} phần từ mục lục (≥200 ký tự; ${storyN} tính chương` +
        (frontN ? `, ${frontN} phần phụ bỏ tích` : '') +
        ')',
    );
    if (result.tocTitles.length) parts.push(`mục lục ${result.tocTitles.length} mục`);
    if (result.illustrationCount > 0) parts.push(`${result.illustrationCount} ảnh minh họa trong file`);
    if (result.skipped.length) parts.push(`đã bỏ ${result.skipped.length} phần (bìa/mục lục/ngắn…)`);

    setEpubNotice(`Đã nạp từ EPUB · ${parts.join(' · ')}`);
  };

  const handleEpubFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setEpubError('');
    setEpubNotice('');
    try {
      setEpubBusy(true);
      const result = await bookAdminService.parseEpub({ file });
      applyEpubResult(result);
    } catch (err) {
      setEpubError(`Lỗi đọc EPUB: ${toMessage(err)}`);
      setImportedChapters([]);
    } finally {
      setEpubBusy(false);
    }
  };

  const handleEpubUrl = async () => {
    setEpubError('');
    setEpubNotice('');
    const url = epubUrl.trim();
    if (!url) {
      setEpubError('Nhập URL file EPUB công khai');
      return;
    }
    try {
      setEpubBusy(true);
      const result = await bookAdminService.parseEpub({ url });
      applyEpubResult(result);
    } catch (err) {
      setEpubError(`Lỗi tải/đọc EPUB: ${toMessage(err)}`);
      setImportedChapters([]);
    } finally {
      setEpubBusy(false);
    }
  };

  const readFileAsDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error('Không đọc được file ảnh'));
      reader.readAsDataURL(file);
    });

  const handleCoverFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!ADMIN.COVER_ACCEPT.split(',').includes(file.type)) {
      setErrors((er) => ({ ...er, coverUrl: ADMIN_MESSAGES.coverType }));
      return;
    }
    if (file.size > ADMIN.COVER_MAX_BYTES) {
      setErrors((er) => ({ ...er, coverUrl: ADMIN_MESSAGES.coverSize }));
      return;
    }
    try {
      setUploadingCover(true);
      const dataUrl = await readFileAsDataUrl(file);
      setS((v) => ({ ...v, coverUrl: dataUrl }));
      clear('coverUrl');
    } catch {
      setErrors((er) => ({ ...er, coverUrl: 'Không đọc được file ảnh' }));
    } finally {
      setUploadingCover(false);
    }
  };

  const setText = (key: TextKey) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const value = e.target.value;
    setS((v) => ({ ...v, [key]: value }));
    if (key in errors) clear(key as keyof BookFormErrors);
  };

  const setFormat = (key: 'hasPhysical' | 'hasEbook') => (e: ChangeEvent<HTMLInputElement>) => {
    setS((v) => ({ ...v, [key]: e.target.checked }));
    clear('formats');
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setGeneralError('');

    let authorIds = [...s.authorIds];
    let categoryIds = [...s.categoryIds];
    let publisherId = s.publisherId;
    const pendingAny =
      pendingAuthors.length > 0 || pendingCategories.length > 0 || pendingPublishers.length > 0;

    if (pendingAny && !createMissingTaxonomy) {
      const needAuthor = authorIds.length === 0 && pendingAuthors.length > 0;
      const needCat = categoryIds.length === 0 && pendingCategories.length > 0;
      const needPub = !publisherId.trim() && pendingPublishers.length > 0;
      if (needAuthor || needCat || needPub || pendingAny) {
        if (needAuthor || needCat || needPub) {
          setGeneralError(
            'Có tên từ EPUB chưa có trong danh mục. Chọn từ danh sách có sẵn hoặc bật «Tạo danh mục còn thiếu khi lưu».',
          );
          return;
        }
      }
    }

    const errs = validateBookForm({ ...s, authorIds, categoryIds, publisherId });
    if (createMissingTaxonomy) {
      if (authorIds.length === 0 && pendingAuthors.length > 0) delete errs.authorIds;
      if (categoryIds.length === 0 && pendingCategories.length > 0) delete errs.categoryIds;
      if (!publisherId.trim() && pendingPublishers.length > 0) delete errs.publisherId;
    }
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    try {
      setLoading(true);

      if (createMissingTaxonomy && pendingAny) {
        for (const name of pendingPublishers) {
          const item = await taxonomyService.create('publishers', { name });
          publisherId = String(item.id);
        }
        for (const name of pendingAuthors) {
          const item = await taxonomyService.create('authors', { name });
          if (!authorIds.includes(item.id)) authorIds.push(item.id);
        }
        for (const name of pendingCategories) {
          const item = await taxonomyService.create('categories', { name });
          if (!categoryIds.includes(item.id)) categoryIds.push(item.id);
        }
        setPendingAuthors([]);
        setPendingCategories([]);
        setPendingPublishers([]);
        setS((v) => ({ ...v, authorIds, categoryIds, publisherId }));
      }

      await onSubmit(
        toPayload({ ...s, authorIds, categoryIds, publisherId }, isEdit),
        !isEdit && importedChapters.length ? prepareChaptersForSave(importedChapters) : undefined,
      );
    } catch (err) {
      if (err instanceof ApiError && err.errors.length) {
        const next: BookFormErrors = {};
        err.errors.forEach((fe) => {
          const key = FIELD_MAP[fe.field];
          if (key) next[key] = fe.message;
        });
        if (Object.keys(next).length) {
          setErrors(next);
          return;
        }
      }
      setGeneralError(toMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const publisherOptions = publishers.filter((p) => p.status === 'active' || String(p.id) === s.publisherId);

  return (
    <form className="admin-form" onSubmit={handleSubmit} noValidate>
      {generalError && <div className="alert alert--error" role="alert">{generalError}</div>}

      {!isEdit && (
        <fieldset className="form-section">
          <legend className="form-section__title">Nhập từ EPUB (tuỳ chọn)</legend>
          <p className="field__hint">
            Chọn file .epub từ máy hoặc dán URL. Hệ thống tận dụng tối đa metadata trong file: tên, giới thiệu,
            ảnh bìa, tác giả, NXB, thể loại (dc:subject), mục lục và nội dung chương.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            <input ref={epubFileRef} type="file" accept=".epub,application/epub+zip" hidden onChange={handleEpubFile} />
            <button
              type="button"
              className="btn btn--ghost"
              disabled={loading || epubBusy}
              onClick={() => epubFileRef.current?.click()}
            >
              {epubBusy ? 'Đang đọc EPUB...' : 'Chọn file EPUB từ máy'}
            </button>
          </div>
          <div className="admin-form__row" style={{ alignItems: 'flex-end' }}>
            <Field
              label="Hoặc URL file EPUB"
              name="epubUrl"
              type="url"
              placeholder="https://.../sach.epub"
              value={epubUrl}
              onChange={(e) => setEpubUrl(e.target.value)}
            />
            <button type="button" className="btn btn--ghost" disabled={loading || epubBusy} onClick={handleEpubUrl}>
              Tải từ URL
            </button>
          </div>
          {epubError && (
            <div className="alert alert--error" role="alert" style={{ marginTop: 12 }}>
              {epubError}
            </div>
          )}
          {epubNotice && (
            <div className="alert alert--success" role="status" style={{ marginTop: 12 }}>
              {epubNotice}
            </div>
          )}
        </fieldset>
      )}

      <fieldset className="form-section">
        <legend className="form-section__title">Thông tin chung</legend>
        <Field label="Tên sách" name="title" maxLength={ADMIN.TITLE_MAX} value={s.title} error={errors.title} onChange={setText('title')} />
        <TextAreaField label="Giới thiệu (không bắt buộc)" name="description" rows={5} value={s.description} onChange={setText('description')} />
        <Field
          label="Ảnh bìa (URL hoặc chọn từ máy)"
          name="coverUrl"
          type="text"
          placeholder="https://... hoặc /uploads/covers/ten-anh.jpg"
          hint="Để trống thì hệ thống tự vẽ bìa. Có thể dán URL hoặc tải ảnh từ máy (≤ 2MB)."
          value={s.coverUrl.startsWith('data:') ? '(đã chọn ảnh từ máy)' : s.coverUrl}
          error={errors.coverUrl}
          onChange={(e) => {
            const v = e.target.value;
            if (v === '(đã chọn ảnh từ máy)') return;
            setS((prev) => ({ ...prev, coverUrl: v }));
            clear('coverUrl');
          }}
        />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          <input ref={coverFileRef} type="file" accept={ADMIN.COVER_ACCEPT} hidden onChange={handleCoverFile} />
          <button type="button" className="btn btn--ghost" disabled={loading || uploadingCover} onClick={() => coverFileRef.current?.click()}>
            {uploadingCover ? 'Đang đọc ảnh...' : 'Chọn ảnh bìa từ máy'}
          </button>
          {s.coverUrl ? (
            <button type="button" className="btn btn--ghost" disabled={loading} onClick={() => { setS((v) => ({ ...v, coverUrl: '' })); clear('coverUrl'); }}>
              Xóa ảnh bìa
            </button>
          ) : null}
        </div>
        {s.coverUrl ? (
          <div style={{ marginBottom: 12 }}>
            <img src={s.coverUrl} alt="Xem trước bìa" style={{ maxHeight: 160, maxWidth: '100%', objectFit: 'contain', borderRadius: 8 }} onError={(ev) => { (ev.target as HTMLImageElement).style.display = 'none'; }} />
          </div>
        ) : null}
      </fieldset>

      <fieldset className="form-section">
        <legend className="form-section__title">Hình thức và kho</legend>
        <div className="formats">
          <label className="check"><input type="checkbox" checked={s.hasPhysical} onChange={setFormat('hasPhysical')} /><span>Sách giấy</span></label>
          <label className="check"><input type="checkbox" checked={s.hasEbook} onChange={setFormat('hasEbook')} /><span>E-book (đọc trực tuyến)</span></label>
        </div>
        {errors.formats && <p className="field__error" role="alert">{errors.formats}</p>}
        {s.hasPhysical ? (
          <div className="admin-form__row">
            <Field label="Giá bán (₫)" name="price" inputMode="decimal" placeholder="79000" value={s.price} error={errors.price} onChange={setText('price')} />
            <Field label="Số lượng tồn kho" name="stock" inputMode="numeric" placeholder="0" value={s.stock} error={errors.stock} onChange={setText('stock')} />
          </div>
        ) : (
          <p className="field__hint">Sách chỉ có e-book: không có giá bán và tồn kho. Thêm các chương ở mục "Chương" sau khi lưu.</p>
        )}
      </fieldset>

      <fieldset className="form-section">
        <legend className="form-section__title">Phân loại</legend>
        <SelectField
          label="Nhà xuất bản"
          name="publisherId"
          value={s.publisherId}
          error={errors.publisherId}
          onChange={setText('publisherId')}
        >
          <option value="">— Chọn nhà xuất bản —</option>
          {publisherOptions.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </SelectField>
        {pendingPublishers.length > 0 && (
          <p className="field__hint" role="status">
            NXB từ EPUB chưa có trong danh mục:{' '}
            {pendingPublishers.map((n) => (
              <span key={n} className="tag" style={{ marginRight: 6 }}>
                {n} (chưa có)
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  style={{ padding: '0 4px', marginLeft: 4 }}
                  onClick={() => setPendingPublishers((list) => list.filter((x) => x !== n))}
                >
                  ×
                </button>
              </span>
            ))}
          </p>
        )}
        <TaxonomyChipSelect
          legend="Tác giả"
          options={authors}
          selectedIds={s.authorIds}
          error={errors.authorIds}
          pendingNames={pendingAuthors}
          onRemovePending={(name) => setPendingAuthors((list) => list.filter((x) => x !== name))}
          onChange={(ids) => {
            setS((v) => ({ ...v, authorIds: ids }));
            clear('authorIds');
          }}
        />
        <TaxonomyChipSelect
          legend="Thể loại"
          options={categories}
          selectedIds={s.categoryIds}
          error={errors.categoryIds}
          pendingNames={pendingCategories}
          onRemovePending={(name) => setPendingCategories((list) => list.filter((x) => x !== name))}
          onChange={(ids) => {
            setS((v) => ({ ...v, categoryIds: ids }));
            clear('categoryIds');
          }}
        />
        {(pendingAuthors.length > 0 || pendingCategories.length > 0 || pendingPublishers.length > 0) && (
          <label className="field" style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 8 }}>
            <input
              type="checkbox"
              checked={createMissingTaxonomy}
              onChange={(e) => setCreateMissingTaxonomy(e.target.checked)}
            />
            <span>
              Tạo danh mục còn thiếu khi lưu
              <span className="field__hint" style={{ display: 'block', marginTop: 4 }}>
                Bật để thêm vào hệ thống các tên EPUB đánh dấu «chưa có», rồi gắn vào sách.
              </span>
            </span>
          </label>
        )}
      </fieldset>

      {isEdit && (
        <fieldset className="form-section">
          <legend className="form-section__title">Trạng thái</legend>
          <SelectField label="Hiển thị trên trang bán sách" name="status" value={s.status} onChange={(e) => setS((v) => ({ ...v, status: e.target.value as EntityStatus }))}>
            <option value="active">Đang hoạt động</option>
            <option value="inactive">Ngừng hoạt động (ẩn khỏi trang bán, giữ lịch sử đơn hàng)</option>
          </SelectField>
        </fieldset>
      )}

      {!isEdit && importedChapters.length > 0 && (
        <fieldset className="form-section">
          <legend className="form-section__title">Chương từ EPUB ({importedChapters.length})</legend>
          <p className="field__hint">
            Lấy đủ các mục trong mục lục EPUB. Phần có chương (số thứ tự / Chương N) mặc định tích; lời nói
            đầu, giới thiệu, cảm nhận độc giả, sách của soạn giả… mặc định bỏ tích. Tích/bỏ tích để đổi;
            bỏ tích vẫn giữ nội dung nhưng không đánh số. Nhập STT + Enter để chuyển vị trí. Click tiêu đề
            để xem nội dung.
          </p>
          <ol className="book-toc-panel__list" style={{ maxHeight: 480, listStyle: 'none', paddingLeft: 0 }}>
            {importedChapters.map((c, idx) => {
              const isStory = c.countsAsChapter !== false;
              const viewing = viewIdx === idx;
              const editing = editIdx === idx;
              return (
                <li key={`row-${idx}`} className="book-toc-panel__item is-unread" style={{ marginBottom: 8 }}>
                  <div style={{ display: 'flex', flexWrap: 'nowrap', gap: 8, alignItems: 'center', overflow: 'hidden' }}>
                    <label className="field__hint" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
                      <input
                        type="checkbox"
                        checked={isStory}
                        disabled={loading || epubBusy}
                        onChange={(e) => {
                          const countsAsChapter = e.target.checked;
                          setImportedChapters((list) =>
                            assignChapterNumbers(
                              list.map((x, i) => (i === idx ? { ...x, countsAsChapter } : x)),
                            ),
                          );
                        }}
                      />
                    </label>
                    <label className="field__hint" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
                      STT
                      <input
                        className="input"
                        style={{ width: 52, textAlign: 'center' }}
                        type="number"
                        min={1}
                        max={importedChapters.length}
                        value={sttDraft[idx] !== undefined ? sttDraft[idx] : String(idx + 1)}
                        disabled={loading || epubBusy}
                        title="Gõ số vị trí mới rồi nhấn Enter để chuyển"
                        onChange={(e) => {
                          const v = e.target.value;
                          setSttDraft((d) => ({ ...d, [idx]: v }));
                        }}
                        onKeyDown={(e) => {
                          if (e.key !== 'Enter') return;
                          e.preventDefault();
                          const raw = sttDraft[idx] !== undefined ? sttDraft[idx] : String(idx + 1);
                          const toStt = Number(raw);
                          setSttDraft((d) => {
                            const next = { ...d };
                            delete next[idx];
                            return next;
                          });
                          if (!Number.isFinite(toStt) || toStt < 1) return;
                          if (Math.floor(toStt) === idx + 1) return;
                          setImportedChapters((list) => moveToStt(list, idx, toStt));
                          setViewIdx(null);
                          setEditIdx(null);
                        }}
                        onBlur={() => {
                          setSttDraft((d) => {
                            if (d[idx] === undefined) return d;
                            const next = { ...d };
                            delete next[idx];
                            return next;
                          });
                        }}
                      />
                    </label>
                    <span className="tag" style={{ minWidth: 56, textAlign: 'center' }} title="Số chương (tự động)">
                      {isStory ? `c${c.chapterNumber}` : '—'}
                    </span>
                    {editing ? (
                      <input
                        className="input"
                        style={{ flex: 1, minWidth: 140 }}
                        value={c.title}
                        autoFocus
                        onChange={(e) => {
                          const title = e.target.value;
                          setImportedChapters((list) => list.map((x, i) => (i === idx ? { ...x, title } : x)));
                        }}
                      />
                    ) : (
                      <button
                        type="button"
                        className="book-toc-panel__link"
                        style={{
                          flex: 1,
                          minWidth: 0,
                          background: 'none',
                          border: 0,
                          padding: '4px 0',
                          cursor: 'pointer',
                          font: 'inherit',
                          color: 'inherit',
                          textAlign: 'left',
                          textDecoration: viewing ? 'underline' : undefined,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                        title={c.title || 'Bấm để xem nội dung'}
                        onClick={() => {
                          setViewIdx((v) => (v === idx ? null : idx));
                          setEditIdx(null);
                        }}
                      >
                        <span className="book-toc-panel__text" style={{ whiteSpace: 'nowrap' }}>
                          {c.title || '(Không tiêu đề)'}
                        </span>
                        {c.textLength != null ? (
                          <span className="field__hint" style={{ marginLeft: 6, whiteSpace: 'nowrap' }}>
                            ({c.textLength} ký tự)
                          </span>
                        ) : null}
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      disabled={loading || epubBusy}
                      onClick={() => {
                        setEditIdx((e) => (e === idx ? null : idx));
                        setViewIdx(idx);
                      }}
                    >
                      {editing ? 'Xong' : 'Sửa'}
                    </button>
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      disabled={loading || epubBusy}
                      title="Chèn chương mới ngay sau dòng này"
                      onClick={() => {
                        setImportedChapters((list) => {
                          const next = [...list];
                          next.splice(idx + 1, 0, {
                            chapterNumber: 0,
                            title: 'Chương mới',
                            content: '<p></p>',
                            textLength: 0,
                            countsAsChapter: true,
                          });
                          return assignChapterNumbers(next);
                        });
                        setEditIdx(idx + 1);
                        setViewIdx(idx + 1);
                      }}
                    >
                      +
                    </button>
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      disabled={loading || epubBusy}
                      onClick={() => {
                        setImportedChapters((list) => assignChapterNumbers(list.filter((_, i) => i !== idx)));
                        setViewIdx(null);
                        setEditIdx(null);
                      }}
                    >
                      Xóa
                    </button>
                  </div>
                  {viewing && (
                    <div style={{ marginTop: 10 }}>
                      {editing ? (
                        <textarea
                          className="input"
                          rows={10}
                          style={{ width: '100%', fontFamily: 'ui-monospace, monospace', fontSize: 13 }}
                          value={c.content}
                          onChange={(e) => {
                            const content = e.target.value;
                            setImportedChapters((list) =>
                              list.map((x, i) =>
                                i === idx
                                  ? {
                                      ...x,
                                      content,
                                      textLength: content
                                        .replace(/<[^>]*>/g, ' ')
                                        .replace(/\s+/g, ' ')
                                        .trim().length,
                                    }
                                  : x,
                              ),
                            );
                          }}
                        />
                      ) : null}
                      <div
                        className="prose"
                        style={{
                          marginTop: editing ? 8 : 0,
                          padding: 12,
                          maxHeight: 320,
                          overflow: 'auto',
                          background: 'var(--paper)',
                          borderRadius: 8,
                          border: '1px solid var(--line)',
                          whiteSpace: 'normal',
                        }}
                        dangerouslySetInnerHTML={{ __html: c.content }}
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              disabled={loading || epubBusy || !epubChapterSnapshot.length}
              title="Khôi phục đúng danh sách chương như lúc nạp EPUB"
              onClick={() => {
                setImportedChapters(epubChapterSnapshot.map((c) => ({ ...c })));
                setOpenChapter(null);
                setViewIdx(null);
                setEditIdx(null);
                setSttDraft({});
              }}
            >
              EPUB ban đầu
            </button>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              disabled={loading || epubBusy}
              onClick={() => {
                setImportedChapters([]);
                setEpubChapterSnapshot([]);
                setOpenChapter(null);
                setViewIdx(null);
                setEditIdx(null);
                setSttDraft({});
                setEpubNotice('');
              }}
            >
              Xóa danh sách chương đã nạp
            </button>
          </div>

          {epubChapterSnapshot.length > 0 && (
            <div
              className="alert alert--success"
              role="status"
              style={{ marginTop: 16, whiteSpace: 'pre-line', maxHeight: 360, overflow: 'auto' }}
            >
              <strong>Ghi lại thay đổi so với EPUB (dạng xem sách ban đầu)</strong>
              {'\n'}
              {buildChapterChangeLog(epubChapterSnapshot, importedChapters).join('\n')}
            </div>
          )}
        </fieldset>
      )}

      <div className="admin-form__actions">
        <button type="submit" className="btn btn--primary btn--lg" disabled={loading || uploadingCover || epubBusy}>
          {loading ? 'Đang lưu...' : isEdit ? 'Lưu thay đổi' : importedChapters.length ? `Thêm sách + ${importedChapters.length} chương` : 'Thêm sách'}
        </button>
        <button type="button" className="btn btn--ghost btn--lg" onClick={onCancel} disabled={loading}>Hủy</button>
      </div>
    </form>
  );
}