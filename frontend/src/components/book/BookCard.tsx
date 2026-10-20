import { Link } from 'react-router-dom';
import { ROUTES } from '../../config/routes';
import { authorLine, isPhysical, stockLabel } from '../../utils/book';
import { formatPrice } from '../../utils/format';
import type { Book } from '../../types';
import BookCover from './BookCover';

// Thẻ sách trong lưới (UC003 bước 2/4). Cả thẻ là một liên kết tới trang chi tiết.
export default function BookCard({ book }: { book: Book }) {
  const stock = stockLabel(book);
  return (
    <Link to={ROUTES.BOOK_DETAIL(book.id)} className="book-card">
      <BookCover book={book} />
      <div className="book-card__body">
        <h3 className="book-card__title">{book.title}</h3>
        <p className="book-card__author">{authorLine(book)}</p>
        <p className="book-card__price">
          {isPhysical(book) && book.price !== null ? formatPrice(book.price) : 'Chỉ đọc online'}
        </p>
        <p className="book-card__tags">
          {book.hasEbook && <span className="tag tag--brand">E-book</span>}
          {stock?.tone === 'out' && <span className="tag tag--out">{stock.text}</span>}
        </p>
      </div>
    </Link>
  );
}

export function BookGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="book-grid" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="book-card book-card--skeleton">
          <div className="cover skeleton" />
          <div className="skeleton skeleton--line" />
          <div className="skeleton skeleton--line skeleton--short" />
        </div>
      ))}
    </div>
  );
}
