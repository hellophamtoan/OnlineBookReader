// UC007 - Thêm / Sửa sách (API-28, API-29; nạp dữ liệu bằng API-27 và danh mục API-14/18/22).
// Thêm mới + EPUB: tạo sách rồi nạp đủ chương; lỗi từng chương được báo, không bỏ sót im lặng.
import { Link, useNavigate, useParams } from 'react-router-dom';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import BookForm from '../../components/admin/BookForm';
import { EmptyState, ErrorState, LoadingBlock } from '../../components/common/States';
import { ROUTES } from '../../config/routes';
import { useAsync } from '../../hooks/useAsync';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { ApiError } from '../../services/api';
import { bookAdminService } from '../../services/admin/bookadminservice';
import { taxonomyService } from '../../services/admin/taxonomyservice';
import type { AdminBookDetail, AdminBookPayload, EpubParsedChapter } from '../../types';
import { formatChapterImportReport, importEpubChaptersFully } from '../../utils/importChapters';
import { toMessage } from '../../utils/errors';

export default function AdminBookFormPage() {
  const idParam = useParams().id;
  const isEdit = idParam !== undefined;
  const bookId = Number(idParam);
  const validId = !isEdit || (Number.isInteger(bookId) && bookId >= 1);
  const navigate = useNavigate();
  useDocumentTitle(isEdit ? 'Sửa sách' : 'Thêm sách');

  const book = useAsync<AdminBookDetail | null>(
    () =>
      !isEdit
        ? Promise.resolve(null)
        : validId
          ? bookAdminService.get(bookId)
          : Promise.reject(new ApiError('Không tìm thấy sách', 404)),
    [idParam],
  );
  const authors = useAsync(() => taxonomyService.list('authors'), []);
  const categories = useAsync(() => taxonomyService.list('categories'), []);
  const publishers = useAsync(() => taxonomyService.list('publishers'), []);

  const crumbs = [
    { label: 'Tổng quan', to: ROUTES.ADMIN_HOME },
    { label: 'Sách & kho', to: ROUTES.ADMIN_BOOKS },
    { label: isEdit ? 'Sửa sách' : 'Thêm sách' },
  ];
  const backToList = () => navigate(ROUTES.ADMIN_BOOKS);

  const error = book.error ?? authors.error ?? categories.error ?? publishers.error;
  if (error) {
    const notFound = error instanceof ApiError && (error.status === 404 || error.status === 400);
    return (
      <>
        <AdminPageHeader title={isEdit ? 'Sửa sách' : 'Thêm sách'} crumbs={crumbs} />
        {notFound ? (
          <EmptyState
            title="Không tìm thấy sách"
            hint="Sách không tồn tại."
            action={
              <Link className="btn btn--ghost" to={ROUTES.ADMIN_BOOKS}>
                Về danh sách sách
              </Link>
            }
          />
        ) : (
          <ErrorState
            message={toMessage(error)}
            onRetry={() => {
              book.reload();
              authors.reload();
              categories.reload();
              publishers.reload();
            }}
          />
        )}
      </>
    );
  }

  if (book.data === null && isEdit) return <LoadingBlock label="Đang tải thông tin sách..." />;
  if (book.loading || !authors.data || !categories.data || !publishers.data) {
    return <LoadingBlock label="Đang tải biểu mẫu..." />;
  }

  const submit = async (payload: AdminBookPayload, chapters?: EpubParsedChapter[]) => {
    if (isEdit) {
      const saved = await bookAdminService.update(bookId, payload);
      navigate(ROUTES.ADMIN_BOOKS, { state: { notice: `Đã cập nhật sách "${saved.title}"` } });
      return;
    }

    const saved = await bookAdminService.create(payload);
    const list = chapters?.length ? chapters : [];

    // Có chương EPUB nhưng sách không bật e-book → báo rõ, không im lặng bỏ
    if (list.length > 0 && !saved.hasEbook) {
      navigate(ROUTES.ADMIN_BOOKS, {
        state: {
          notice: `Đã thêm sách "${saved.title}" nhưng chưa bật E-book nên không nạp được ${list.length} chương. Hãy sửa sách, bật E-book, rồi thêm chương thủ công hoặc import lại.`,
        },
      });
      return;
    }

    if (list.length === 0) {
      navigate(ROUTES.ADMIN_BOOKS, { state: { notice: `Đã thêm sách "${saved.title}"` } });
      return;
    }

    // Nạp hết chương → quét lại API → bổ sung số còn thiếu
    const result = await importEpubChaptersFully(saved.id, list);
    const { notice, isError } = formatChapterImportReport(saved.title, result, { bookCreated: true });

    // Một phần / toàn bộ lỗi: đưa tới trang quản lý chương để xử lý tiếp, kèm thông báo đủ
    if (isError) {
      navigate(ROUTES.ADMIN_BOOK_CHAPTERS(saved.id), {
        state: {
          notice,
          noticeTone: 'error' as const,
          chapterImport: result,
        },
      });
      return;
    }

    navigate(ROUTES.ADMIN_BOOKS, { state: { notice } });
  };

  return (
    <>
      <AdminPageHeader
        title={isEdit ? 'Sửa sách' : 'Thêm sách'}
        crumbs={crumbs}
        actions={
          isEdit && book.data?.hasEbook ? (
            <Link to={ROUTES.ADMIN_BOOK_CHAPTERS(bookId)} className="btn btn--ghost">
              Quản lý chương
            </Link>
          ) : undefined
        }
      />
      <BookForm
        initial={book.data ?? undefined}
        authors={authors.data}
        categories={categories.data}
        publishers={publishers.data}
        onSubmit={submit}
        onCancel={backToList}
      />
    </>
  );
}
