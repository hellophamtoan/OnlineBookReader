import { useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { ADMIN } from '../../config/admin';
import { useForm } from '../../hooks/useForm';
import { ApiError } from '../../services/api';
import type { AdminChapterPayload } from '../../types';
import { validateChapterForm } from '../../utils/adminValidators';
import type { ChapterFormValues } from '../../utils/adminValidators';
import { textToHtml } from '../../utils/chapterHtml';
import { toMessage } from '../../utils/errors';
import { sanitizeChapterHtml } from '../../utils/sanitize';
import { hasErrors } from '../../utils/validators';
import Field from '../common/Field';
import TextAreaField from '../common/TextAreaField';

interface ChapterFormProps {
  initial?: { chapterNumber: number; title: string; content: string };
  defaultNumber?: number; // gợi ý số chương khi thêm mới
  submitLabel: string;
  onSubmit: (payload: AdminChapterPayload) => Promise<void>; // ném ApiError nếu BE từ chối
  onCancel: () => void;
}

// Nút chèn thẻ: [nhãn, thẻ mở, thẻ đóng]. Chỉ gồm các thẻ được phép (utils/sanitize.ts).
const TAGS: [string, string, string][] = [
  ['Đoạn', '<p>', '</p>'],
  ['Tiêu đề', '<h2>', '</h2>'],
  ['Đậm', '<strong>', '</strong>'],
  ['Nghiêng', '<em>', '</em>'],
  ['Trích dẫn', '<blockquote>', '</blockquote>'],
  ['Danh sách', '<ul>\n<li>', '</li>\n</ul>'],
];

// UC007 nhánh A/B cho chương e-book: số chương, tiêu đề, nội dung HTML (có xem trước đúng như người đọc sẽ thấy).
export default function ChapterForm({ initial, defaultNumber = 1, submitLabel, onSubmit, onCancel }: ChapterFormProps) {
  const { values, setValues, errors, setErrors, setFieldError, onChange } = useForm<ChapterFormValues>({
    chapterNumber: String(initial?.chapterNumber ?? defaultNumber),
    title: initial?.title ?? '',
    content: initial?.content ?? '',
  });
  const [tab, setTab] = useState<'write' | 'preview'>('write');
  const [generalError, setGeneralError] = useState('');
  const [loading, setLoading] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);

  const preview = useMemo(() => (tab === 'preview' ? sanitizeChapterHtml(values.content) : ''), [tab, values.content]);

  // Bọc đoạn đang chọn trong textarea bằng cặp thẻ
  const wrap = (open: string, close: string) => {
    const el = area.current;
    if (!el) return;
    const { selectionStart: start, selectionEnd: end } = el;
    const selected = values.content.slice(start, end) || 'văn bản';
    const next = values.content.slice(0, start) + open + selected + close + values.content.slice(end);
    setValues((v) => ({ ...v, content: next }));
    setErrors((er) => ({ ...er, content: '' }));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + open.length, start + open.length + selected.length);
    });
  };

  const convertPlainText = () => {
    setValues((v) => ({ ...v, content: textToHtml(v.content) }));
    setErrors((er) => ({ ...er, content: '' }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setGeneralError('');
    const errs = validateChapterForm(values);
    setErrors(errs);
    if (hasErrors(errs)) return;

    try {
      setLoading(true);
      await onSubmit({ chapterNumber: Number(values.chapterNumber), title: values.title.trim(), content: values.content });
    } catch (err) {
      setLoading(false);
      if (err instanceof ApiError) {
        if (err.status === 409 && err.errors.some((x) => x.field === 'chapterNumber')) return setFieldError('chapterNumber', err.message);
        const fieldErrors = err.errors.filter((fe) => fe.field in values);
        if (fieldErrors.length) return fieldErrors.forEach((fe) => setFieldError(fe.field as keyof ChapterFormValues, fe.message));
      }
      setGeneralError(toMessage(err));
    }
  };

  return (
    <form className="admin-form" onSubmit={handleSubmit} noValidate>
      {generalError && <div className="alert alert--error" role="alert">{generalError}</div>}

      <div className="admin-form__row admin-form__row--chapter">
        <Field label="Số chương" name="chapterNumber" inputMode="numeric" maxLength={5} value={values.chapterNumber} error={errors.chapterNumber} onChange={onChange} />
        <Field label="Tiêu đề chương" name="title" maxLength={ADMIN.TITLE_MAX} value={values.title} error={errors.title} onChange={onChange} />
      </div>

      <div className="editor">
        <div className="editor__bar">
          <div className="editor__tabs" role="tablist" aria-label="Chế độ soạn thảo">
            <button type="button" role="tab" aria-selected={tab === 'write'} className="tabs__item" onClick={() => setTab('write')}>Soạn thảo</button>
            <button type="button" role="tab" aria-selected={tab === 'preview'} className="tabs__item" onClick={() => setTab('preview')}>Xem trước</button>
          </div>
          {tab === 'write' && (
            <div className="editor__tags" role="group" aria-label="Chèn định dạng">
              {TAGS.map(([label, open, close]) => (
                <button key={label} type="button" className="btn btn--ghost editor__tag" onClick={() => wrap(open, close)}>{label}</button>
              ))}
              <button type="button" className="btn btn--ghost editor__tag" onClick={convertPlainText} title="Dùng khi dán văn bản thường: mỗi đoạn cách nhau một dòng trống">Văn bản thường → HTML</button>
            </div>
          )}
        </div>

        {tab === 'write' ? (
          <TextAreaField
            label="Nội dung (HTML)"
            name="content"
            inputRef={area}
            rows={18}
            className="textarea--code"
            hint="Chỉ giữ lại các thẻ: p, br, hr, h1-h4, strong, b, em, i, u, blockquote, ul, ol, li, span, div. Mã script và thuộc tính khác sẽ bị loại bỏ."
            value={values.content}
            error={errors.content}
            onChange={onChange}
          />
        ) : (
          <div className="editor__preview">
            {errors.content && <p className="field__error" role="alert">{errors.content}</p>}
            {values.content.trim() ? <div className="prose" dangerouslySetInnerHTML={{ __html: preview }} /> : <p className="field__hint">Chưa có nội dung để xem trước.</p>}
          </div>
        )}
      </div>

      <div className="admin-form__actions">
        <button type="submit" className="btn btn--primary btn--lg" disabled={loading}>{loading ? 'Đang lưu...' : submitLabel}</button>
        <button type="button" className="btn btn--ghost btn--lg" onClick={onCancel} disabled={loading}>Hủy</button>
      </div>
    </form>
  );
}
