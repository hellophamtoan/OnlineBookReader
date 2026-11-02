/** Chỉ số / nhãn dùng chung trang báo cáo + xuất Excel (UC011) */

export function growthPct(cur: number, prev: number): number | null {
  if (prev === 0) return cur === 0 ? 0 : null;
  return Math.round(((cur - prev) / prev) * 1000) / 10;
}

/** So với kỳ trước — chỉ % */
export function formatDelta(cur: number, prev: number): string {
  const pct = growthPct(cur, prev);
  if (pct === null) return cur > 0 ? '↑ mới' : '—';
  if (pct > 0) return `↑ ${pct}%`;
  if (pct < 0) return `↓ ${Math.abs(pct)}%`;
  return '0%';
}

export function payLabel(method: string): string {
  if (method === 'COD') return 'COD (tiền mặt khi nhận)';
  if (method === 'WALLET') return 'Ví nội bộ';
  return method;
}

export function rangeMonth(year: number, month: number) {
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const from = new Date(year, month - 1, 1);
  const to = new Date(year, month, 0);
  return { from: iso(from), to: iso(to) };
}

export function rangeYear(year: number) {
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { from: iso(new Date(year, 0, 1)), to: iso(new Date(year, 11, 31)) };
}
