import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useAsync } from '../../hooks/useAsync';
import { READER } from '../../config/reader';
import { ROUTES } from '../../config/routes';
import { readerService } from '../../services/readerservice';
import type { ChapterSummary } from '../../types';
import { isSectionTitle, withTocDisplayOrder } from '../../utils/chapterMeta';

/** Chương thuộc phần cần gói (từ chương 11) — chỉ để hiện 🔒, không đổi màu xám */
function needsPackage(c: ChapterSummary, freeLimit: number) {
  if (c.isFree === false) return true;
  if (c.isFree === true) return false;
  return c.chapterNumber > freeLimit;
}

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
        <h2 id="toc-title" className="book-toc-panel__title">Mục lục chương</h2>
        <p className="field__hint">
          <Link to={ROUTES.LOGIN}>Đăng nhập</Link> để xem mục lục và tiếp tục đọc từ chương gần nhất.
        </p>
      </section>
    );
  }

  if (list.loading || progress.loading) {
    return (
      <section className="book-toc-panel">
        <h2 className="book-toc-panel__title">Mục lục chương</h2>
        <p className="field__hint">Đang tải mục lục...</p>
      </section>
    );
  }

  if (!list.data?.items.length) {
    return (
      <section className="book-toc-panel">
        <h2 className="book-toc-panel__title">Mục lục chương</h2>
        <p className="field__hint">Sách chưa có chương e-book.</p>
      </section>
    );
  }

  const lastRead = progress.data?.chapterNumber ?? 0;
  // Giống «Chương từ EPUB»: sắp STT tăng dần; phần phụ chỉ tiêu đề; chương thật đánh số tuần tự
  const items = withTocDisplayOrder(list.data.items);
  const freeLimit = list.data.freeChapterLimit ?? READER.FREE_CHAPTER_LIMIT;

  return (
    <section className="book-toc-panel" aria-labelledby="toc-title">
      <div className="book-toc-panel__head">
        <h2 id="toc-title" className="book-toc-panel__title">Mục lục chương</h2>
        {lastRead > 0 && (
          <p className="book-toc-panel__progress">
            Đã đọc đến chương {lastRead}
            {' · '}
            <Link to={ROUTES.READER(bookId)}>Tiếp tục đọc</Link>
          </p>
        )}
      </div>
      <ol className="book-toc-panel__list">
        {items.map((c) => {
          const front = c.displayChapter == null;
          const read = !front && lastRead > 0 && c.chapterNumber <= lastRead;
          const pack = !front && needsPackage(c, freeLimit);
          const cls = read ? 'is-read' : 'is-unread';
          return (
            <li key={c.id} className={`book-toc-panel__item ${cls}`}>
              <Link to={`${ROUTES.READER(bookId)}?chapter=${c.chapterNumber}`} className="book-toc-panel__link">
                <span className="book-toc-panel__text">{c.label}</span>
                {pack ? <span className="toc-lock" aria-label="Cần gói đọc">🔒</span> : null}
                {read ? <span aria-hidden="true">✓</span> : null}
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
