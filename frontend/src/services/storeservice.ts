// services/storeservice.ts
// Thông tin cửa hàng (chân trang). Chưa nằm trong hợp đồng UC001–UC003: GET /store-info là đề xuất của FE.
// BE chưa có (404) thì hook useStoreInfo tự dùng giá trị dự phòng trong config/rules.ts.
import { STORE_INFO } from '../config/rules';
import type { StoreInfo } from '../types';
import { env } from '../config/env';
import { api } from './api';
import { ENDPOINTS } from './endpoints';
import { mapStoreInfo } from './mappers';

export const storeService = {
  async getInfo(): Promise<StoreInfo> {
    // Backend chưa có GET /store-info: khi gọi BE thật thì dùng luôn giá trị dự phòng, tránh lỗi 404 ở mọi trang
    if (!env.USE_MOCK) return STORE_INFO;
    const res = await api.get(ENDPOINTS.storeInfo);
    return mapStoreInfo(res.data, STORE_INFO);
  },
};
