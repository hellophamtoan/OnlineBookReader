import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Header from './Header';
import Footer from './Footer';

// [Xử lý] Cuộn lên đầu trang mỗi khi đổi trang.
// Đổi trang thì cuộn về đầu
function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}

// [Giao diện] Bố cục trang người dùng: Header + nội dung + Footer.
// Khung chung của các trang công khai / thành viên: Header + nội dung + Footer.
// Nút trở về chỉ hiện cùng hàng với «Xem trang bán sách» (khu admin).
export default function MainLayout() {
  return (
    <>
      <a href="#main" className="skip-link">
        Bỏ qua, tới nội dung chính
      </a>
      <ScrollToTop />
      <Header />
      <main id="main" className="main">
        <Outlet />
      </main>
      <Footer />
    </>
  );
}
