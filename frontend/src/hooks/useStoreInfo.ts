// hooks/useStoreInfo.ts
// Thông tin liên hệ cửa hàng cho chân trang. Hiện ngay giá trị dự phòng, có dữ liệu từ API (mock hoặc backend) thì thay vào.
// Chỉ gọi API 1 lần cho cả phiên; lỗi thì giữ giá trị dự phòng và lần sau thử lại.
import { useEffect, useState } from 'react';
import { STORE_INFO } from '../config/rules';
import { storeService } from '../services/storeservice';
import type { StoreInfo } from '../types';

let cached: Promise<StoreInfo> | null = null;

export function useStoreInfo(): StoreInfo {
  const [info, setInfo] = useState<StoreInfo>(STORE_INFO);

  useEffect(() => {
    let cancelled = false;
    cached ??= storeService.getInfo().catch(() => {
      cached = null;
      return STORE_INFO;
    });
    cached.then((data) => !cancelled && setInfo(data));
    return () => {
      cancelled = true;
    };
  }, []);

  return info;
}
