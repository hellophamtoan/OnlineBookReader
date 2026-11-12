// hooks/useDebounce.ts
import { useEffect, useState } from 'react';

// [Xử lý] Trì hoãn giá trị (ô tìm kiếm) để không gọi API mỗi lần gõ phím.
export function useDebounce<T>(value: T, delayMs = 400) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}
