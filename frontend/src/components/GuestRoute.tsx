import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { homeFor } from '../config/routes';

// Route dành cho khách (đăng nhập / đăng ký): đã đăng nhập rồi thì đưa về trang chủ theo vai trò.
export default function GuestRoute() {
  const { user } = useAuth();
  return user ? <Navigate to={homeFor(user.role)} replace /> : <Outlet />;
}
