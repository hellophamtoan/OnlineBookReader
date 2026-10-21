// services/mocks/handlers/store.ts
// Giả lập GET /store-info (thông tin liên hệ ở chân trang).
import { STORE_INFO } from '../../../config/rules';
import type { Route } from '../router';

export const storeRoutes: Route[] = [
  {
    method: 'GET',
    path: '/store-info',
    handler: () => ({ message: 'Lấy thông tin cửa hàng thành công', data: { ...STORE_INFO } }),
  },
];
