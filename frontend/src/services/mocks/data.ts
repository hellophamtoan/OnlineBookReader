// services/mocks/data.ts
// Dữ liệu sách giả (khoảng 25 cuốn để thử phân trang, có cả sách hết hàng, chỉ-e-book và sách ngừng bán).
export interface MockBook {
  id: number;
  title: string;
  authorId: number;
  categoryId: number;
  publisherId: number;
  price: number | null; // null = chỉ có e-book
  stock: number;
  hasEbook: boolean;
  hasPhysical: boolean;
  status: 'active' | 'inactive';
  createdAt: string;
  description: string;
}

export const MOCK_CATEGORIES = [
  { id: 1, name: 'Văn học' },
  { id: 2, name: 'Kinh tế' },
  { id: 3, name: 'Kỹ năng sống' },
  { id: 4, name: 'Thiếu nhi' },
  { id: 5, name: 'Khoa học' },
  { id: 6, name: 'Lịch sử' },
  { id: 7, name: 'Tâm lý' },
];

export const MOCK_AUTHORS = [
  { id: 1, name: 'Tô Hoài' },
  { id: 2, name: 'Paulo Coelho' },
  { id: 3, name: 'Nguyễn Nhật Ánh' },
  { id: 4, name: 'Dale Carnegie' },
  { id: 5, name: 'Stephen Hawking' },
  { id: 6, name: 'Nam Cao' },
  { id: 7, name: 'Vũ Trọng Phụng' },
  { id: 8, name: 'Yuval Noah Harari' },
  { id: 9, name: 'Napoleon Hill' },
  { id: 10, name: 'Daniel Kahneman' },
  { id: 11, name: 'Antoine de Saint-Exupéry' },
  { id: 12, name: 'Tony Buổi Sáng' },
];

export const MOCK_PUBLISHERS = [
  { id: 1, name: 'NXB Trẻ' },
  { id: 2, name: 'NXB Kim Đồng' },
  { id: 3, name: 'NXB Văn học' },
  { id: 4, name: 'NXB Tổng hợp TP.HCM' },
  { id: 5, name: 'NXB Thế giới' },
  { id: 6, name: 'NXB Lao động' },
];

// [tựa, tác giả, thể loại, NXB, giá, tồn kho, e-book?, mô tả]
type Row = [string, number, number, number, number | null, number, boolean, string];

