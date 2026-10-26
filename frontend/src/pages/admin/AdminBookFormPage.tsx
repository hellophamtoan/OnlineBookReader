// UC007 - Thêm / Sửa sách (API-28, API-29; nạp dữ liệu bằng API-27 và danh mục API-14/18/22).
// Một trang cho cả hai chế độ: có :id trên URL = sửa, không có = thêm mới.
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
import type { AdminBookDetail, AdminBookPayload } from '../../types';
import { toMessage } from '../../utils/errors';

export default function AdminBookFormPage() {
  const idParam = useParams().id;
  const isEdit = idParam !== undefined;
  const bookId = Number(idParam);
  const validId = !isEdit || (Number.isInteger(bookId) && bookId >= 1);
  const navigate = useNavigate();
  useDocumentTitle(isEdit ? 'Sửa sách' : 'Thêm sách');

  const book = useAsync<AdminBookDetail | null>(
    () => (!isEdit ? Promise.resolve(null) : validId ? bookAdminService.get(bookId) : Promise.reject(new ApiError('Không tìm thấy sách', 404))),
    [idParam]
  );
  const authors = useAsync(() => taxonomyService.list('authors'), []);
  const categories = useAsync(() => taxonomyService.list('categories'), []);
  const publishers = useAsync(() => taxonomyService.list('publishers'), []);

  const crumbs = [{ label: 'Tổng quan', to: ROUTES.ADMIN_HOME }, { label: 'Sách & kho', to: ROUTES.ADMIN_BOOKS }, { label: isEdit ? 'Sửa sách' : 'Thêm sách' }];
  const backToList = () => navigate(ROUTES.ADMIN_BOOKS);

  const error = book.error ?? authors.error ?? categories.error ?? publishers.error;
  if (error) {
    const notFound = error instanceof ApiError && (error.status === 404 || error.status === 400);
    return (
      <>
        <AdminPageHeader title={isEdit ? 'Sửa sách' : 'Thêm sách'} crumbs={crumbs} />
        {notFound ? (
          <EmptyState title="Không tìm thấy sách" hint="Sách không tồn tại." action={<Link className="btn btn--ghost" to={ROUTES.ADMIN_BOOKS}>Về danh sách sách</Link>} />
        ) : (
          <ErrorState message={toMessage(error)} onRetry={() => { book.reload(); authors.reload(); categories.reload(); publishers.reload(); }} />
        )}
      </>
    );
  }

  if (book.data === null && isEdit) return <LoadingBlock label="Đang tải thông tin sách..." />;
  if (book.loading || !authors.data || !categories.data || !publishers.data) return <LoadingBlock label="Đang tải biểu mẫu..." />;

  // Luồng chính A2 / B2: lưu thành công -> về danh sách kèm thông báo (BookForm tự xử lý lỗi nhập liệu của BE)
  const submit = async (payload: AdminBookPayload) => {
    if (isEdit) {
      const saved = await bookAdminService.update(bookId, payload);
      navigate(ROUTES.ADMIN_BOOKS, { state: { notice: `Đã cập nhật sách "${saved.title}"` } });
    } else {
      const saved = await bookAdminService.create(payload);
      navigate(ROUTES.ADMIN_BOOKS, { state: { notice: `Đã thêm sách "${saved.title}"` } });
    }
  };

  return (
    <>
      <AdminPageHeader
        title={isEdit ? 'Sửa sách' : 'Thêm sách'}
        crumbs={crumbs}
        actions={isEdit && book.data?.hasEbook ? <Link to={ROUTES.ADMIN_BOOK_CHAPTERS(bookId)} className="btn btn--ghost">Quản lý chương</Link> : undefined}
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
