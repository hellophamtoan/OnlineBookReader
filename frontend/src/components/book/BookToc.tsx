import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useAsync } from '../../hooks/useAsync';
import { ROUTES } from '../../config/routes';
import { readerService } from '../../services/readerservice';
import type { ChapterSummary } from '../../types';

export default function BookToc({ bookId, hasEbook }: { bookId: number; hasEbook: boolean }) {
  const { user } = useAuth();
  const list = useAsync(
    () => (user && hasEbook ? readerService.getChapterList(bookId) : Promise.resolve(null)),
    [bookId, user?.id, hasEbook],
  );
  const progress = useAsync(
    () => (user && hasEbook ? readerService.getProgress(bookId) : Promise.resolve(null)),
    [bookId, user?.id, hasEbook],
  );

  if (!hasEbook) return null;

  if (!user) {
    return (
      <section className="book-toc-panel" aria-labelledby="toc-title">
        <h2 id="toc-title" className="book-toc-panel__title">Mục lục</h2>
        <p className="field__hint">
          <Link to={ROUTES.LOGIN}>Đăng nhập</Link> để xem mục lục và tiếp tục đọc từ chương gần nhất.
        </p>
      </section>
    );
  }

  if (list.loading || progress.loading) {
    return (
      <section className="book-toc-panel">
        <h2 className="book-toc-panel__title">Mục lục</h2>
        <p className="field__hint">Đang tải mục lục...</p>
      </section>
    );
  }

  if (!list.data?.items.length) {
    return (
      <section className="book-toc-panel">
        <h2 className="book-toc-panel__title">Mục lục</h2>
        <p className="field__hint">Sách chưa có chương e-book.</p>
      </section>
    );
  }

  const lastRead = progress.data?.chapterNumber ?? 0;
  const items = list.data.items;

  return (
    <section className="book-toc-panel" aria-labelledby="toc-title">
      <div className="book-toc-panel__head">
        <h2 id="toc-title" className="book-toc-panel__title">Mục lục</h2>
        {lastRead > 0 && (
          <p className="book-toc-panel__progress">
            Đã đọc đến chương {lastRead}
            {' · '}
            <Link to={ROUTES.READER(bookId)}>Tiếp tục đọc</Link>
          </p>
        )}
      </div>
      <ol className="book-toc-panel__list">
        {items.map((c: ChapterSummary) => {
          const read = lastRead > 0 && c.chapterNumber <= lastRead;
          const locked = Boolean(c.locked);
          const cls = locked ? 'is-locked' : read ? 'is-read' : 'is-unread';
          return (
            <li key={c.id} className={`book-toc-panel__item ${cls}`}>
              {locked ? (
                <span>
                  Chương {c.chapterNumber}. {c.title} <span aria-hidden="true">🔒</span>
                </span>
              ) : (
                <Link to={`${ROUTES.READER(bookId)}?chapter=${c.chapterNumber}`}>
                  Chương {c.chapterNumber}. {c.title}
                  {read ? ' ✓' : ''}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
