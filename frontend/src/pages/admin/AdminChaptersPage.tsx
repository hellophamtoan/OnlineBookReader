// UC007 - Danh sách chương e-book của một sách (API-31, API-35; thông tin sách từ API-27).
// Xóa chương là XÓA THẬT; BE trả 409 nếu đã có người dùng lưu tiến trình đọc ở chương đó -> hiện nguyên thông báo.
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import EpubChapterImportPanel from '../../components/admin/EpubChapterImportPanel';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import { EmptyState, ErrorState, LoadingBlock } from '../../components/common/States';
import { ROUTES } from '../../config/routes';
import { useAsync } from '../../hooks/useAsync';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useFlashNotice } from '../../hooks/useFlashNotice';
import { ApiError } from '../../services/api';
import { bookAdminService } from '../../services/admin/bookadminservice';
import { chapterAdminService } from '../../services/admin/chapteradminservice';
import type { ChapterSummary } from '../../types';
import { toMessage } from '../../utils/errors';

export default function AdminChaptersPage() {
  const bookId = Number(useParams().id);
  const validId = Number.isInteger(bookId) && bookId >= 1;
  useDocumentTitle('Chương e-book');

  const invalid = () => Promise.reject(new ApiError('Không tìm thấy sách', 404));
  const list = useAsync(() => (validId ? chapterAdminService.list(bookId) : invalid()), [bookId]);
  const book = useAsync(() => (validId ? bookAdminService.get(bookId) : invalid()), [bookId]);

  const [notice, setNotice, noticeTone, setNoticeTone] = useFlashNotice();
  const [error, setError] = useState('');
  const [removing, setRemoving] = useState<ChapterSummary | null>(null);
  const [busy, setBusy] = useState(false);

  const crumbs = [{ label: 'Tổng quan', to: ROUTES.ADMIN_HOME }, { label: 'Sách & kho', to: ROUTES.ADMIN_BOOKS }, { label: 'Chương e-book' }];
  const failure = list.error ?? book.error;
  if (failure) {
    const notFound = failure instanceof ApiError && (failure.status === 404 || failure.status === 400);
    return (
      <>
        <AdminPageHeader title="Chương e-book" crumbs={crumbs} />
        {notFound ? (
          <EmptyState title="Không tìm thấy sách" action={<Link className="btn btn--ghost" to={ROUTES.ADMIN_BOOKS}>Về danh sách sách</Link>} />
        ) : (
          <ErrorState message={toMessage(failure)} onRetry={() => { list.reload(); book.reload(); }} />
        )}
      </>
    );
  }
  if (!list.data || !book.data) return <LoadingBlock label="Đang tải danh sách chương..." />;

  const chapters = list.data.items;
  const hasEbook = book.data.hasEbook;

  const confirmRemove = async () => {
    if (!removing) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await chapterAdminService.remove(removing.id);
      setNotice(`Đã xóa "${removing.title}"`);
      list.reload();
    } catch (err) {
      setError(toMessage(err)); // vd. 409: chương đã có người lưu tiến trình đọc
    } finally {
      setBusy(false);
      setRemoving(null);
    }
  };

  return (
    <>
      <AdminPageHeader
        title={`Chương: ${list.data.book.title}`}
        subtitle="Nội dung chương là HTML đã được làm sạch. Người đọc chỉ tải từng chương một."
        crumbs={crumbs}
        actions={
          hasEbook ? (
            <Link to={ROUTES.ADMIN_CHAPTER_NEW(bookId)} className="btn btn--primary">Thêm chương</Link>
          ) : (
            <Link to={ROUTES.ADMIN_BOOK_EDIT(bookId)} className="btn btn--ghost">Bật hình thức e-book</Link>
          )
        }
      />

      {!hasEbook && <div className="alert alert--error admin-alert" role="alert">Sách này chưa bật hình thức e-book nên không thể thêm chương. Hãy bật e-book trong trang sửa sách.</div>}
      {notice && (
        <div
          className={`alert admin-alert ${noticeTone === 'error' ? 'alert--error' : noticeTone === 'warning' ? 'alert--error' : 'alert--success'}`}
          role={noticeTone === 'error' ? 'alert' : 'status'}
        >
          {notice}
        </div>
      )}
      {error && <div className="alert alert--error admin-alert" role="alert">{error}</div>}

      {hasEbook && (
        <EpubChapterImportPanel
          bookId={bookId}
          existing={chapters}
          disabled={busy}
          onDone={() => list.reload()}
          onNotice={(message, tone) => {
            setNotice(message);
            setNoticeTone(tone === 'error' ? 'error' : 'success');
            setError('');
          }}
        />
      )}

      {chapters.length === 0 ? (
        <EmptyState title="Sách chưa có chương nào" hint={hasEbook ? 'Bấm "Thêm chương" để tạo chương đầu tiên.' : undefined} />
      ) : (
        <div className={`table-wrap${list.loading ? ' is-loading' : ''}`}>
          <table className="table table--chapters">
            <thead>
              <tr>
                <th scope="col" className="table__num">Số chương</th>
                <th scope="col" className="table__title-col">Tiêu đề</th>
                <th scope="col" className="table__actions-col">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {chapters.map((c) => (
                <tr key={c.id}>
                  <td className="table__num">{c.chapterNumber}</td>
                  <td className="table__strong table__title-col">{c.title}</td>
                  <td className="table__actions">
                    <Link to={ROUTES.ADMIN_CHAPTER_EDIT(bookId, c.id)} className="btn btn--ghost">Sửa</Link>
                    <button type="button" className="btn btn--ghost btn--danger" onClick={() => setRemoving(c)}>Xóa</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={removing !== null}
        title="Xóa chương này?"
        message={`"${removing?.title ?? ''}" sẽ bị xóa vĩnh viễn và không thể hoàn tác. Nếu đã có người dùng lưu tiến trình đọc ở chương này, hệ thống sẽ không cho xóa.`}
        confirmLabel="Xóa chương"
        cancelLabel="Giữ lại"
        busy={busy}
        onConfirm={confirmRemove}
        onCancel={() => setRemoving(null)}
      />
    </>
  );
}
