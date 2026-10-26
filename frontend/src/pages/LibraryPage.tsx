import { useState } from 'react';
import { Link } from 'react-router-dom';
import BookCover from '../components/book/BookCover';
import { EmptyState, ErrorState, LoadingBlock } from '../components/common/States';
import { ROUTES } from '../config/routes';
import { useAsync } from '../hooks/useAsync';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { libraryService } from '../services/libraryservice';
import type { LibraryBook } from '../services/libraryservice';
import { toMessage } from '../utils/errors';

type Tab = 'reading' | 'saved';

type LibraryCardModel = {
  id: number;
  title: string;
  coverUrl: string | null;
  authors: { id?: number; name: string }[];
  hasEbook: boolean;
  meta: string;
  primaryLabel: string;
  primaryTo: string;
  secondaryLabel: string;
  secondaryTo?: string;
  onSecondary?: () => void;
};

function LibraryCard({ item }: { item: LibraryCardModel }) {
  return (
    <article className="book-card library-item">
      <Link to={ROUTES.BOOK_DETAIL(item.id)} className="book-card__cover-wrap" aria-label={item.title}>
        <BookCover
          book={{
            id: item.id,
            title: item.title,
            coverUrl: item.coverUrl,
            authors: item.authors,
          }}
          enableZoom={false}
        />
      </Link>
      <div className="book-card__body library-item__body">
        <h3 className="book-card__title">
          <Link to={ROUTES.BOOK_DETAIL(item.id)}>{item.title}</Link>
        </h3>
        <p className="book-card__author">
          {(item.authors ?? []).map((a) => a.name).join(', ') || 'Chưa rõ tác giả'}
        </p>
        <p className="library-item__meta" title={item.meta}>
          {item.meta}
        </p>
        <div className="library-item__actions">
          <Link className="btn btn--primary btn--sm library-item__btn" to={item.primaryTo}>
            {item.primaryLabel}
          </Link>
          {item.secondaryTo ? (
            <Link className="btn btn--ghost btn--sm library-item__btn" to={item.secondaryTo}>
              {item.secondaryLabel}
            </Link>
          ) : (
            <button
              type="button"
              className="btn btn--ghost btn--sm library-item__btn"
              onClick={item.onSecondary}
            >
              {item.secondaryLabel}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

function toReadingCard(book: LibraryBook): LibraryCardModel {
  const meta = book.lastChapterNumber
    ? `Đang ở chương ${book.lastChapterNumber}${book.lastChapterTitle ? `: ${book.lastChapterTitle}` : ''}`
    : 'Đang đọc';
  return {
    id: book.id,
    title: book.title,
    coverUrl: book.coverUrl ?? null,
    authors: book.authors ?? [],
    hasEbook: book.hasEbook,
    meta,
    primaryLabel: 'Tiếp tục đọc',
    primaryTo: ROUTES.READER(book.id),
    secondaryLabel: 'Xem chi tiết',
    secondaryTo: ROUTES.BOOK_DETAIL(book.id),
  };
}

function toSavedCard(book: LibraryBook, onRemove: () => void): LibraryCardModel {
  const meta = book.lastChapterNumber
    ? `Đã đọc đến chương ${book.lastChapterNumber}${book.lastChapterTitle ? `: ${book.lastChapterTitle}` : ''}`
    : 'Chưa đọc';
  return {
    id: book.id,
    title: book.title,
    coverUrl: book.coverUrl ?? null,
    authors: book.authors ?? [],
    hasEbook: book.hasEbook,
    meta,
    primaryLabel: book.hasEbook
      ? book.lastChapterNumber
        ? 'Tiếp tục đọc'
        : 'Đọc ngay'
      : 'Xem chi tiết',
    primaryTo: book.hasEbook ? ROUTES.READER(book.id) : ROUTES.BOOK_DETAIL(book.id),
    secondaryLabel: 'Gỡ khỏi thư viện',
    onSecondary: onRemove,
  };
}

export default function LibraryPage() {
  useDocumentTitle('Thư viện của tôi');
  const [tab, setTab] = useState<Tab>('reading');
  const reading = useAsync(() => libraryService.listReading(), []);
  const saved = useAsync(() => libraryService.list(), []);

  const active = tab === 'reading' ? reading : saved;
  const loading = active.loading && !active.data;
  const error = active.error;
  const reload = () => {
    reading.reload();
    saved.reload();
  };

  if (loading) {
    return (
      <div className="container page">
        <LoadingBlock label="Đang tải thư viện..." />
      </div>
    );
  }
  if (error) {
    return (
      <div className="container page">
        <ErrorState message={toMessage(error)} onRetry={reload} />
      </div>
    );
  }

  const readingItems = reading.data ?? [];
  const savedItems = saved.data ?? [];

  return (
    <div className="container page library-page">
      <header className="library-page__head">
        <h1 className="page__title">Thư viện của tôi</h1>
        <p className="field__hint library-page__intro">
          Sách đang đọc và sách đã lưu — cùng một kiểu thẻ để dễ duyệt.
        </p>
      </header>

      <div className="library-tabs" role="tablist" aria-label="Phân mục thư viện">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'reading'}
          className={`library-tabs__btn${tab === 'reading' ? ' is-active' : ''}`}
          onClick={() => setTab('reading')}
        >
          Đang đọc ({readingItems.length})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'saved'}
          className={`library-tabs__btn${tab === 'saved' ? ' is-active' : ''}`}
          onClick={() => setTab('saved')}
        >
          Đã lưu ({savedItems.length})
        </button>
      </div>

      {tab === 'reading' &&
        (readingItems.length === 0 ? (
          <EmptyState
            title="Chưa có sách đang đọc"
            hint="Mở một cuốn e-book và đọc vài trang — sách sẽ xuất hiện ở đây."
            action={
              <Link className="btn btn--primary" to={ROUTES.BOOKS}>
                Xem sách
              </Link>
            }
          />
        ) : (
          <div className="book-grid library-grid">
            {readingItems.map((b) => (
              <LibraryCard key={b.id} item={toReadingCard(b)} />
            ))}
          </div>
        ))}

      {tab === 'saved' &&
        (savedItems.length === 0 ? (
          <EmptyState
            title="Chưa có sách trong thư viện"
            hint="Mở trang chi tiết sách và chọn «Lưu vào thư viện»."
            action={
              <Link className="btn btn--primary" to={ROUTES.BOOKS}>
                Xem sách
              </Link>
            }
          />
        ) : (
          <div className="book-grid library-grid">
            {savedItems.map((b) => (
              <LibraryCard
                key={b.id}
                item={toSavedCard(b, async () => {
                  await libraryService.remove(b.id);
                  saved.reload();
                  reading.reload();
                })}
              />
            ))}
          </div>
        ))}
    </div>
  );
}
