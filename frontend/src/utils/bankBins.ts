/** Map tên ngân hàng → BIN Napas/VietQR (admin không cần nhập BIN) */
export const BANK_OPTIONS = [
  { bin: '970422', name: 'MB Bank' },
  { bin: '970436', name: 'Vietcombank (VCB)' },
  { bin: '970407', name: 'Techcombank (TCB)' },
  { bin: '970416', name: 'ACB' },
  { bin: '970432', name: 'VPBank' },
  { bin: '970418', name: 'BIDV' },
  { bin: '970415', name: 'VietinBank' },
  { bin: '970403', name: 'Sacombank' },
  { bin: '970423', name: 'TPBank' },
  { bin: '970441', name: 'VIB' },
] as const;

export type BankOption = (typeof BANK_OPTIONS)[number];

// [Xử lý] Tra mã BIN theo tên ngân hàng (tạo QR).
export function binFromBankName(bankName: string): string | null {
  const n = bankName.trim().toLowerCase();
  const found = BANK_OPTIONS.find(
    (b) => b.name.toLowerCase() === n || b.name.toLowerCase().includes(n) || n.includes(b.bin),
  );
  return found?.bin ?? null;
}

// [Xử lý] Tra tên ngân hàng theo mã BIN.
export function bankNameFromBin(bin: string): string {
  const found = BANK_OPTIONS.find((b) => b.bin === bin);
  return found?.name ?? '';
}
