// UC006 - Đọc sách trực tuyến (API-10, API-11, API-12, API-13).
// Trang này chỉ lo "cổng vào": kiểm tra quyền đọc + tải mục lục và tiến trình. Phần đọc thật nằm ở components/reader/ReaderView.tsx.
import { Link, useParams } from 'react-router-dom';
import { EmptyState, ErrorState, LoadingBlock } from '../components/common/States';
import ReaderView from '../components/reader/ReaderView';
import SubscriptionRequired from '../components/reader/SubscriptionRequired';
import { READER_MESSAGES } from '../config/reader';
import { ROUTES } from '../config/routes';
import { useAsync } from '../hooks/useAsync';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { ApiError } from '../services/api';
import { readerService } from '../services/readerservice';
import { toMessage } from '../utils/errors';

export default function ReaderPage() {
  const bookId = Number(useParams().bookId);
  const validId = Number.isInteger(bookId) && bookId >= 1;

  const invalid = () => Promise.reject(new ApiError(READER_MESSAGES.noEbook, 404));
  const list = useAsync(() => (validId ? readerService.getChapterList(bookId) : invalid()), [bookId]);
  const saved = useAsync(() => (validId ? readerService.getProgress(bookId) : invalid()), [bookId]);
  useDocumentTitle(list.data ? list.data.book.title : 'Đọc sách');

  const error = list.error ?? saved.error;
  const backLink = <Link className="btn btn--ghost" to={validId ? ROUTES.BOOK_DETAIL(bookId) : ROUTES.BOOKS}>Quay lại</Link>;

  if (error) {
    const status = error instanceof ApiError ? error.status : 0;
    return (
      <div className="container page">
        {status === 403 ? (
          <SubscriptionRequired bookId={bookId} /> // luồng 3a
        ) : status === 404 || status === 400 ? (
          <EmptyState title="Không thể mở sách" hint={READER_MESSAGES.noEbook} action={backLink} />
        ) : (
          <ErrorState message={toMessage(error)} onRetry={() => { list.reload(); saved.reload(); }} />
        )}
      </div>
    );
  }

  if (!list.data || !saved.data) return <div className="container page"><LoadingBlock label="Đang mở sách..." /></div>;

  if (list.data.items.length === 0) {
    return <div className="container page"><EmptyState title="Chưa có nội dung" hint={READER_MESSAGES.noChapters} action={backLink} /></div>;
  }

  // key={bookId}: đổi sách thì dựng lại toàn bộ trạng thái đọc
  return <ReaderView key={bookId} book={list.data.book} chapters={list.data.items} initial={saved.data} />;
}
