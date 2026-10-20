import { Link } from 'react-router-dom';
import { BRAND_NAME } from '../../config/rules';
import { ROUTES } from '../../config/routes';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer__inner container">
        <div>
          <p className="footer__brand">{BRAND_NAME}</p>
          <p className="footer__text">Mua sách giấy giao tận nhà và đọc e-book trực tuyến.</p>
        </div>
        <nav className="footer__links" aria-label="Liên kết nhanh">
          <Link to={ROUTES.HOME}>Trang chủ</Link>
          <Link to={ROUTES.BOOKS}>Tất cả sách</Link>
        </nav>
      </div>
      <p className="footer__copy container">© {new Date().getFullYear()} {BRAND_NAME}. Sản phẩm học phần Phát triển phần mềm mã nguồn mở.</p>
    </footer>
  );
}
