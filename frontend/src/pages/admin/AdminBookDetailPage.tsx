import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import EntityStatusBadge from '../../components/admin/EntityStatusBadge';
import BookCover from '../../components/book/BookCover';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import { EmptyState, ErrorState, LoadingBlock } from '../../components/common/States';
import { ROUTES } from '../../config/routes';
import { useAsync } from '../../hooks/useAsync';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { ApiError } from '../../services/api';
import { bookAdminService } from '../../services/admin/bookadminservice';
import { chapterAdminService } from '../../services/admin/chapteradminservice';
import { formatDate, formatPrice } from '../../utils/format';
import { toMessage } from '../../utils/errors';
import { withTocDisplayOrder } from '../../utils/chapterMeta';
import { sanitizeChapterHtml } from '../../utils/sanitize';

export default function AdminBookDetailPage() {
  const id = Number(useParams().id);
  const valid = Number.isInteger(id) && id >= 1;
  const navigate = useNavigate();
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmOff, setConfirmOff] = useState(false);
  const [previewChapterId, setPreviewChapterId] = useState<number | null>(null);

  const book = useAsync(() => (valid ? bookAdminService.get(id) : Promise.reject(new ApiError('Không tìm thấy', 404))), [id]);
  const chapters = useAsync(
    () => (valid && book.data?.hasEbook ? chapterAdminService.list(id) : Promise.resolve(null)),
    [id, book.data?.hasEbook],
  );
  const preview = useAsync(
    () => (previewChapterId ? chapterAdminService.get(previewChapterId) : Promise.resolve(null)),
    [previewChapterId],
  );

  useDocumentTitle(book.data ? `Admin · ${book.data.title}` : 'Chi tiết sách');

  if (book.loading && !book.data) return <LoadingBlock label="Đang tải sách..." />;
  if (book.error || !book.data) {
    const nf = book.error instanceof ApiError && (book.error.status === 404 || book.error.status === 400);
    return nf ? (
      <EmptyState title="Không tìm thấy sách" action={<Link className="btn btn--ghost" to={ROUTES.ADMIN_BOOKS}>Quay lại danh sách</Link>} />
    ) : (
      <ErrorState message={toMessage(book.error)} onRetry={book.reload} />
    );
  }

  const b = book.data;
  const runStatus = async (activate: boolean) => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      if (activate) {
        await bookAdminService.activate(b.id);
        setNotice('Đã kích hoạt lại sách');
      } else {
        await bookAdminService.deactivate(b.id);
        setNotice('Đã chuyển sang ngừng hoạt động');
        setConfirmOff(false);
      }
      book.reload();
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <AdminPageHeader
        title={b.title}
        subtitle="Chi tiết sách quản trị — thông tin, chương, thao tác"
        crumbs={[
          { label: 'Tổng quan', to: ROUTES.ADMIN_HOME },
          { label: 'Sách & kho', to: ROUTES.ADMIN_BOOKS },
          { label: b.title },
        ]}
      />

      {notice && (
        <div className="alert alert--success admin-alert" role="status">
          {notice}
        </div>
      )}
      {error && (
        <div className="alert alert--error admin-alert" role="alert">
          {error}
        </div>
      )}

      <article className="detail admin-book-detail">
        <div className="detail__cover-col">
          <BookCover
            book={{ id: b.id, title: b.title, coverUrl: b.coverUrl, authors: b.authors }}
            className="detail__cover"
            enableZoom
          />
          <EntityStatusBadge status={b.status} />
        </div>
        <div className="detail__info">
          <h2 className="detail__heading">Thông tin</h2>
          <dl className="detail__meta">
            <dt>Tác giả</dt>
            <dd>{b.authors.map((a) => a.name).join(', ') || '—'}</dd>
            <dt>Thể loại</dt>
            <dd>{b.categories.map((c) => c.name).join(', ') || '—'}</dd>
            <dt>NXB (id)</dt>
            <dd>{b.publisherId ?? '—'}</dd>
            <dt>Hình thức</dt>
            <dd>
              {[b.hasPhysical && 'Sách giấy', b.hasEbook && 'E-book'].filter(Boolean).join(', ') || '—'}
            </dd>
            {b.hasPhysical && (
              <>
                <dt>Giá</dt>
                <dd>{b.price !== null ? formatPrice(b.price) : '—'}</dd>
                <dt>Tồn kho</dt>
                <dd>{b.stock}</dd>
              </>
            )}
            <dt>Cập nhật</dt>
            <dd>{b.updatedAt ? formatDate(b.updatedAt) : '—'}</dd>
          </dl>

          <section>
            <h2 className="detail__heading">Giới thiệu</h2>
            <p className="detail__desc">{b.description || 'Chưa có mô tả.'}</p>
          </section>

          {/* Dưới phần giới thiệu — cùng kiểu «Đọc trực tuyến» phía user */}
          <div className="detail__read-block admin-book-actions-row" role="group" aria-label="Thao tác sách">
            <div className="read-action admin-book-actions">
              <Link to={ROUTES.ADMIN_BOOK_EDIT(b.id)} className="btn btn--primary btn--lg">
                Sửa
              </Link>
              {b.hasEbook && (
                <Link to={ROUTES.ADMIN_BOOK_CHAPTERS(b.id)} className="btn btn--ghost btn--lg">
                  Chương (viết)
                </Link>
              )}
              {b.status === 'active' ? (
                <button
                  type="button"
                  className="btn btn--ghost btn--lg btn--danger"
                  disabled={busy}
                  onClick={() => setConfirmOff(true)}
                >
                  Ngừng hoạt động
                </button>
              ) : (
                <button type="button" className="btn btn--ghost btn--lg" disabled={busy} onClick={() => runStatus(true)}>
                  Kích hoạt lại
                </button>
              )}
            </div>
          </div>
        </div>
      </article>

      {b.hasEbook && (
        <section className="admin-book-chapters book-toc-panel" style={{ marginTop: 28 }}>
          <div className="book-toc-panel__head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <h2 className="book-toc-panel__title">Mục lục chương</h2>
            <div style={{ display: 'flex', gap: 8 }}>
              <Link className="btn btn--ghost btn--sm" to={ROUTES.ADMIN_BOOK_CHAPTERS(b.id)}>
                Quản lý / viết chương
              </Link>
              <Link className="btn btn--primary btn--sm" to={ROUTES.ADMIN_CHAPTER_NEW(b.id)}>
                Thêm chương
              </Link>
            </div>
          </div>
          {chapters.loading && !chapters.data ? (
            <p className="field__hint">Đang tải mục lục...</p>
          ) : chapters.error ? (
            <ErrorState message={toMessage(chapters.error)} onRetry={chapters.reload} />
          ) : !chapters.data?.items.length ? (
            <p className="field__hint">Chưa có chương. Bấm «Thêm chương» hoặc «Quản lý / viết chương».</p>
          ) : (
            <ol className="book-toc-panel__list">
              {withTocDisplayOrder(chapters.data.items).map((c) => {
                // Chỉ mục tính chương mới có «Chương N»; phần phụ chỉ tiêu đề
                const pack =
                  c.displayChapter != null &&
                  (c.isFree === false ||
                    (c.isFree !== true && c.displayChapter > (chapters.data?.freeChapterLimit ?? 10)));
                return (
                  <li key={c.id} className="book-toc-panel__item is-unread">
                    <div className="book-toc-panel__row">
                      <Link
                        to={`${ROUTES.READER(b.id)}?chapter=${c.chapterNumber}`}
                        className="book-toc-panel__link"
                      >
                        <span className="book-toc-panel__text">{c.label}</span>
                        {pack ? <span className="toc-lock" aria-label="Chương cần gói đọc">🔒</span> : null}
                      </Link>
                      <button
                        type="button"
                        className="btn btn--ghost btn--sm book-toc-panel__preview"
                        onClick={() => setPreviewChapterId(c.id)}
                      >
                        Xem nhanh
                      </button>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      )}

      {/* Xem trước nội dung chương (dạng đọc) */}
      {previewChapterId !== null && (
        <div className="overlay" role="dialog" aria-modal="true" aria-label="Xem chương">
          <div className="modal admin-chapter-preview" style={{ maxWidth: 720, maxHeight: '90vh', overflow: 'auto', background: 'var(--surface)', borderRadius: 12, padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
              <h3 style={{ margin: 0 }}>{preview.data ? `Chương ${preview.data.chapterNumber}. ${preview.data.title}` : 'Đang tải...'}</h3>
              <div style={{ display: 'flex', gap: 8 }}>
                {preview.data && (
                  <Link className="btn btn--primary btn--sm" to={ROUTES.ADMIN_CHAPTER_EDIT(b.id, preview.data.id)}>
                    Sửa (viết)
                  </Link>
                )}
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => setPreviewChapterId(null)}>
                  Đóng
                </button>
              </div>
            </div>
            {preview.loading && !preview.data && <LoadingBlock label="Đang tải nội dung..." />}
            {preview.error != null && (<ErrorState message={toMessage(preview.error)}onRetry={preview.reload}/>)}
            {preview.data && (
              <div className="prose" dangerouslySetInnerHTML={{ __html: sanitizeChapterHtml(preview.data.content) }} />
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmOff}
        title="Ngừng hoạt động sách này?"
        message={`"${b.title}" sẽ bị ẩn khỏi trang bán. Có thể kích hoạt lại sau.`}
        confirmLabel="Ngừng hoạt động"
        cancelLabel="Hủy"
        busy={busy}
        onConfirm={() => runStatus(false)}
        onCancel={() => setConfirmOff(false)}
      />
    </>
  );
}
