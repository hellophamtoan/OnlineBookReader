// UC003 bước 5-6 - Chi tiết sách (API-06)
// Layout căn theo admin chi tiết: bìa | thông tin+giới thiệu+hành động; mục lục chương full-width bên dưới.
import { Link, useParams } from 'react-router-dom';
import BookActions from '../components/book/BookActions';
import BookCover from '../components/book/BookCover';
import BookDetailActions from '../components/book/BookDetailActions';
import BookToc from '../components/book/BookToc';
import { EmptyState, ErrorState, LoadingBlock } from '../components/common/States';
import { useAsync } from '../hooks/useAsync';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { ApiError } from '../services/api';
import { bookService } from '../services/bookservice';
import { ROUTES } from '../config/routes';
import { isPhysical, stockLabel } from '../utils/book';
import { formatDate, formatPrice } from '../utils/format';
import { toMessage } from '../utils/errors';
import ReadBookButton from '../components/reader/ReadBookButton';

export default function BookDetailPage() {
  const id = Number(useParams().id);
  const validId = Number.isInteger(id) && id >= 1;

  const { data: book, loading, error, reload } = useAsync(
    () => (validId ? bookService.getBook(id) : Promise.reject(new ApiError('Không tìm thấy sách', 404))),
    [id],
  );
  useDocumentTitle(book?.title);

  if (loading && !book) {
    return (
      <div className="container page">
        <LoadingBlock label="Đang tải thông tin sách..." />
      </div>
    );
  }

  if (error || !book) {
    const notFound = error instanceof ApiError && (error.status === 404 || error.status === 400);
    return (
      <div className="container page">
        {notFound ? (
          <EmptyState
            title="Không tìm thấy sách"
            hint="Sách này không tồn tại hoặc đã ngừng bán."
            action={
              <Link className="btn btn--ghost" to={ROUTES.BOOKS}>
                Xem tất cả sách
              </Link>
            }
          />
        ) : (
          <ErrorState message={toMessage(error)} onRetry={reload} />
        )}
      </div>
    );
  }

  const stock = stockLabel(book);
  const forms = [isPhysical(book) && 'Sách giấy', book.hasEbook && 'E-book'].filter(Boolean).join(', ');

  return (
    <div className="container page">
      <nav className="breadcrumb" aria-label="Vị trí trang">
        <Link to={ROUTES.BOOKS}>Sách</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{book.title}</span>
      </nav>

      {/* Cùng nhịp admin: article grid bìa + info */}
      <article className="detail">
        <div className="detail__cover-col">
          <BookCover book={book} className="detail__cover" enableZoom />
          <BookDetailActions book={book} />
        </div>

        <div className="detail__info">
          <h1 className="detail__title">{book.title}</h1>
          <p className="detail__authors">
            {book.authors.length === 0
              ? 'Chưa rõ tác giả'
              : book.authors.map((a, i) => (
                  <span key={`${a.id ?? a.name}`}>
                    {i > 0 && ', '}
                    {a.id ? <Link to={`${ROUTES.BOOKS}?authorId=${a.id}`}>{a.name}</Link> : a.name}
                  </span>
                ))}
          </p>

          <div className="detail__buy">
            <p className="detail__price">
              {isPhysical(book) && book.price !== null ? formatPrice(book.price) : 'Chỉ đọc online'}
            </p>
            {stock && <span className={`tag tag--${stock.tone}`}>{stock.text}</span>}
          </div>

          <h2 className="detail__heading">Thông tin</h2>
          <dl className="detail__meta">
            {book.publisher && (
              <>
                <dt>Nhà xuất bản</dt>
                <dd>{book.publisher.name}</dd>
              </>
            )}
            {book.categories.length > 0 && (
              <>
                <dt>Thể loại</dt>
                <dd>
                  {book.categories.map((c, i) => (
                    <span key={`${c.id ?? c.name}`}>
                      {i > 0 && ', '}
                      {c.id ? <Link to={`${ROUTES.BOOKS}?categoryId=${c.id}`}>{c.name}</Link> : c.name}
                    </span>
                  ))}
                </dd>
              </>
            )}
            {forms && (
              <>
                <dt>Hình thức</dt>
                <dd>{forms}</dd>
              </>
            )}
            {book.createdAt && (
              <>
                <dt>Ngày thêm</dt>
                <dd>{formatDate(book.createdAt)}</dd>
              </>
            )}
          </dl>

          <section aria-labelledby="desc-title">
            <h2 id="desc-title" className="detail__heading">
              Giới thiệu
            </h2>
            <p className="detail__desc">{book.description || 'Chưa có mô tả cho cuốn sách này.'}</p>
          </section>

          <div className="detail__read-block">
            <ReadBookButton book={book} />
          </div>

          <BookActions book={book} hideRead />
        </div>
      </article>

      {/* Mục lục full-width dưới khối chi tiết — cùng vị trí admin */}
      {book.hasEbook && (
        <div style={{ marginTop: 28 }}>
          <BookToc bookId={book.id} hasEbook />
        </div>
      )}
    </div>
  );
}
