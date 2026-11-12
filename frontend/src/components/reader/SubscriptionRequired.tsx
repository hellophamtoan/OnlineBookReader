import { Link } from 'react-router-dom';
import { READER_MESSAGES } from '../../config/reader';
import { ROUTES } from '../../config/routes';
import { EmptyState } from '../common/States';

// UC006 luồng 3a: gói đọc hết hạn hoặc chưa đăng ký -> thông báo và dẫn tới trang "Gói đọc sách" (UC005)
export default function SubscriptionRequired({ bookId, message = READER_MESSAGES.subscriptionRequired }: { bookId: number; message?: string }) {
  return (
    <EmptyState
      title="Cần có gói đọc còn hiệu lực"
      hint={`${message} Hãy đăng ký hoặc gia hạn gói đọc để tiếp tục.`}
      action={
        <div className="reader-state__actions">
          <Link className="btn btn--primary" to={ROUTES.PLANS}>Xem gói đọc sách</Link>
          <Link className="btn btn--ghost" to={ROUTES.BOOK_DETAIL(bookId)}>Về trang sách</Link>
        </div>
      }
    />
  );
}
