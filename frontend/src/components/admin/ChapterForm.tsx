import { useMemo, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { ADMIN } from '../../config/admin';
import { useForm } from '../../hooks/useForm';
import { ApiError } from '../../services/api';
import type { AdminChapterPayload } from '../../types';
import { validateChapterForm } from '../../utils/adminValidators';
import type { ChapterFormValues } from '../../utils/adminValidators';
import { displayTitle, isSectionTitle, markAsSection, unmarkSection } from '../../utils/chapterMeta';
import { textToHtml } from '../../utils/chapterHtml';
import { toMessage } from '../../utils/errors';
import { sanitizeChapterHtml } from '../../utils/sanitize';
import { hasErrors } from '../../utils/validators';
import Field from '../common/Field';
import TextAreaField from '../common/TextAreaField';

interface ChapterFormProps {
  initial?: { chapterNumber: number; title: string; content: string };
  /** Gợi ý STT khi thêm mới (= max hiện có + 1) */
  defaultNumber?: number;
  submitLabel: string;
  onSubmit: (payload: AdminChapterPayload) => Promise<void>;
  onCancel: () => void;
}

const TAGS: [string, string, string][] = [
  ['Đoạn', '<p>', '</p>'],
  ['Tiêu đề', '<h2>', '</h2>'],
  ['Đậm', '<strong>', '</strong>'],
  ['Nghiêng', '<em>', '</em>'],
  ['Trích dẫn', '<blockquote>', '</blockquote>'],
  ['Danh sách', '<ul>\n<li>', '</li>\n</ul>'],
];

/**
 * STT gắn với số chương. Bỏ tích «Tính số chương» → không ghi số chương trên mục lục
 * (lời nói đầu, giới thiệu…). Đổi STT → số chương đổi theo khi đang tích.
 */
export default function ChapterForm({
  initial,
  defaultNumber = 1,
  submitLabel,
  onSubmit,
  onCancel,
}: ChapterFormProps) {
  const startNum = initial?.chapterNumber ?? defaultNumber;
  const startTitleRaw = initial?.title ?? '';
  const startCountAs = !(initial && isSectionTitle(startTitleRaw));
  const startTitle = displayTitle(startTitleRaw);

  const { values, setValues, errors, setErrors, setFieldError, onChange } = useForm<ChapterFormValues>({
    stt: String(startNum),
    chapterNumber: startCountAs ? String(startNum) : '',
    title: startTitle,
    content: initial?.content ?? '',
  });
  /** true = hiện / lưu số chương; false = phần phụ */
  const [countAsChapter, setCountAsChapter] = useState(startCountAs);
  const [tab, setTab] = useState<'write' | 'preview'>('write');
  const [generalError, setGeneralError] = useState('');
  const [loading, setLoading] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);

  const preview = useMemo(
    () => (tab === 'preview' ? sanitizeChapterHtml(values.content) : ''),
    [tab, values.content],
  );

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

  const onSttChange = (e: ChangeEvent<HTMLInputElement>) => {
    const nextStt = e.target.value;
    setValues((v) => {
      if (!countAsChapter) return { ...v, stt: nextStt, chapterNumber: '' };
      return { ...v, stt: nextStt, chapterNumber: nextStt };
    });
    setErrors((er) => ({ ...er, stt: '', chapterNumber: '' }));
  };

  const onToggleCountAs = (checked: boolean) => {
    setCountAsChapter(checked);
    setValues((v) => ({
      ...v,
      chapterNumber: checked ? v.stt : '',
    }));
    setErrors((er) => ({ ...er, chapterNumber: '' }));
  };

  const onTitleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const title = e.target.value;
    setValues((v) => ({ ...v, title }));
    // Gợi ý: tiêu đề phần phụ → bỏ tích
    if (isSectionTitle(title) && countAsChapter) {
      setCountAsChapter(false);
      setValues((v) => ({ ...v, title, chapterNumber: '' }));
    }
    setErrors((er) => ({ ...er, title: '' }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setGeneralError('');
    const toValidate: ChapterFormValues = {
      ...values,
      chapterNumber: countAsChapter ? values.stt : '',
    };
    const errs = validateChapterForm(toValidate);
    setErrors(errs);
    if (hasErrors(errs)) return;

    const stt = Number(values.stt);
    // STT = thứ tự mục lục. Bỏ tích → lưu marker phần phụ (mục lục chỉ hiện tiêu đề, không «Chương N»).
    const titleRaw = values.title.trim();
    const title = countAsChapter ? unmarkSection(titleRaw) : markAsSection(titleRaw);
    try {
      setLoading(true);
      await onSubmit({
        chapterNumber: stt,
        title,
        content: values.content,
      });
    } catch (err) {
      setLoading(false);
      if (err instanceof ApiError) {
        if (err.status === 409 && err.errors.some((x) => x.field === 'chapterNumber')) {
          return setFieldError('stt', err.message);
        }
        const fieldErrors = err.errors.filter((fe) => fe.field in values);
        if (fieldErrors.length) {
          return fieldErrors.forEach((fe) =>
            setFieldError(fe.field as keyof ChapterFormValues, fe.message),
          );
        }
      }
      setGeneralError(toMessage(err));
    }
  };

  return (
    <form className="admin-form" onSubmit={handleSubmit} noValidate>
      {generalError && (
        <div className="alert alert--error" role="alert">
          {generalError}
        </div>
      )}

      <p className="field__hint" style={{ marginBottom: 12 }}>
        <strong>STT</strong> quyết định thứ tự trên mục lục (trên → dưới). Tích «Tính số chương» để gắn số
        chương theo STT; <strong>bỏ tích</strong> khi viết lời nói đầu, giới thiệu, cảm nhận độc giả… (không
        hiện số chương trên mục lục).
      </p>

      <div className="admin-form__row admin-form__row--chapter">
        <Field
          label="STT"
          name="stt"
          inputMode="numeric"
          maxLength={5}
          value={values.stt}
          error={errors.stt}
          onChange={onSttChange}
        />
        <Field
          label="Số chương"
          name="chapterNumber"
          inputMode="numeric"
          maxLength={5}
          value={countAsChapter ? values.chapterNumber || values.stt : ''}
          error={errors.chapterNumber}
          onChange={onChange}
          disabled={!countAsChapter}
          placeholder={countAsChapter ? undefined : '—'}
        />
        <label
          className="check"
          style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, whiteSpace: 'nowrap' }}
        >
          <input
            type="checkbox"
            checked={countAsChapter}
            onChange={(e) => onToggleCountAs(e.target.checked)}
          />
          <span>Tính số chương</span>
        </label>
      </div>

      {!countAsChapter && (
        <p className="field__hint" role="status" style={{ marginTop: -4, marginBottom: 12 }}>
          Phần phụ: sắp xếp theo STT, mục lục không ghi «Chương N».
        </p>
      )}

      <div style={{ marginTop: 4 }}>
        <Field
          label="Tiêu đề"
          name="title"
          maxLength={ADMIN.TITLE_MAX}
          value={values.title}
          error={errors.title}
          onChange={onTitleChange}
          placeholder="Vd. Lời nói đầu / Chương 1. Tên chương"
        />
      </div>

      <div className="editor">
        <div className="editor__bar">
          <div className="editor__tabs" role="tablist" aria-label="Chế độ soạn thảo">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'write'}
              className="tabs__item"
              onClick={() => setTab('write')}
            >
              Soạn thảo
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'preview'}
              className="tabs__item"
              onClick={() => setTab('preview')}
            >
              Xem trước
            </button>
          </div>
          {tab === 'write' && (
            <div className="editor__tools">
              {TAGS.map(([label, open, close]) => (
                <button key={label} type="button" className="btn btn--ghost btn--sm" onClick={() => wrap(open, close)}>
                  {label}
                </button>
              ))}
              <button type="button" className="btn btn--ghost btn--sm" onClick={convertPlainText}>
                Văn bản → HTML
              </button>
            </div>
          )}
        </div>
        {tab === 'write' ? (
          <TextAreaField
            inputRef={area}
            label="Nội dung chương (HTML)"
            name="content"
            rows={16}
            value={values.content}
            error={errors.content}
            onChange={onChange}
          />
        ) : (
          <div className="editor__preview chapter-content" dangerouslySetInnerHTML={{ __html: preview }} />
        )}
      </div>

      <div className="admin-form__actions">
        <button type="submit" className="btn btn--primary" disabled={loading}>
          {loading ? 'Đang lưu...' : submitLabel}
        </button>
        <button type="button" className="btn btn--ghost" disabled={loading} onClick={onCancel}>
          Hủy
        </button>
      </div>
    </form>
  );
}
