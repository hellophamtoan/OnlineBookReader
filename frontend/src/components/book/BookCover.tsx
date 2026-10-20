import { useState } from 'react';
import type { CSSProperties } from 'react';
import type { Book } from '../../types';

// Chưa có ảnh bìa (hoặc ảnh lỗi) thì FE tự vẽ bìa từ tên sách, màu cố định theo id.
// Nhờ vậy dữ liệu giả không cần ảnh mà trang vẫn nhìn như một kệ sách.
const PALETTES = [
  { bg: '#2F3182', fg: '#F6E7B4' },
  { bg: '#0E5A57', fg: '#FBE9B7' },
  { bg: '#7A1F2B', fg: '#F6E3D0' },
  { bg: '#E8B23A', fg: '#1F1B3A' },
  { bg: '#24452F', fg: '#E8E2C4' },
  { bg: '#5B5FA8', fg: '#FFFFFF' },
];

type CoverBook = Pick<Book, 'id' | 'title' | 'coverUrl' | 'authors'>;

export default function BookCover({ book, className = '' }: { book: CoverBook; className?: string }) {
  const [failed, setFailed] = useState(false);

  if (book.coverUrl && !failed) {
    return (
      <div className={`cover ${className}`}>
        <img src={book.coverUrl} alt={`Bìa sách ${book.title}`} loading="lazy" onError={() => setFailed(true)} />
      </div>
    );
  }

  const p = PALETTES[book.id % PALETTES.length];
  return (
    <div
      className={`cover cover--drawn ${className}`}
      style={{ '--cover-bg': p.bg, '--cover-fg': p.fg } as CSSProperties}
      role="img"
      aria-label={`Bìa sách ${book.title}`}
    >
      <span className="cover__title">{book.title}</span>
      <span className="cover__author">{book.authors[0]?.name}</span>
    </div>
  );
}
