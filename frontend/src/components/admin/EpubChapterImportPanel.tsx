// Import / đồng bộ chương từ EPUB trên trang quản lý chương.
// So sánh với chương đã có → thêm mới, giữ, hoặc thay thế khi trùng số.
import { useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { bookAdminService } from '../../services/admin/bookadminservice';
import type { ChapterSummary, EpubParsedChapter } from '../../types';
import {
  applyEpubChapterDiff,
  diffEpubAgainstExisting,
  formatApplyDiffReport,
  type EpubDiffRow,
} from '../../utils/importChapters';
import { toMessage } from '../../utils/errors';

interface Props {
  bookId: number;
  existing: ChapterSummary[];
  disabled?: boolean;
  onDone: () => void;
  onNotice: (message: string, tone?: 'success' | 'error') => void;
}

export default function EpubChapterImportPanel({
  bookId,
  existing,
  disabled,
  onDone,
  onNotice,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [rows, setRows] = useState<EpubDiffRow[] | null>(null);
  const [epubTitle, setEpubTitle] = useState('');

  const parseFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    setRows(null);
    try {
      setBusy(true);
      const result = await bookAdminService.parseEpub({ file });
      setEpubTitle(result.title || file.name);
      const chapters: EpubParsedChapter[] = result.chapters;
      if (!chapters.length) {
        setError('EPUB không còn chương nội dung sau khi lọc');
        return;
      }
      setRows(diffEpubAgainstExisting(chapters, existing));
    } catch (err) {
      setError(`Lỗi đọc EPUB: ${toMessage(err)}`);
    } finally {
      setBusy(false);
    }
  };

  const setAction = (chapterNumber: number, action: EpubDiffRow['action']) => {
    setRows((prev) =>
      prev
        ? prev.map((r) => (r.chapterNumber === chapterNumber ? { ...r, action } : r))
        : prev,
    );
  };

  const setAllConflicts = (action: 'keep' | 'replace') => {
    setRows((prev) =>
      prev
        ? prev.map((r) =>
            r.kind === 'conflict' || r.kind === 'same' ? { ...r, action } : r,
          )
        : prev,
    );
  };

  const setAllNew = (action: 'add' | 'skip') => {
    setRows((prev) =>
      prev ? prev.map((r) => (r.kind === 'new' ? { ...r, action } : r)) : prev,
    );
  };

  const apply = async () => {
    if (!rows?.length) return;
    setError('');
    try {
      setBusy(true);
      const result = await applyEpubChapterDiff(bookId, rows);
      const { notice, isError } = formatApplyDiffReport(result);
      onNotice(notice, isError ? 'error' : 'success');
      setRows(null);
      onDone();
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const counts = rows
    ? {
        new: rows.filter((r) => r.kind === 'new').length,
        same: rows.filter((r) => r.kind === 'same').length,
        conflict: rows.filter((r) => r.kind === 'conflict').length,
        serverOnly: rows.filter((r) => r.kind === 'serverOnly').length,
      }
    : null;

  return (
    <section className="form-section" style={{ marginBottom: 24 }}>
      <h2 className="form-section__title" style={{ fontSize: 18, marginBottom: 8 }}>
        Đồng bộ từ EPUB
      </h2>
      <p className="field__hint" style={{ marginBottom: 12 }}>
        Tải file .epub để quét chương, so với danh sách hiện có: thêm chương mới, giữ hoặc thay chương
        trùng số. Chương chỉ có trên server không bị xóa trừ khi bạn thao tác riêng.
      </p>

      <input
        ref={fileRef}
        type="file"
        accept=".epub,application/epub+zip"
        hidden
        onChange={parseFile}
      />
      <button
        type="button"
        className="btn btn--ghost"
        disabled={disabled || busy}
        onClick={() => fileRef.current?.click()}
      >
        {busy && !rows ? 'Đang đọc EPUB...' : 'Chọn file EPUB'}
      </button>

      {error && (
        <div className="alert alert--error" role="alert" style={{ marginTop: 12 }}>
          {error}
        </div>
      )}

      {rows && counts && (
        <div style={{ marginTop: 16 }}>
          <p className="field__hint" style={{ marginBottom: 8 }}>
            File: <strong>{epubTitle || 'EPUB'}</strong>
            {' · '}
            mới {counts.new}
            {' · '}
            trùng (cùng tiêu đề) {counts.same}
            {' · '}
            xung đột (khác tiêu đề) {counts.conflict}
            {' · '}
            chỉ trên server {counts.serverOnly}
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              disabled={busy}
              onClick={() => setAllNew('add')}
            >
              Thêm tất cả chương mới
            </button>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              disabled={busy}
              onClick={() => setAllConflicts('replace')}
            >
              Thay tất cả trùng số bằng EPUB
            </button>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              disabled={busy}
              onClick={() => setAllConflicts('keep')}
            >
              Giữ tất cả bản trên server
            </button>
          </div>

          <div className="table-wrap" style={{ maxHeight: 360, overflow: 'auto' }}>
            <table className="table table--chapters">
              <thead>
                <tr>
                  <th scope="col">Số</th>
                  <th scope="col">Trạng thái</th>
                  <th scope="col">EPUB</th>
                  <th scope="col">Server</th>
                  <th scope="col">Hành động</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={`${r.kind}-${r.chapterNumber}`}>
                    <td className="table__num">{r.chapterNumber}</td>
                    <td>
                      {r.kind === 'new' && 'Mới'}
                      {r.kind === 'same' && 'Trùng số · cùng tiêu đề'}
                      {r.kind === 'conflict' && 'Trùng số · khác tiêu đề'}
                      {r.kind === 'serverOnly' && 'Chỉ trên server'}
                    </td>
                    <td>{r.epubTitle ?? '—'}</td>
                    <td>{r.serverTitle ?? '—'}</td>
                    <td>
                      {r.kind === 'new' && (
                        <select
                          value={r.action}
                          disabled={busy}
                          onChange={(e) =>
                            setAction(r.chapterNumber, e.target.value as EpubDiffRow['action'])
                          }
                        >
                          <option value="add">Thêm</option>
                          <option value="skip">Bỏ qua</option>
                        </select>
                      )}
                      {(r.kind === 'same' || r.kind === 'conflict') && (
                        <select
                          value={r.action}
                          disabled={busy}
                          onChange={(e) =>
                            setAction(r.chapterNumber, e.target.value as EpubDiffRow['action'])
                          }
                        >
                          <option value="keep">Giữ server</option>
                          <option value="replace">Thay bằng EPUB</option>
                        </select>
                      )}
                      {r.kind === 'serverOnly' && <span className="field__hint">Giữ nguyên</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            <button type="button" className="btn btn--primary" disabled={busy} onClick={apply}>
              {busy ? 'Đang áp dụng...' : 'Áp dụng lựa chọn'}
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              disabled={busy}
              onClick={() => setRows(null)}
            >
              Hủy bảng so sánh
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
