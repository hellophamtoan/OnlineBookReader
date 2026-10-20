// services/endpoints.ts
// Toàn bộ đường dẫn API ở một chỗ. BE đổi đường dẫn -> chỉ sửa file này.
export const ENDPOINTS = {
  auth: {
    register: '/auth/register', // API-01
    login: '/auth/login', // API-02
    me: '/auth/me', // API-03
    logout: '/auth/logout', // API-04
  },
  books: {
    list: '/books', // API-05
    detail: (id: number) => `/books/${id}`, // API-06
  },
  categories: '/categories', // API-07
  authors: '/authors', // MNM C04 (mở rộng)
  publishers: '/publishers', // MNM C05 (mở rộng)
  // TODO UC004+: cart, orders... | UC005: plans, subscriptions | UC006: reading
} as const;
