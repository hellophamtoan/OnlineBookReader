import type { Book } from '../../types';
import { isPhysical } from '../../utils/book';
import ReadBookButton from '../reader/ReadBookButton';

// Đã gỡ UC004 (giỏ hàng / đặt mua). Chỉ còn nút đọc e-book và ghi chú sách giấy (nếu có).
export default function BookActions({ book, hideRead = false }: { book: Book; hideRead?: boolean }) {
  return (
    <>
      {isPhysical(book) && (
        <p className="detail__note">
          Sách có bản giấy (chức năng đặt mua nằm ngoài phạm vi hợp đồng hiện tại UC001–UC003).
        </p>
      )}
      {!hideRead && <ReadBookButton book={book} />}
    </>
  );
}
