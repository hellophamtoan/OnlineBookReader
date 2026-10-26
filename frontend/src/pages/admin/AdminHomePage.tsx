// Trang Tổng quan khu quản trị: số liệu nhanh + lối tắt tới các mục menu.
import { Link } from 'react-router-dom';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import { EmptyState, ErrorState, LoadingBlock } from '../../components/common/States';
import { ADMIN_NAV_GROUPS } from '../../config/admin';
import { useAuth } from '../../context/AuthContext';
import { useAsync } from '../../hooks/useAsync';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { bookAdminService } from '../../services/admin/bookadminservice';
import { taxonomyService } from '../../services/admin/taxonomyservice';
import { toMessage } from '../../utils/errors';

export default function AdminHomePage() {
  useDocumentTitle('Quản trị');
  const { user } = useAuth();
  const items = ADMIN_NAV_GROUPS.flatMap((g) => g.items).filter((i) => i.desc);

  const books = useAsync(() => bookAdminService.list({ limit: 100, page: 1 }), []);
  const authors = useAsync(() => taxonomyService.list('authors'), []);
  const categories = useAsync(() => taxonomyService.list('categories'), []);
  const publishers = useAsync(() => taxonomyService.list('publishers'), []);

  const loading = books.loading || authors.loading || categories.loading || publishers.loading;
  const error = books.error || authors.error || categories.error || publishers.error;

  const bookItems = books.data?.items ?? [];
  // 👇 Đã khắc phục lỗi: dùng totalElements / count hoặc fallback về bookItems.length
  const totalBooks = (books.data as any)?.totalElements ?? (books.data as any)?.count ?? bookItems.length;
  
  const activeBooks = bookItems.filter((b) => b.status === 'active').length;
  const ebookBooks = bookItems.filter((b) => b.hasEbook).length;
  const physicalBooks = bookItems.filter((b) => b.hasPhysical).length;
  const outOfStock = bookItems.filter((b) => b.hasPhysical && (b.stock ?? 0) <= 0).length;
  const totalAuthors = authors.data?.length ?? 0;
  const totalCategories = categories.data?.length ?? 0;
  const totalPublishers = publishers.data?.length ?? 0;

  return (
    <>
      <AdminPageHeader
        title="Tổng quan"
        subtitle={`Xin chào ${user?.fullName ?? 'quản trị viên'}. Chọn một mục để bắt đầu.`}
      />

      {error && (
        <ErrorState
          message={toMessage(error)}
          onRetry={() => {
            books.reload();
            authors.reload();
            categories.reload();
            publishers.reload();
          }}
        />
      )}

      {loading && !books.data ? (
        <LoadingBlock label="Đang tải số liệu..." />
      ) : (
        <div className="admin-stats" aria-label="Thống kê nhanh">
          <div className="admin-stat">
            <span className="admin-stat__value">{totalBooks}</span>
            <span className="admin-stat__label">Tổng số sách</span>
          </div>
          <div className="admin-stat">
            <span className="admin-stat__value">{activeBooks}</span>
            <span className="admin-stat__label">Sách đang hoạt động</span>
          </div>
          <div className="admin-stat">
            <span className="admin-stat__value">{ebookBooks}</span>
            <span className="admin-stat__label">Sách có e-book</span>
          </div>
          <div className="admin-stat">
            <span className="admin-stat__value">{physicalBooks}</span>
            <span className="admin-stat__label">Sách có bản giấy</span>
          </div>
          <div className="admin-stat">
            <span className="admin-stat__value">{outOfStock}</span>
            <span className="admin-stat__label">Sách giấy hết hàng</span>
          </div>
          <div className="admin-stat">
            <span className="admin-stat__value">{totalAuthors}</span>
            <span className="admin-stat__label">Tác giả</span>
          </div>
          <div className="admin-stat">
            <span className="admin-stat__value">{totalCategories}</span>
            <span className="admin-stat__label">Thể loại</span>
          </div>
          <div className="admin-stat">
            <span className="admin-stat__value">{totalPublishers}</span>
            <span className="admin-stat__label">Nhà xuất bản</span>
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <EmptyState title="Chưa có mục quản trị" hint="Thêm mục vào config/admin.ts để hiện lối tắt." />
      ) : (
        <ul className="admin-cards">
          {items.map((i) => (
            <li key={i.to}>
              <Link to={i.to} className="admin-card">
                <span className="admin-card__title">{i.label}</span>
                <span className="admin-card__desc">{i.desc}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}