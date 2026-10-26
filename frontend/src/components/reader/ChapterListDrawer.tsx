import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { ChapterSummary } from '../../types';

interface ChapterListDrawerProps {
  open: boolean;
  chapters: ChapterSummary[];
  current: number;
  onSelect: (chapterNumber: number) => void;
  onClose: () => void;
}

// Mục lục dạng ngăn kéo. Chương bị khóa (từ chương 11, chưa có gói) vẫn hiện nhưng không chọn được.
export default function ChapterListDrawer({ open, chapters, current, onSelect, onClose }: ChapterListDrawerProps) {
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
            {chapters.map((c) => {
              const locked = !!c.locked;
              return (
                <li key={c.id}>
                  <button
                    ref={c.chapterNumber === current ? currentRef : undefined}
                    type="button"
                    className={`drawer__item${locked ? ' is-locked' : ''}`}
                    aria-current={c.chapterNumber === current ? 'true' : undefined}
                    disabled={locked}
                    onClick={() => !locked && onSelect(c.chapterNumber)}
                    title={locked ? 'Cần gói đọc để mở chương này' : undefined}
                  >
                    <span className="drawer__item-title">{c.title}</span>
                    {c.isFree && <span className="drawer__badge">Miễn phí</span>}
                    {locked && <span className="drawer__badge drawer__badge--lock">🔒 Gói</span>}
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
