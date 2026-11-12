import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { READER } from '../../config/reader';
import type { ChapterSummary } from '../../types';
import { withTocDisplayOrder } from '../../utils/chapterMeta';

interface ChapterListDrawerProps {
  open: boolean;
  chapters: ChapterSummary[];
  current: number;
  onSelect: (chapterNumber: number) => void;
  onClose: () => void;
  /** Giới hạn chương miễn phí (từ API-10); mặc định READER.FREE_CHAPTER_LIMIT */
  freeChapterLimit?: number;
}

/** Cần gói theo metadata chương — hiện 🔒 kể cả khi admin/user đã mở được */
function needsPackage(c: ChapterSummary, freeLimit: number) {
  if (c.isFree === false) return true;
  if (c.isFree === true) return false;
  return c.chapterNumber > freeLimit;
}

// Mục lục dạng ngăn kéo. Chương cần gói vẫn chọn được — ReaderView/API sẽ hiện thông báo đăng ký gói nếu chưa có quyền.
export default function ChapterListDrawer({
  open,
  chapters,
  current,
  onSelect,
  onClose,
  freeChapterLimit = READER.FREE_CHAPTER_LIMIT,
}: ChapterListDrawerProps) {
  const currentRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    currentRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div className="drawer-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="drawer" role="dialog" aria-modal="true" aria-label="Mục lục">
        <div className="drawer__head">
          <h2 className="drawer__title">Mục lục</h2>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Đóng
          </button>
        </div>
        {chapters.length === 0 ? (
          <p className="drawer__empty">Chưa có chương nào.</p>
        ) : (
          <ol className="drawer__list">
            {withTocDisplayOrder(chapters).map((c) => {
              const front = c.displayChapter == null;
              const pack = !front && needsPackage(c, freeChapterLimit);
              return (
                <li key={c.id}>
                  <button
                    ref={c.chapterNumber === current ? currentRef : undefined}
                    type="button"
                    className={`drawer__item${pack ? ' is-needs-pack' : ''}`}
                    aria-current={c.chapterNumber === current ? 'true' : undefined}
                    onClick={() => onSelect(c.chapterNumber)}
                    title={pack ? 'Chương thuộc phần cần gói đọc' : undefined}
                  >
                    <span className="drawer__item-title">{c.label}</span>
                    {c.isFree === true && <span className="drawer__badge">Miễn phí</span>}
                    {pack && <span className="drawer__badge drawer__badge--lock">🔒 Gói</span>}
                  </button>
                </li>
              );
            })}
          </ol>
        )}
      </aside>
    </div>,
    document.body,
  );
}
