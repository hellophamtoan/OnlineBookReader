import { Route, Routes } from 'react-router-dom';
import MainLayout from './components/layout/MainLayout';
import AdminLayout from './components/layout/AdminLayout';
import ProtectedRoute from './components/ProtectedRoute';
import MockBadge from './components/common/MockBadge';
import HomePage from './pages/HomePage';
import BooksPage from './pages/BooksPage';
import BookDetailPage from './pages/BookDetailPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import NotFoundPage from './pages/NotFoundPage';
import ReaderPage from './pages/ReaderPage';
import ProfilePage from './pages/ProfilePage';
import LibraryPage from './pages/LibraryPage';
import CartPage from './pages/CartPage';
import CheckoutPage from './pages/CheckoutPage';
import MyOrdersPage from './pages/MyOrdersPage';
import OrderDetailPage from './pages/OrderDetailPage';
import PlansPage from './pages/PlansPage';
import AdminHomePage from './pages/admin/AdminHomePage';
import AdminBooksPage from './pages/admin/AdminBooksPage';
import AdminBookDetailPage from './pages/admin/AdminBookDetailPage';
import AdminBookFormPage from './pages/admin/AdminBookFormPage';
import AdminChaptersPage from './pages/admin/AdminChaptersPage';
import AdminChapterFormPage from './pages/admin/AdminChapterFormPage';
import AdminTaxonomyPage from './pages/admin/AdminTaxonomyPage';
import AdminPlansPage from './pages/admin/AdminPlansPage';
import { ROUTES, ROUTE_PATTERNS } from './config/routes';

/** UC001–UC008 + UC012 + UC013 (FE mock độc lập BE) */
function App() {
  return (
    <>
      <Routes>
        <Route element={<MainLayout />}>
          <Route path={ROUTES.HOME} element={<HomePage />} />
          <Route path={ROUTES.BOOKS} element={<BooksPage />} />
          <Route path={ROUTE_PATTERNS.BOOK_DETAIL} element={<BookDetailPage />} />
          <Route path={ROUTES.PLANS} element={<PlansPage />} />

          <Route element={<ProtectedRoute roles={['USER']} />}>
            <Route path={ROUTES.LIBRARY} element={<LibraryPage />} />
            <Route path={ROUTES.CART} element={<CartPage />} />
            <Route path={ROUTES.CHECKOUT} element={<CheckoutPage />} />
            <Route path={ROUTES.ORDERS} element={<MyOrdersPage />} />
            <Route path={ROUTE_PATTERNS.ORDER_DETAIL} element={<OrderDetailPage />} />
          </Route>

          <Route element={<ProtectedRoute roles={['USER', 'ADMIN']} />}>
            <Route path={ROUTE_PATTERNS.READER} element={<ReaderPage />} />
          </Route>

          <Route element={<ProtectedRoute />}>
            <Route path={ROUTES.PROFILE} element={<ProfilePage />} />
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Route>

        <Route element={<ProtectedRoute roles={['ADMIN']} />}>
          <Route element={<AdminLayout />}>
            <Route path={ROUTES.ADMIN_HOME} element={<AdminHomePage />} />
            <Route path={ROUTES.ADMIN_PROFILE} element={<ProfilePage variant="admin" />} />
            <Route path={ROUTES.ADMIN_BOOKS} element={<AdminBooksPage />} />
            <Route path={ROUTES.ADMIN_BOOK_NEW} element={<AdminBookFormPage />} />
            <Route path={ROUTE_PATTERNS.ADMIN_BOOK_EDIT} element={<AdminBookFormPage />} />
            <Route path={ROUTE_PATTERNS.ADMIN_BOOK_DETAIL} element={<AdminBookDetailPage />} />
            <Route path={ROUTE_PATTERNS.ADMIN_BOOK_CHAPTERS} element={<AdminChaptersPage />} />
            <Route path={ROUTE_PATTERNS.ADMIN_CHAPTER_NEW} element={<AdminChapterFormPage />} />
            <Route path={ROUTE_PATTERNS.ADMIN_CHAPTER_EDIT} element={<AdminChapterFormPage />} />
            <Route path={ROUTES.ADMIN_CATEGORIES} element={<AdminTaxonomyPage key="categories" kind="categories" />} />
            <Route path={ROUTES.ADMIN_AUTHORS} element={<AdminTaxonomyPage key="authors" kind="authors" />} />
            <Route path={ROUTES.ADMIN_PUBLISHERS} element={<AdminTaxonomyPage key="publishers" kind="publishers" />} />
            <Route path={ROUTES.ADMIN_PLANS} element={<AdminPlansPage />} />
            <Route path="/admin/*" element={<NotFoundPage />} />
          </Route>
        </Route>

        <Route path={ROUTES.LOGIN} element={<LoginPage />} />
        <Route path={ROUTES.REGISTER} element={<RegisterPage />} />
      </Routes>
      <MockBadge />
    </>
  );
}

export default App;
