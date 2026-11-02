// Nhập metadata + chương từ file EPUB / URL (chỉ form thêm sách).
import type { ChangeEvent, RefObject } from 'react';
import Field from '../common/Field';

interface BookFormEpubImportProps {
  epubFileRef: RefObject<HTMLInputElement>;
  epubUrl: string;
  epubBusy: boolean;
  epubError: string;
  epubNotice: string;
  disabled: boolean;
  onUrlChange: (value: string) => void;
  onFileChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onLoadUrl: () => void;
}

export default function BookFormEpubImport({
  epubFileRef,
  epubUrl,
  epubBusy,
  epubError,
  epubNotice,
  disabled,
  onUrlChange,
  onFileChange,
  onLoadUrl,
}: BookFormEpubImportProps) {
  return (
    <fieldset className="form-section">
      <legend className="form-section__title">Nhập từ EPUB (tuỳ chọn)</legend>
      <p className="field__hint">
        Chọn file .epub từ máy hoặc dán URL. Hệ thống tận dụng tối đa metadata trong file: tên, giới thiệu,
        ảnh bìa, tác giả, NXB, thể loại (dc:subject), mục lục và nội dung chương.
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        <input
          ref={epubFileRef}
          type="file"
          accept=".epub,application/epub+zip"
          hidden
          onChange={onFileChange}
        />
        <button
          type="button"
          className="btn btn--ghost"
          disabled={disabled || epubBusy}
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
          onChange={(e) => onUrlChange(e.target.value)}
        />
        <button type="button" className="btn btn--ghost" disabled={disabled || epubBusy} onClick={onLoadUrl}>
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
  );
}