// utils/book.ts
// Suy ra thông tin hiển thị từ dữ liệu sách (để UC004/UC006 dùng lại).
import type { Book } from '../types';

// Có bán bản giấy? Nếu BE không gửi hasPhysical thì suy từ giá.
export const isPhysical = (b: Book) => b.hasPhysical ?? b.price !== null;

export const stockLabel = (b: Book): { text: string; tone: 'ok' | 'low' | 'out' } | null => {
  if (!isPhysical(b) || b.stockQuantity === null) return null;
  if (b.stockQuantity <= 0) return { text: 'Hết hàng', tone: 'out' };
  if (b.stockQuantity <= 5) return { text: `Chỉ còn ${b.stockQuantity} cuốn`, tone: 'low' };
  return { text: 'Còn hàng', tone: 'ok' };
};

export const authorLine = (b: Pick<Book, 'authors'>) => b.authors.map((a) => a.name).join(', ') || 'Chưa rõ tác giả';
