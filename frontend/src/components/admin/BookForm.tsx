import { useRef, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { ADMIN, ADMIN_MESSAGES } from '../../config/admin';
import { ApiError } from '../../services/api';
import type { AdminBookDetail, AdminBookPayload, EntityStatus, TaxonomyItem } from '../../types';
import { validateBookForm } from '../../utils/adminValidators';
import type { BookFormErrors, BookFormState } from '../../utils/adminValidators';
import { toMessage } from '../../utils/errors';
import Field from '../common/Field';
import SelectField from '../common/SelectField';
import TextAreaField from '../common/TextAreaField';
import CheckList from './CheckList';

interface BookFormProps {
  initial?: AdminBookDetail; // có = sửa, không = thêm mới
  authors: TaxonomyItem[];
  categories: TaxonomyItem[];
  publishers: TaxonomyItem[];
  onSubmit: (payload: AdminBookPayload) => Promise<void>; // ném ApiError nếu BE từ chối
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
export default function BookForm({ initial, authors, categories, publishers, onSubmit, onCancel }: BookFormProps) {
  const isEdit = !!initial;
  const [s, setS] = useState<BookFormState>(() => initialState(initial));
  const [errors, setErrors] = useState<BookFormErrors>({});
  const [generalError, setGeneralError] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const coverFileRef = useRef<HTMLInputElement>(null);

  const clear = (key: keyof BookFormErrors) => setErrors((e) => ({ ...e, [key]: undefined }));

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
    const errs = validateBookForm(s);
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    try {
      setLoading(true);
      await onSubmit(toPayload(s, isEdit));
    } catch (err) {
      setLoading(false);
      // Luồng A2a / B2a: báo lỗi, giữ nguyên form để sửa
      if (err instanceof ApiError && err.errors.length) {
        const next: BookFormErrors = {};
        err.errors.forEach((fe) => {
          const key = FIELD_MAP[fe.field];
          if (key) next[key] = fe.message;
        });
        if (Object.keys(next).length) return setErrors(next);
      }
      setGeneralError(toMessage(err));
    }
  };

  // Giữ lại mục (tác giả/NXB...) đã gắn với sách dù nó đã ngừng hoạt động; NXB ngừng hoạt động không cho chọn mới
  const publisherOptions = publishers.filter((p) => p.status === 'active' || String(p.id) === s.publisherId);

  return (
    <form className="admin-form" onSubmit={handleSubmit} noValidate>
      {generalError && <div className="alert alert--error" role="alert">{generalError}</div>}

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
        <SelectField label="Nhà xuất bản" name="publisherId" value={s.publisherId} error={errors.publisherId} onChange={setText('publisherId')}>
          <option value="">Chưa chọn</option>
          {publisherOptions.map((p) => <option key={p.id} value={p.id}>{p.name}{p.status === 'inactive' ? ' (ngừng hoạt động)' : ''}</option>)}
        </SelectField>
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
        <CheckList legend="Tác giả" options={authors} selected={s.authorIds} error={errors.authorIds}
          onChange={(ids) => { setS((v) => ({ ...v, authorIds: ids })); clear('authorIds'); }} />
        <CheckList legend="Thể loại" options={categories} selected={s.categoryIds} error={errors.categoryIds}
          onChange={(ids) => { setS((v) => ({ ...v, categoryIds: ids })); clear('categoryIds'); }} />
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

      <div className="admin-form__actions">
        <button type="submit" className="btn btn--primary btn--lg" disabled={loading || uploadingCover}>{loading ? 'Đang lưu...' : isEdit ? 'Lưu thay đổi' : 'Thêm sách'}</button>
        <button type="button" className="btn btn--ghost btn--lg" onClick={onCancel} disabled={loading}>Hủy</button>
      </div>
    </form>
  );
}
