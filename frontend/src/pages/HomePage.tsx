// Trang chủ (UC003 bước 1): sách mới, sách có e-book, thể loại.
import { Link } from 'react-router-dom';
import BookCard, { BookGridSkeleton } from '../components/book/BookCard';
import BookCover from '../components/book/BookCover';
import { ErrorState } from '../components/common/States';
import { useAuth } from '../context/AuthContext';
import { useAsync } from '../hooks/useAsync';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { bookService } from '../services/bookservice';
import { PAGINATION } from '../config/rules';
import { ROUTES } from '../config/routes';
import { toMessage } from '../utils/errors';
import type { BookListResult } from '../types';

interface ListState {
  data: BookListResult | null;
  loading: boolean;
  error: unknown;
  reload: () => void;
}

// Một hàng sách của trang chủ, tự xử lý đang tải / lỗi / rỗng
function BookSection({ title, linkTo, state }: { title: string; linkTo: string; state: ListState }) {
  const items = state.data?.items ?? [];
  if (!state.loading && !state.error && items.length === 0) return null;
  return (
    <section className="section container" aria-label={title}>
      <div className="section__head">
        <h2 className="section__title">{title}</h2>
        <Link to={linkTo} className="section__link">Xem tất cả</Link>
      </div>
      {state.error ? (
        <ErrorState message={toMessage(state.error)} onRetry={state.reload} />
      ) : state.loading && !state.data ? (
        <BookGridSkeleton count={4} />
      ) : (
        <div className="book-grid">{items.map((b) => <BookCard key={b.id} book={b} />)}</div>
      )}
    </section>
  );
}

export default function HomePage() {
  useDocumentTitle();
  const { user } = useAuth();
  const size = PAGINATION.HOME_SECTION_SIZE;

  const newest = useAsync(() => bookService.getBooks({ sort: 'newest', limit: size }), []);
  const ebooks = useAsync(() => bookService.getBooks({ hasEbook: true, sort: 'newest', limit: size }), []);
  const categories = useAsync(() => bookService.getCategories(), []);

  const shelf = newest.data?.items.slice(0, 3) ?? [];

  return (
    <>
      <section className="hero">
        <div className="hero__inner container">
          <div className="hero__text">
            <h1 className="hero__title">Sách giấy giao tận nhà, e-book đọc ngay trên trình duyệt</h1>
            <p className="hero__sub">Tìm theo tên sách, tác giả hay thể loại. Xem giá và tình trạng còn hàng trước khi chọn.</p>
            <div className="hero__actions">
              <Link to={ROUTES.BOOKS} className="btn btn--accent btn--lg">Xem tất cả sách</Link>
              {!user && <Link to={ROUTES.REGISTER} className="btn btn--ghost btn--lg">Tạo tài khoản</Link>}
            </div>
          </div>

          <div className="shelf" aria-hidden={shelf.length === 0}>
            {shelf.map((b) => (
              <Link key={b.id} to={ROUTES.BOOK_DETAIL(b.id)} className="shelf__book" tabIndex={0} aria-label={b.title}>
                <BookCover book={b} />
              </Link>
            ))}
          </div>
        </div>
      </section>

      <BookSection title="Sách mới" linkTo={ROUTES.BOOKS} state={newest} />

      {(categories.data?.length ?? 0) > 0 && (
        <section className="section container" aria-label="Thể loại">
          <h2 className="section__title">Chọn theo thể loại</h2>
          <ul className="chips">
            {categories.data!.map((c) => (
              <li key={c.id}><Link to={`${ROUTES.BOOKS}?categoryId=${c.id}`} className="chip">{c.name}</Link></li>
            ))}
          </ul>
        </section>
      )}

      <BookSection title="Sách có bản e-book" linkTo={`${ROUTES.BOOKS}?format=ebook`} state={ebooks} />
    </>
  );
}
