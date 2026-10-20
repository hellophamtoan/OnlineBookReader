// UC003 - Duyệt & tra cứu sách (API-05, API-07 + tác giả/NXB). Bộ lọc lưu trên URL.
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import BookCard, { BookGridSkeleton } from '../components/book/BookCard';
import BookFilters from '../components/book/BookFilters';
import Pagination from '../components/common/Pagination';
import { EmptyState, ErrorState } from '../components/common/States';
import { useAsync } from '../hooks/useAsync';
import { useDebounce } from '../hooks/useDebounce';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { bookService } from '../services/bookservice';
import { BOOK_SORTS, PAGINATION } from '../config/rules';
import { ROUTES } from '../config/routes';
import { toMessage } from '../utils/errors';
import { hasActiveFilter, parseFilters, patchParams, toBookQuery } from '../utils/bookFilters';
import type { FilterPatch } from '../utils/bookFilters';
import type { BookSort, Option } from '../types';

const NO_OPTIONS: Option[] = [];

export default function BooksPage() {
  useDocumentTitle('Sách');
  const [sp, setSp] = useSearchParams();
  const filters = useMemo(() => parseFilters(sp), [sp]);
  const [keyword, setKeyword] = useState(filters.search);
  const debouncedKeyword = useDebounce(keyword, 400);

  const update = (patch: FilterPatch) => setSp(patchParams(sp, patch));

  // Từ khóa đổi bên ngoài (ô tìm kiếm ở Header, nút Xóa bộ lọc) -> cập nhật ô nhập
  useEffect(() => setKeyword(filters.search), [filters.search]);
  // Gõ xong 0,4 giây thì mới tìm (tránh gọi API mỗi phím)
  useEffect(() => {
    const q = debouncedKeyword.trim();
    if (q !== filters.search) update({ search: q });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedKeyword]);

  const categories = useAsync(() => bookService.getCategories(), []);
  // Tác giả/NXB chưa có trong hợp đồng UC001–UC003: lỗi thì bỏ qua, bộ lọc tự ẩn
  const authors = useAsync(() => bookService.getAuthors().catch(() => NO_OPTIONS), []);
  const publishers = useAsync(() => bookService.getPublishers().catch(() => NO_OPTIONS), []);

  const result = useAsync(
    () => bookService.getBooks(toBookQuery(filters, PAGINATION.BOOKS_PER_PAGE)),
    [sp.toString()]
  );

  const books = result.data;
  const total = books?.pagination.total ?? 0;
  const totalPages = books?.pagination.totalPages ?? 1;
  const filtered = hasActiveFilter(filters);

  // Đang ở trang vượt quá số trang (vd. link cũ) -> về trang cuối
  useEffect(() => {
    if (books && total > 0 && filters.page > totalPages) setSp(patchParams(sp, { page: totalPages }), { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [books]);

  const goToPage = (page: number) => {
    update({ page });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const clearFilters = () => {
    setKeyword('');
    setSp(new URLSearchParams());
  };

  return (
    <div className="container page">
      <h1 className="page__title">Sách</h1>

      <div className="catalog">
        <BookFilters
          filters={filters}
          keyword={keyword}
          categories={categories.data ?? NO_OPTIONS}
          authors={authors.data ?? NO_OPTIONS}
          publishers={publishers.data ?? NO_OPTIONS}
          canClear={filtered}
          onKeywordChange={setKeyword}
          onKeywordSubmit={() => update({ search: keyword.trim() })}
          onChange={update}
          onClear={clearFilters}
        />

        <section className="catalog__results" aria-live="polite">
          <div className="catalog__bar">
            <p className="catalog__count">
              {result.loading && !books ? 'Đang tải...' : <>Có <b>{total}</b> cuốn sách{filters.search && <> cho “{filters.search}”</>}</>}
            </p>
            <label className="catalog__sort">
              Sắp xếp
              <select className="input" value={filters.sort} onChange={(e) => update({ sort: e.target.value as BookSort })}>
                {BOOK_SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </label>
          </div>

          {result.error ? (
            <ErrorState message={toMessage(result.error)} onRetry={result.reload} />
          ) : !books ? (
            <BookGridSkeleton count={PAGINATION.BOOKS_PER_PAGE} />
          ) : books.items.length === 0 ? (
            // Luồng 2a: hệ thống chưa có sách; 4a: không có sách khớp bộ lọc
            filtered ? (
              <EmptyState
                title="Không tìm thấy sách phù hợp"
                hint="Hãy kiểm tra lại từ khóa hoặc bỏ bớt bộ lọc."
                action={<button type="button" className="btn btn--ghost" onClick={clearFilters}>Xóa bộ lọc</button>}
              />
            ) : (
              <EmptyState title="Chưa có sách trong hệ thống" hint="Vui lòng quay lại sau." action={<Link className="btn btn--ghost" to={ROUTES.HOME}>Về trang chủ</Link>} />
            )
          ) : (
            <div className={result.loading ? 'is-loading' : undefined}>
              <div className="book-grid">
                {books.items.map((b) => <BookCard key={b.id} book={b} />)}
              </div>
              <Pagination page={books.pagination.page} totalPages={totalPages} onChange={goToPage} />
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
