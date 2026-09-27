import { useState } from 'react';

// Khung dieu huong don gian bang state, giong cach App.tsx cua du an phong kham.
// Sau nay them page nao thi import va them 1 nhanh case o day.

type PageName = 'home';

function App() {
  const [currentPage] = useState<PageName>('home');

  return (
    <div>
      {currentPage === 'home' && <h1>Online Book Reader - Trang chu (dang xay dung)</h1>}
    </div>
  );
}

export default App;
