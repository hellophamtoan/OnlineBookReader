// hooks/useAsync.ts
// Gọi một hàm bất đồng bộ (thường là service) và theo dõi loading / lỗi.
// Tự bỏ kết quả cũ nếu deps đổi hoặc component đã unmount (tránh "race condition" khi gõ tìm kiếm).
import { useCallback, useEffect, useState } from 'react';

interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: unknown;
}

export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [state, setState] = useState<AsyncState<T>>({ data: null, loading: true, error: null });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    // Giữ dữ liệu cũ trong lúc tải lại để danh sách không "nhấp nháy"
    setState((s) => ({ data: s.data, loading: true, error: null }));
    fn()
      .then((data) => !cancelled && setState({ data, loading: false, error: null }))
      .catch((error) => !cancelled && setState({ data: null, loading: false, error }));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { ...state, reload };
}
