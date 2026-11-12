import { Link } from 'react-router-dom';
import { BRAND_NAME } from '../../config/rules';
import { ROUTES } from '../../config/routes';
import { useStoreInfo } from '../../hooks/useStoreInfo';

export default function Footer() {
  // Hotline, địa chỉ, email lấy từ API (mock hoặc backend thật), xem services/storeservice.ts
  const info = useStoreInfo();

  // Nhãn và giá trị cùng một hàng; giá trị chỉ là chữ, không phải liên kết
  const rows = [
    { label: 'Hotline', value: info.hotline },
    { label: 'Địa chỉ', value: info.address },
    { label: 'Email', value: info.email },
  ].filter((r) => r.value);

  return (
    <footer className="footer">
      <div className="footer__inner container">
        <div>
          <p className="footer__brand">{BRAND_NAME}</p>
          <p className="footer__text">Mua sách giấy giao tận nhà và đọc e-book trực tuyến.</p>
        </div>

        <div aria-label="Thông tin liên hệ">
          <p className="footer__heading">Liên hệ </p>
          <ul className="footer__contact">
            {rows.map((r) => (
              <li key={r.label} className="footer__row">
                <span className="footer__label">{r.label}:</span>
                <span className="footer__value">{r.value}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <p className="footer__copy container">© {new Date().getFullYear()} {BRAND_NAME}. Sản phẩm học phần Phát triển phần mềm mã nguồn mở.</p>
    </footer>
  );
}
