/** Nhãn trạng thái yêu cầu nạp ví (QR) */
export function topupStatusLabel(status: string): string {
  const s = (status || '').toUpperCase();
  if (s === 'PAID') return 'Đã nạp';
  if (s === 'PENDING') return 'Chờ xác nhận';
  if (s === 'FAILED') return 'Thất bại';
  if (s === 'CANCELLED') return 'Đã hủy';
  if (s === 'EXPIRED') return 'Hết hạn';
  return status || '—';
}
