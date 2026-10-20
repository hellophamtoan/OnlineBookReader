import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div>
      <h1>404 - Không tìm thấy trang</h1>
      <Link to="/">Về trang chủ</Link>
    </div>
  );
}
