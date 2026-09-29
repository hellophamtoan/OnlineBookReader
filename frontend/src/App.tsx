import { Route, Routes } from 'react-router-dom';
import HomePage from './pages/HomePage';
import NotFoundPage from './pages/NotFoundPage';
// import ProtectedRoute from './components/ProtectedRoute';

// Thêm trang mới: import page, rồi thêm <Route> tương ứng.
// Ví dụ trang chỉ Admin vào được:
//   <Route element={<ProtectedRoute roles={['ADMIN']} />}>
//     <Route path="/admin/books" element={<AdminBooksPage />} />
//   </Route>
function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export default App;
