import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { Role } from '../context/AuthContext';
import { ROUTES } from '../config/routes';

interface Props {
  // Bỏ trống = chỉ cần đăng nhập; truyền ['ADMIN'] = chỉ Admin
  roles?: Role[];
}

// Dùng làm route cha: <Route element={<ProtectedRoute roles={['ADMIN']} />}> ...các route con... </Route>
// Lưu ý: đây chỉ là lớp giao diện, quyền thật sự luôn do backend kiểm tra.
export default function ProtectedRoute({ roles }: Props) {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) {
    return <Navigate to={ROUTES.LOGIN} replace state={{ from: location }} />;
  }
  if (roles && !roles.includes(user.role)) {
    return <Navigate to={ROUTES.HOME} replace />;
  }
  return <Outlet />;
}
