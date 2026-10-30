import { useEffect, useState } from 'react';
import type { CSSProperties, MouseEvent } from 'react';
import type { Book } from '../../types';

// Chưa có ảnh bìa (hoặc ảnh lỗi) thì FE tự vẽ bìa từ tên sách, màu cố định theo id.
const PALETTES = [
  { bg: '#2F3182', fg: '#F6E7B4' },
  { bg: '#0E5A57', fg: '#FBE9B7' },
  { bg: '#7A1F2B', fg: '#F6E3D0' },
  { bg: '#E8B23A', fg: '#1F1B3A' },
  { bg: '#24452F', fg: '#E8E2C4' },
  { bg: '#5B5FA8', fg: '#FFFFFF' },
];

type CoverBook = Pick<Book, 'id' | 'title' | 'coverUrl' | 'authors'>;

interface BookCoverProps {
  book: CoverBook;
  className?: string;
  /** true = cho phép click mở lightbox (mặc định true khi có ảnh thật) */
  enableZoom?: boolean;
}

export default function BookCover({ book, className = '', enableZoom = false }: BookCoverProps) {
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [book.coverUrl]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  const hasImage = Boolean(book.coverUrl && !failed);

  const openLightbox = (e: MouseEvent) => {
    if (!enableZoom || !hasImage) return;
    e.preventDefault();
    e.stopPropagation();
    setOpen(true);
  };

  const coverInner = hasImage ? (
    <img
      src={book.coverUrl!}
      alt={`Bìa sách ${book.title}`}
      loading="lazy"
      onError={() => setFailed(true)}
      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
    />
  ) : (
    (() => {
      const p = PALETTES[book.id % PALETTES.length];
      return (
        <div
          className="cover cover--drawn"
          style={{ '--cover-bg': p.bg, '--cover-fg': p.fg, width: '100%', height: '100%' } as CSSProperties}
          role="img"
          aria-label={`Bìa sách ${book.title}`}
        >
          <span className="cover__title">{book.title}</span>
          <span className="cover__author">{book.authors[0]?.name}</span>
        </div>
      );
    })()
  );

  return (
    <>
      <div
        className={`cover ${className}${hasImage && enableZoom ? ' cover--zoomable' : ''}`}
        onClick={openLightbox}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && hasImage && enableZoom) {
            e.preventDefault();
            setOpen(true);
          }
        }}
        role={hasImage && enableZoom ? 'button' : undefined}
        tabIndex={hasImage && enableZoom ? 0 : undefined}
        title={hasImage && enableZoom ? 'Nhấn để xem ảnh lớn' : undefined}
        style={hasImage && enableZoom ? { cursor: 'zoom-in' } : undefined}
      >
        {coverInner}
      </div>

      {open && hasImage && (
        <div
          className="cover-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={`Ảnh bìa ${book.title}`}
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(0,0,0,0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
            cursor: 'zoom-out',
          }}
        >
          <button
            type="button"
            aria-label="Đóng"
            onClick={() => setOpen(false)}
            style={{
              position: 'absolute',
              top: 16,
              right: 16,
              background: 'rgba(255,255,255,0.15)',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              padding: '8px 14px',
              cursor: 'pointer',
              fontSize: 16,
            }}
          >
            Đóng
          </button>
          <img
            src={book.coverUrl!}
            alt={`Bìa sách ${book.title}`}
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: 'min(96vw, 900px)',
              maxHeight: '90vh',
              width: 'auto',
              height: 'auto',
              objectFit: 'contain',
              borderRadius: 4,
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            }}
          />
        </div>
      )}
    </>
  );
}
