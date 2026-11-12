/** Chỉ số / nhãn dùng chung trang báo cáo + xuất Excel (UC011) */

// [Xử lý] % tăng/giảm so với kỳ trước.
export function growthPct(cur: number, prev: number): number | null {
  if (prev === 0) return cur === 0 ? 0 : null;
  return Math.round(((cur - prev) / prev) * 1000) / 10;
}

// [Xử lý] Hiển thị mức tăng/giảm (▲ ▼).
/** So với kỳ trước — chỉ % */
export function formatDelta(cur: number, prev: number): string {
  const pct = growthPct(cur, prev);
  if (pct === null) return cur > 0 ? '↑ mới' : '—';
  if (pct > 0) return `↑ ${pct}%`;
  if (pct < 0) return `↓ ${Math.abs(pct)}%`;
  return '0%';
}

// [Xử lý] Tên phương thức thanh toán trong báo cáo.
export function payLabel(method: string): string {
  if (method === 'COD') return 'COD (tiền mặt khi nhận)';
  if (method === 'WALLET') return 'Ví nội bộ';
  return method;
}

// [Xử lý] Định dạng ngày YYYY-MM-DD.
// Định dạng YYYY-MM-DD theo giờ máy (không dùng toISOString: ở UTC+7 sẽ lùi 1 ngày)
const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// [Xử lý] Khoảng ngày của một tháng.
export function rangeMonth(year: number, month: number) {
  return { from: ymd(new Date(year, month - 1, 1)), to: ymd(new Date(year, month, 0)) };
}

// [Xử lý] Khoảng ngày của một năm.
export function rangeYear(year: number) {
  return { from: ymd(new Date(year, 0, 1)), to: ymd(new Date(year, 11, 31)) };
}
