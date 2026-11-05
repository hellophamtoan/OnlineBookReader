// UC001–UC013 — route FE; lazy load trang để giảm bundle ban đầu
import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import MainLayout from './components/layout/MainLayout';
import AdminLayout from './components/layout/AdminLayout';
import ProtectedRoute from './components/ProtectedRoute';
import MockBadge from './components/common/MockBadge';
import { LoadingBlock } from './components/common/States';
import { ROUTES, ROUTE_PATTERNS } from './config/routes';

const HomePage = lazy(() => import('./pages/HomePage'));
const BooksPage = lazy(() => import('./pages/BooksPage'));
const BookDetailPage = lazy(() => import('./pages/BookDetailPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));
const ReaderPage = lazy(() => import('./pages/ReaderPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const LibraryPage = lazy(() => import('./pages/LibraryPage'));
const CartPage = lazy(() => import('./pages/CartPage'));
const CheckoutPage = lazy(() => import('./pages/CheckoutPage'));
const MyOrdersPage = lazy(() => import('./pages/MyOrdersPage'));
const OrderDetailPage = lazy(() => import('./pages/OrderDetailPage'));
const PlansPage = lazy(() => import('./pages/PlansPage'));
const WalletTopupPage = lazy(() => import('./pages/WalletTopupPage'));
const WalletTopupReturnPage = lazy(() => import('./pages/WalletTopupReturnPage'));

const AdminHomePage = lazy(() => import('./pages/admin/AdminHomePage'));
const AdminBooksPage = lazy(() => import('./pages/admin/AdminBooksPage'));
const AdminBookDetailPage = lazy(() => import('./pages/admin/AdminBookDetailPage'));
const AdminBookFormPage = lazy(() => import('./pages/admin/AdminBookFormPage'));
const AdminChaptersPage = lazy(() => import('./pages/admin/AdminChaptersPage'));
const AdminChapterFormPage = lazy(() => import('./pages/admin/AdminChapterFormPage'));
const AdminTaxonomyPage = lazy(() => import('./pages/admin/AdminTaxonomyPage'));
const AdminPlansPage = lazy(() => import('./pages/admin/AdminPlansPage'));
const AdminOrdersPage = lazy(() => import('./pages/admin/AdminOrdersPage'));
const AdminOrderDetailPage = lazy(() => import('./pages/admin/AdminOrderDetailPage'));
const AdminUsersPage = lazy(() => import('./pages/admin/AdminUsersPage'));
const AdminUserDetailPage = lazy(() => import('./pages/admin/AdminUserDetailPage'));
const AdminReportsPage = lazy(() => import('./pages/admin/AdminReportsPage'));

function FallBack() {
  return (
    <div className="container page" style={{ paddingTop: 48 }}>
      <LoadingBlock label="Đang tải trang..." />
    </div>
  );
}

export default function App() {
  return (
    <>
      <Suspense fallback={<FallBack />}>
        <Routes>
          <Route element={<MainLayout />}>
            <Route index element={<HomePage />} />
            <Route path={ROUTES.BOOKS} element={<BooksPage />} />
            <Route path={ROUTE_PATTERNS.BOOK_DETAIL} element={<BookDetailPage />} />
            <Route path={ROUTES.PLANS} element={<PlansPage />} />

            <Route element={<ProtectedRoute roles={['USER']} />}>
              <Route path={ROUTES.LIBRARY} element={<LibraryPage />} />
              <Route path={ROUTES.CART} element={<CartPage />} />
              <Route path={ROUTES.CHECKOUT} element={<CheckoutPage />} />
              <Route path={ROUTES.WALLET_TOPUP} element={<WalletTopupPage />} />
              <Route path={ROUTES.WALLET_TOPUP_RETURN} element={<WalletTopupReturnPage />} />
              <Route path={ROUTES.MY_ORDERS} element={<MyOrdersPage />} />
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
              <Route path={ROUTES.ADMIN_ORDERS} element={<AdminOrdersPage />} />
              <Route path={ROUTE_PATTERNS.ADMIN_ORDER_DETAIL} element={<AdminOrderDetailPage />} />
              <Route path={ROUTES.ADMIN_USERS} element={<AdminUsersPage />} />
              <Route path={ROUTE_PATTERNS.ADMIN_USER_DETAIL} element={<AdminUserDetailPage />} />
              <Route path={ROUTES.ADMIN_REPORTS} element={<AdminReportsPage />} />
              <Route path="/admin/*" element={<NotFoundPage />} />
            </Route>
          </Route>

          <Route path={ROUTES.LOGIN} element={<LoginPage />} />
          <Route path={ROUTES.REGISTER} element={<RegisterPage />} />
        </Routes>
      </Suspense>
      <MockBadge />
    </>
  );
}