const ROWS: Row[] = [
  ['Nhà giả kim', 2, 1, 3, 79000, 54, true, 'Hành trình của chàng chăn cừu đi tìm kho báu và những điều học được trên đường.'],
  ['Đắc nhân tâm', 4, 3, 4, 86000, 40, true, 'Những nguyên tắc ứng xử giúp bạn tạo thiện cảm và xây dựng quan hệ tốt với mọi người.'],
  ['Mắt biếc', 3, 1, 1, 98000, 45, true, 'Câu chuyện tình đơn phương kéo dài từ thuở học trò ở một làng quê miền Trung.'],
  ['Dế Mèn phiêu lưu ký', 1, 4, 2, 65000, 70, true, 'Chuyến phiêu lưu của chú dế trẻ qua nhiều vùng đất và những bài học về lòng tốt.'],
  ['Lược sử thời gian', 5, 5, 5, 120000, 0, false, 'Giới thiệu cho độc giả phổ thông về vũ trụ, hố đen và bản chất của thời gian.'],
  ['Chí Phèo', 6, 1, 3, 52000, 33, true, 'Truyện ngắn về bi kịch của người nông dân bị đẩy ra ngoài lề xã hội.'],
  ['Số đỏ', 7, 1, 3, 68000, 25, false, 'Tiểu thuyết trào phúng châm biếm lối sống chạy theo danh vọng của xã hội thành thị.'],
  ['Sapiens: Lược sử loài người', 8, 6, 5, 189000, 18, true, 'Nhìn lại lịch sử loài người từ thời săn bắt hái lượm đến xã hội hiện đại.'],
  ['Nghĩ giàu làm giàu', 9, 2, 4, 95000, 60, true, 'Tổng hợp các nguyên tắc về tư duy và thói quen của người thành công trong kinh doanh.'],
  ['Tư duy nhanh và chậm', 10, 7, 4, 175000, 12, true, 'Phân tích hai hệ thống tư duy chi phối cách con người phán đoán và ra quyết định.'],
  ['Hoàng tử bé', 11, 4, 2, 59000, 80, true, 'Cuộc gặp gỡ giữa người phi công và cậu bé đến từ một hành tinh nhỏ.'],
  ['Cà phê cùng Tony', 12, 3, 6, 76000, 5, false, 'Những bài viết ngắn về định hướng nghề nghiệp và thái độ làm việc của người trẻ.'],
  ['Tôi thấy hoa vàng trên cỏ xanh', 3, 1, 1, 105000, 29, true, 'Những mảnh ký ức tuổi thơ ở một vùng quê nghèo, kể bằng giọng văn nhẹ nhàng.'],
  ['Cho tôi xin một vé đi tuổi thơ', 3, 4, 1, null, 0, true, 'Bản e-book: những suy nghĩ ngộ nghĩnh của trẻ con nhìn thế giới người lớn.'],
  ['Lão Hạc', 6, 1, 3, 48000, 41, false, 'Truyện ngắn về tình thương và lòng tự trọng của một người nông dân nghèo.'],
  ['Homo Deus', 8, 5, 5, 199000, 22, true, 'Suy đoán về tương lai của loài người khi công nghệ và dữ liệu thay đổi mọi thứ.'],
  ['Quẳng gánh lo đi và vui sống', 4, 3, 4, 82000, 36, true, 'Cách giảm bớt lo âu và sống tập trung vào hiện tại.'],
  ['Vũ trụ trong vỏ hạt dẻ', 5, 5, 5, 145000, 9, false, 'Tiếp nối Lược sử thời gian với nhiều hình minh họa về vật lý hiện đại.'],
  ['Kính vạn hoa', 3, 4, 2, 68000, 52, true, 'Loạt truyện về nhóm bạn nhỏ và những chuyện thường ngày ở trường học.'],
  ['Giông tố', 7, 1, 3, 88000, 14, false, 'Tiểu thuyết phản ánh xã hội nông thôn Bắc Bộ thời Pháp thuộc.'],
  ['13 nguyên tắc nghĩ giàu làm giàu', 9, 2, 4, 110000, 27, true, 'Mười ba nguyên tắc rút ra từ các tấm gương thành công, trình bày theo từng bước.'],
  ['Veronika quyết định chết', 2, 7, 3, 89000, 31, true, 'Câu chuyện về một cô gái trẻ và cách cô nhìn lại giá trị của cuộc sống.'],
  ['Truyện Tây Bắc', 1, 1, 3, 74000, 19, false, 'Tập truyện lấy bối cảnh vùng núi Tây Bắc, về cuộc sống và con người nơi đây.'],
  ['Sống mòn', 6, 1, 3, 79000, 23, true, 'Tiểu thuyết về cuộc sống quẩn quanh của những người trí thức nghèo.'],
  ['Ngồi khóc trên cây', 3, 1, 1, null, 0, true, 'Bản e-book: chuyện tình đầu trong trẻo của hai người bạn thời niên thiếu.'],
];

const DAY = 24 * 60 * 60 * 1000;
const BASE = Date.parse('2026-08-01T09:00:00Z');

export const MOCK_BOOKS: MockBook[] = [
  ...ROWS.map(([title, authorId, categoryId, publisherId, price, stock, hasEbook, description], i): MockBook => ({
    id: i + 1,
    title,
    authorId,
    categoryId,
    publisherId,
    price,
    stock,
    hasEbook,
    hasPhysical: price !== null,
    status: 'active',
    createdAt: new Date(BASE + i * 2 * DAY).toISOString(),
    description,
  })),
  // Sách ngừng bán: không được hiện ra ở danh sách, mở bằng ID phải trả 404 (D-08)
  {
    id: 99, title: 'Sách đã ngừng bán (mẫu)', authorId: 1, categoryId: 1, publisherId: 1, price: 50000, stock: 3,
    hasEbook: false, hasPhysical: true, status: 'inactive', createdAt: new Date(BASE).toISOString(), description: '',
  },
];
