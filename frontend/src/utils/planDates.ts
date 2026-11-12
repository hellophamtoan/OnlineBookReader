/**
 * Utils ngày / giá gói đọc.
 * - State & API: luôn YYYY-MM-DD
 * - Hiển thị: DD/MM/YYYY
 * - Số ngày = diffDays(start, end) (exclusive start): 01/11 → 01/12 = 30 ngày
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export type PlanKind = 'fixed' | 'lifetime' | 'custom';

export const PLAN_BASE_DAYS = 30;
export const PLAN_BASE_PRICE = 60_000;
export const PLAN_MIN_DAYS = 30;
/** Gói trọn đời: ~100 năm */
export const LIFETIME_DAYS = 36500;

export const PLAN_KIND_LABEL: Record<PlanKind, string> = {
  fixed: 'Gói cố định',
  lifetime: 'Gói trọn đời',
  custom: 'Gói tùy chọn',
};

export function todayYmd(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseYmd(ymd: string): Date | null {
  if (!isRealDate(ymd)) return null;
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function isRealDate(ymd: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return false;
  const [y, m, d] = ymd.split('-').map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

export function addDays(ymd: string, days: number): string {
  const dt = parseYmd(ymd);
  if (!dt) return ymd;
  dt.setDate(dt.getDate() + days);
  return todayYmd(dt);
}

export function diffDays(startYmd: string, endYmd: string): number {
  const a = parseYmd(startYmd);
  const b = parseYmd(endYmd);
  if (!a || !b) return NaN;
  return Math.round((b.getTime() - a.getTime()) / DAY_MS);
}

export function formatDisplayDate(ymd: string): string {
  if (!isRealDate(ymd)) return ymd || '—';
  const [y, m, d] = ymd.split('-');
  return `${d}/${m}/${y}`;
}

export function minEndDate(startYmd: string, minDays = PLAN_MIN_DAYS): string {
  return addDays(startYmd, minDays);
}

export type EndDateValidation =
  | { ok: true; days: number }
  | { ok: false; message: string };

export function validateEndDate(
  startYmd: string,
  endYmd: string,
  minDays = PLAN_MIN_DAYS,
): EndDateValidation {
  if (!isRealDate(startYmd)) return { ok: false, message: 'Ngày bắt đầu không hợp lệ' };
  if (!isRealDate(endYmd)) {
    return { ok: false, message: 'Ngày kết thúc không hợp lệ (cần YYYY-MM-DD)' };
  }
  const min = minEndDate(startYmd, minDays);
  const days = diffDays(startYmd, endYmd);
  if (Number.isNaN(days) || days < minDays || endYmd < min) {
    return {
      ok: false,
      message: `Chỉ được chọn ngày kết thúc từ ${formatDisplayDate(min)} trở đi (tối thiểu ${minDays} ngày)`,
    };
  }
  return { ok: true, days };
}

/**
 * Giá lũy tiến theo đoạn 30 ngày (basePrice / 30 ngày):
 * - Segment 1: × 1
 * - Segment 2: × 2/3
 * - Segment 3: × 1/2
 * - Segment 4+: × 1/3
 * Làm tròn hàng nghìn.
 */
export function progressivePlanPrice(
  totalDays: number,
  basePrice = PLAN_BASE_PRICE,
  baseDays = PLAN_BASE_DAYS,
): number {
  if (!Number.isFinite(totalDays) || totalDays <= 0) return 0;
  let remaining = totalDays;
  let price = 0;
  let segment = 0;
  while (remaining > 0) {
    segment += 1;
    const inSeg = Math.min(remaining, baseDays);
    
    // Điều chỉnh hệ số theo yêu cầu mới: (1 + 2/3 + 1/2 + 1/3 + 1/3 + 1/3 ...)
    let factor = 1/3;
    if (segment === 1) factor = 1;
    else if (segment === 2) factor = 2 / 3;
    else if (segment === 3) factor = 1 / 2;

    price += factor * basePrice * (inSeg / baseDays);
    remaining -= inSeg;
  }
  return Math.round(price / 1000) * 1000;
}

export function formatRangeLabel(startYmd: string, endYmd: string, days: number): string {
  return `Từ ${formatDisplayDate(startYmd)} đến ${formatDisplayDate(endYmd)} — ${days} ngày`;
}

export function normalizePlanKind(v: unknown): PlanKind {
  if (v === 'lifetime' || v === 'custom' || v === 'fixed') return v;
  return 'fixed';
}