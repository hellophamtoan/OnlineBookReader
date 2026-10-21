// utils/text.ts
// Bỏ dấu + chữ thường: gõ "nha gia kim" vẫn khớp "Nhà giả kim". Dùng cho mock và có thể dùng cho lọc phía client.
export const normalizeText = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'd').toLowerCase().trim();
