import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Header from './Header';
import Footer from './Footer';

// Đổi trang thì cuộn về đầu
function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}

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
