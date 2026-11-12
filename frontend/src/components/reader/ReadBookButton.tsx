import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ROUTES } from '../../config/routes';
import { useAuth } from '../../context/AuthContext';
import type { Book } from '../../types';

// UC006 - nút "Đọc trực tuyến" ở trang chi tiết sách (UC006 bước 1-2). Chỉ hiện khi sách có bản e-book.
// Việc kiểm tra gói đọc còn hiệu lực do ReaderPage làm (API trả 403 thì hiện thông báo + dẫn tới trang Gói đọc), nên nút này không cần biết về gói.
export default function ReadBookButton({ book }: { book: Book }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  if (!book.hasEbook || user?.role === 'ADMIN') return null;

  return (
    <div className="read-action">
      {user ? (
        <Link to={ROUTES.READER(book.id)} className="btn btn--primary btn--lg">Đọc trực tuyến</Link>
      ) : (
        // Chưa đăng nhập: chuyển tới trang đăng nhập, xong quay lại đúng trang sách này
        <button type="button" className="btn btn--primary btn--lg" onClick={() => navigate(ROUTES.LOGIN, { state: { from: location } })}>
          Đăng nhập để đọc trực tuyến
        </button>
      )}
    </div>
  );
}
