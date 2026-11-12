import { Link } from 'react-router-dom';
import { EmptyState } from '../components/common/States';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { ROUTES } from '../config/routes';

export default function NotFoundPage() {
  useDocumentTitle('Không tìm thấy trang');
  return (
    <div className="container page">
      <EmptyState title="Không tìm thấy trang" hint="Đường dẫn có thể đã đổi hoặc không tồn tại." action={<Link className="btn btn--primary" to={ROUTES.HOME}>Về trang chủ</Link>} />
    </div>
  );
}
