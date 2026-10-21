import { Route, Routes } from 'react-router-dom';
import MainLayout from './components/layout/MainLayout';
import GuestRoute from './components/GuestRoute';
import MockBadge from './components/common/MockBadge';
import HomePage from './pages/HomePage';
import BooksPage from './pages/BooksPage';
import BookDetailPage from './pages/BookDetailPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import NotFoundPage from './pages/NotFoundPage';
import { ROUTES, ROUTE_PATTERNS } from './config/routes';
// import ProtectedRoute from './components/ProtectedRoute';

// Thêm trang mới: tạo page trong pages/, thêm đường dẫn vào config/routes.ts, rồi thêm <Route> tại đây.
// Trang cần đăng nhập / chỉ Admin (UC004+):
//   <Route element={<ProtectedRoute />}>                    <Route path={ROUTES.CART} element={<CartPage />} /> </Route>
//   <Route element={<ProtectedRoute roles={['ADMIN']} />}>  <Route path="/admin/..." element={<AdminLayout />}> ... </Route> </Route>
function App() {
  return (
    <>
      <Routes>
        {/* Trang công khai dùng chung Header/Footer */}
        <Route element={<MainLayout />}>
          <Route path={ROUTES.HOME} element={<HomePage />} />
          <Route path={ROUTES.BOOKS} element={<BooksPage />} />
          <Route path={ROUTE_PATTERNS.BOOK_DETAIL} element={<BookDetailPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>

        {/* Đăng nhập / đăng ký: khung riêng, đã đăng nhập thì bị đưa về trang chủ */}
        <Route element={<GuestRoute />}>
          <Route path={ROUTES.LOGIN} element={<LoginPage />} />
          <Route path={ROUTES.REGISTER} element={<RegisterPage />} />
        </Route>
      </Routes>
      <MockBadge />
    </>
  );
}

export default App;
