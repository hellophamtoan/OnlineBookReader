import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BRAND_NAME } from '../../config/rules';
import { ROUTES } from '../../config/routes';

// Lấy ảnh logo trong src/assets: ưu tiên file có chữ "logo" trong tên (logo.png, logo.svg, Logo.jpg...);
// nếu không có chữ "logo" nhưng thư mục chỉ có đúng 1 ảnh thì dùng ảnh đó. Không có ảnh -> tự vẽ.
const IMAGES = Object.entries(
  import.meta.glob<string>('../../assets/*.{png,jpg,jpeg,webp,gif,svg}', { eager: true, query: '?url', import: 'default' })
);
const LOGO_SRC = (IMAGES.find(([path]) => /logo/i.test(path)) ?? (IMAGES.length === 1 ? IMAGES[0] : undefined))?.[1] ?? null;

export default function Logo() {
  const [failed, setFailed] = useState(false);

  return (
    <Link to={ROUTES.HOME} className="logo" aria-label={`${BRAND_NAME} - về trang chủ`}>
      {LOGO_SRC && !failed ? (
        // Chỉ dùng ảnh, nền trắng của ảnh được làm "tan" vào nền trang (xem .logo__img trong global.css)
        <img className="logo__img" src={LOGO_SRC} alt={BRAND_NAME} onError={() => setFailed(true)} />
      ) : (
        <>
          <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true">
            <rect x="3" y="6" width="6" height="20" rx="1.5" fill="#2F3182" />
            <rect x="11" y="3" width="6" height="23" rx="1.5" fill="#F2B632" />
            <rect x="19.2" y="7" width="6" height="19" rx="1.5" fill="#2F3182" transform="rotate(8 22 16)" />
          </svg>
          <span>{BRAND_NAME}</span>
        </>
      )}
    </Link>
  );
}