// services/endpoints.ts
// Toàn bộ đường dẫn API ở một chỗ. Khớp hợp đồng:
//   - UC001–UC003: API-01..API-07 (Hop_dong_API_OnlineBookReader_UC001_UC003.xlsx)
//   - UC006 / UC007 / UC012: API-08..API-35 (API_Tuan2_OnlineBookReader.xlsx)
// Base URL đã gồm /api (config/env.ts). Path dưới đây KHÔNG lặp /api.
export const ENDPOINTS = {
  // ----- UC001 / UC002 -----
  auth: {
    register: '/auth/register', // API-01 POST
    login: '/auth/login', // API-02 POST
    me: '/auth/me', // API-03 GET
    logout: '/auth/logout', // API-04 POST
  },

  // ----- UC003 -----
  books: {
    list: '/books', // API-05 GET
    detail: (id: number) => `/books/${id}`, // API-06 GET
  },
  categories: '/categories', // API-07 GET
  // Mở rộng (chưa trong hợp đồng UC001–UC003): FE bắt 404 và ẩn bộ lọc tương ứng
  authors: '/authors',
  publishers: '/publishers',
  storeInfo: '/store-info',

  // ----- Các API thương mại/yêu thích dành cho FE UC004: BE hiện tại có thể chưa hỗ trợ.
  // Chỉ phục hồi type/đường dẫn; KHÔNG tuyên bố backend đã triển khai.
  cart: {
    root: '/cart',
    item: (bookId: number) => `/cart/${bookId}`,
  },
  orders: {
    root: '/orders',
    my: '/orders/my',
    detail: (id: number) => `/orders/${id}`,
    cancel: (id: number) => `/orders/${id}/cancel`,
  },
  favorites: {
    root: '/favorites',
    toggle: (bookId: number) => `/favorites/${bookId}/toggle`,
    status: (bookId: number) => `/favorites/${bookId}/status`,
  },

  // ----- UC012 -----
  users: {
    me: '/users/me', // API-08 GET | API-09 PUT
  },

  // ----- UC006 -----
  reading: {
    chapters: (bookId: number) => `/books/${bookId}/chapters`, // API-10
    chapter: (bookId: number, chapterNumber: number) => `/books/${bookId}/chapters/${chapterNumber}`, // API-11
    progress: (bookId: number) => `/reading/progress/${bookId}`, // API-12 GET | API-13 PUT
  },

  // ----- UC007 (ADMIN) -----
  admin: {
    taxonomy: {
      categories: '/admin/categories', // API-14..17
      authors: '/admin/authors', // API-18..21
      publishers: '/admin/publishers', // API-22..25
    },
    taxonomyItem: (kind: 'categories' | 'authors' | 'publishers', id: number) => `/admin/${kind}/${id}`,
    books: {
      root: '/admin/books', // API-26 GET | API-28 POST
      detail: (id: number) => `/admin/books/${id}`, // API-27 GET | API-29 PUT | API-30 DELETE
      chapters: (bookId: number) => `/admin/books/${bookId}/chapters`, // API-31 GET | API-32 POST
    },
    chapter: (id: number) => `/admin/chapters/${id}`, // API-33 GET | API-34 PUT | API-35 DELETE
  },

  // ----- Ngoài hợp đồng (chỉ mock / BE chưa có thì 404 êm) -----
  library: {
    root: '/library',
    reading: '/library/reading',
    item: (bookId: number) => `/library/${bookId}`,
    status: (bookId: number) => `/library/${bookId}/status`,
  },
} as const;
