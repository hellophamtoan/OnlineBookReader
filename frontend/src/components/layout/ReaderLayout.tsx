import { Outlet } from 'react-router-dom';

// [Giao diện] Bố cục tối giản cho trình đọc sách.
// UC006 - Khung của trình đọc: KHÔNG có Header/Footer của site để người đọc tập trung; thanh công cụ riêng nằm trong ReaderView.
export default function ReaderLayout() {
  return (
    <>
      <a href="#reader-main" className="skip-link">Bỏ qua, tới nội dung chương</a>
      <Outlet />
    </>
  );
}
