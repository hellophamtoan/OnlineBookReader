// utils/format.ts
const vnd = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 });

// 79000 -> "79.000 ₫"
export const formatPrice = (value: number) => vnd.format(value);

// ISO -> "02/08/2026"
export const formatDate = (iso?: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('vi-VN');
};
