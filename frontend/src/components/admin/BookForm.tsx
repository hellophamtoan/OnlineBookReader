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
  const [openChapter, setOpenChapter] = useState<number | null>(null);
  /** Tên từ EPUB chưa khớp danh mục */
  const [pendingAuthors, setPendingAuthors] = useState<string[]>([]);
  const [pendingCategories, setPendingCategories] = useState<string[]>([]);
  const [pendingPublishers, setPendingPublishers] = useState<string[]>([]);
  /** C2: chỉ tạo danh mục thiếu khi user bật */
  const [createMissingTaxonomy, setCreateMissingTaxonomy] = useState(false);

  const clear = (key: keyof BookFormErrors) => setErrors((e) => ({ ...e, [key]: undefined }));


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
    setImportedChapters(result.chapters);
    setOpenChapter(null);
    clear('title');
    clear('formats');
    if (result.coverUrl) clear('coverUrl');
    if (matchedAuthorIds.length) clear('authorIds');
    if (matchedCategoryIds.length) clear('categoryIds');
    if (publisherId) clear('publisherId');

    // Thông báo: ưu tiên thông tin lấy được; chương đã lọc theo rule BE (bỏ bìa/TOC, min 200 ký tự)
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
    parts.push(`${result.chapters.length} chương (lọc như BE, ≥200 ký tự)`);
    if (result.tocTitles.length) parts.push(`mục lục ${result.tocTitles.length} mục`);
    if (result.illustrationCount > 0) parts.push(`${result.illustrationCount} ảnh minh họa trong file`);
    if (result.skipped.length) parts.push(`đã bỏ ${result.skipped.length} phần (bìa/mục lục/ngắn…)`);

    setEpubNotice(`Đã nạp từ EPUB · ${parts.join(' · ')}`);
  };

  /** Parse EPUB trên trình duyệt — mock và backend thật đều không cần API parse */
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
        // Vẫn cho lưu nếu đã chọn đủ id từ danh mục; chỉ chặn khi thiếu chỗ bắt buộc
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
        !isEdit && importedChapters.length ? importedChapters : undefined,
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

  // Giữ lại mục (tác giả/NXB...) đã gắn với sách dù nó đã ngừng hoạt động; NXB ngừng hoạt động không cho chọn mới
  const publisherOptions = publishers.filter((p) => p.status === 'active' || String(p.id) === s.publisherId);

  return (
    <form className="admin-form" onSubmit={handleSubmit} noValidate>
      {generalError && <div className="alert alert--error" role="alert">{generalError}</div>}

      {!isEdit && (
        <fieldset className="form-section">
          <legend className="form-section__title">Nhập từ EPUB (tuỳ chọn)</legend>
          <p className="field__hint">
            Chọn file .epub từ máy hoặc dán URL. Hệ thống tận dụng tối đa metadata trong file: tên, giới thiệu,
            ảnh bìa, tác giả, NXB, thể loại (dc:subject), mục lục và nội dung chương. Phần không có trong EPUB sẽ bỏ qua.
            Lọc chương theo logic BE (bỏ bìa/mục lục/bản quyền, đoạn &lt; 200 ký tự; HTML làm sạch như import script).
            Tác giả / NXB / thể loại chỉ được chọn sẵn nếu tên đã có trong danh mục — còn thiếu thì thêm danh mục rồi chọn tay.
            Ảnh bìa: hiện trên form và Sách &amp; kho (mock lưu trực tiếp; BE thật lưu bìa trên trình duyệt nếu API không nhận data URL).
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
            Sau khi bấm «Thêm sách», hệ thống sẽ tạo lần lượt <strong>tất cả</strong> {importedChapters.length} chương
            (không bỏ sót im lặng). Nếu chương nào lỗi (quá dài, trùng số, API…), sẽ báo rõ số chương và lý do.
            Bấm dòng chương để xem nhanh nội dung trước khi lưu.
          </p>
          <ol className="book-toc-panel__list" style={{ maxHeight: 360 }}>
            {importedChapters.map((c) => (
              <li key={c.chapterNumber} className="book-toc-panel__item is-unread">
                <button
                  type="button"
                  className="book-toc-panel__link"
                  style={{ width: '100%', background: 'none', border: 0, padding: 0, cursor: 'pointer', font: 'inherit', color: 'inherit', textAlign: 'left' }}
                  onClick={() => setOpenChapter((n) => (n === c.chapterNumber ? null : c.chapterNumber))}
                >
                  <span className="book-toc-panel__text">
                    Chương {c.chapterNumber}. {c.title}
                    {c.textLength != null ? ` (${c.textLength} ký tự)` : ''}
                  </span>
                </button>
                {openChapter === c.chapterNumber && (
                  <div
                    className="prose"
                    style={{
                      marginTop: 10,
                      padding: 12,
                      maxHeight: 240,
                      overflow: 'auto',
                      background: 'var(--paper)',
                      borderRadius: 8,
                      border: '1px solid var(--line)',
                      whiteSpace: 'normal',
                    }}
                    dangerouslySetInnerHTML={{ __html: c.content }}
                  />
                )}
              </li>
            ))}
          </ol>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            style={{ marginTop: 12 }}
            disabled={loading || epubBusy}
            onClick={() => {
              setImportedChapters([]);
              setOpenChapter(null);
              setEpubNotice('');
            }}
          >
            Xóa danh sách chương đã nạp
          </button>
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
