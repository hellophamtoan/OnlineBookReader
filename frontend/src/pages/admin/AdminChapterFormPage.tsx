// UC007 - Thêm / Sửa một chương e-book (API-32, API-33, API-34). Có :chapterId trên URL = sửa, không có = thêm vào sách :bookId.
import { Link, useNavigate, useParams } from 'react-router-dom';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import ChapterForm from '../../components/admin/ChapterForm';
import { EmptyState, ErrorState, LoadingBlock } from '../../components/common/States';
import { ROUTES } from '../../config/routes';
import { useAsync } from '../../hooks/useAsync';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { ApiError } from '../../services/api';
import { chapterAdminService } from '../../services/admin/chapteradminservice';
import type { AdminChapter, AdminChapterPayload } from '../../types';
import { toMessage } from '../../utils/errors';

export default function AdminChapterFormPage() {
  const params = useParams();
  const bookId = Number(params.bookId);
  const chapterId = params.chapterId === undefined ? undefined : Number(params.chapterId);
  const isEdit = chapterId !== undefined;
  const validIds = Number.isInteger(bookId) && bookId >= 1 && (chapterId === undefined || (Number.isInteger(chapterId) && chapterId >= 1));
  const navigate = useNavigate();
  useDocumentTitle(isEdit ? 'Sửa chương' : 'Thêm chương');

  const invalid = () => Promise.reject(new ApiError('Không tìm thấy', 404));
  const list = useAsync(() => (validIds ? chapterAdminService.list(bookId) : invalid()), [bookId]);
  const chapter = useAsync<AdminChapter | null>(
    () => (!validIds ? invalid() : chapterId === undefined ? Promise.resolve(null) : chapterAdminService.get(chapterId)),
    [chapterId, bookId]
  );

  const title = isEdit ? 'Sửa chương' : 'Thêm chương';
  const chaptersUrl = ROUTES.ADMIN_BOOK_CHAPTERS(bookId);
  const crumbs = [
    { label: 'Tổng quan', to: ROUTES.ADMIN_HOME },
    { label: 'Sách & kho', to: ROUTES.ADMIN_BOOKS },
    { label: 'Chương e-book', to: chaptersUrl },
    { label: title },
  ];

  const failure = list.error ?? chapter.error;
  // Chương phải thuộc đúng sách trên URL
  const mismatch = chapter.data && chapter.data.bookId !== bookId;
  if (failure || mismatch) {
    const notFound = mismatch || (failure instanceof ApiError && (failure.status === 404 || failure.status === 400));
    return (
      <>
        <AdminPageHeader title={title} crumbs={crumbs.slice(0, 3)} />
        {notFound ? (
          <EmptyState title="Không tìm thấy chương" action={<Link className="btn btn--ghost" to={ROUTES.ADMIN_BOOKS}>Về danh sách sách</Link>} />
        ) : (
          <ErrorState message={toMessage(failure)} onRetry={() => { list.reload(); chapter.reload(); }} />
        )}
      </>
    );
  }
  if (!list.data || chapter.loading || (isEdit && !chapter.data)) return <LoadingBlock label="Đang tải..." />;

  // Gợi ý số chương tiếp theo khi thêm mới
  const nextNumber = Math.max(0, ...list.data.items.map((c) => c.chapterNumber)) + 1;

  // Lưu thành công -> về danh sách chương kèm thông báo (lỗi 400/409 do ChapterForm xử lý tại chỗ)
  const submit = async (payload: AdminChapterPayload) => {
    const saved = chapterId === undefined ? await chapterAdminService.create(bookId, payload) : await chapterAdminService.update(chapterId, payload);
    navigate(chaptersUrl, { state: { notice: `${isEdit ? 'Đã cập nhật' : 'Đã thêm'} "${saved.title}"` } });
  };

  return (
    <>
      <AdminPageHeader title={`${title}: ${list.data.book.title}`} crumbs={crumbs} />
      <ChapterForm
        initial={chapter.data ?? undefined}
        defaultNumber={nextNumber}
        submitLabel={isEdit ? 'Lưu thay đổi' : 'Thêm chương'}
        onSubmit={submit}
        onCancel={() => navigate(chaptersUrl)}
      />
    </>
  );
}
