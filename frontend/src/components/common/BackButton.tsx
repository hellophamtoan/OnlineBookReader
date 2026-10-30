import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../../config/routes';

/** Nút mũi tên trở về trang trước; không có lịch sử thì về fallback (mặc định trang chủ). */
export default function BackButton({
  fallback = ROUTES.HOME,
  label = '← Trở về',
  className = '',
}: {
  fallback?: string;
  label?: string;
  className?: string;
}) {
  const navigate = useNavigate();

  const go = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate(fallback);
  };

  return (
    <button
      type="button"
      className={`btn btn--ghost page-back${className ? ` ${className}` : ''}`}
      onClick={go}
      aria-label="Trở về trang trước"
    >
      {label}
    </button>
  );
}
