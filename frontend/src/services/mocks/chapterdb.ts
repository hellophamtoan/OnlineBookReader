// services/mocks/chapterdb.ts
// "CSDL" giả cho CHƯƠNG E-BOOK (UC007 quản lý, UC006 đọc). Mỗi sách có e-book được sinh sẵn 3-5 chương nội dung minh họa.
// Admin thêm/sửa/xóa chương thì cả danh sách được lưu vào localStorage (khóa mock_chapters).
import { MOCK_BOOKS } from './data';
import { readJson, writeJson } from './storage';

export interface MockChapter {
  id: number;
  bookId: number;
  chapterNumber: number;
  title: string;
  content: string; // HTML
}

const SENTENCES = [
  'Buổi sáng hôm ấy, trời còn mờ sương, con đường nhỏ dẫn ra bến sông vắng lặng đến lạ thường.',
  'Người ta thường chỉ nhận ra giá trị của một khoảnh khắc khi nó đã trôi qua từ rất lâu.',
  'Anh ngồi bên cửa sổ, lặng lẽ nhìn những giọt nước đọng trên tán lá rồi chầm chậm rơi xuống.',
  'Có những câu hỏi không cần lời đáp ngay, chúng chỉ cần được giữ lại đủ lâu để lớn dần theo năm tháng.',
  'Căn phòng nhỏ thoang thoảng mùi giấy cũ, nơi từng trang sách như đang thì thầm kể chuyện của chính mình.',
  'Mỗi quyết định, dù nhỏ đến đâu, đều âm thầm mở ra một con đường mà ta chưa từng nghĩ tới.',
  'Cô chợt hiểu rằng sự kiên nhẫn không phải là chờ đợi, mà là biết cách tiếp tục trong lúc chờ đợi.',
  'Tiếng chuông xa vọng lại, hòa vào nhịp bước đều đặn của những người đang trở về sau một ngày dài.',
  'Họ trò chuyện đến tận khuya, về những dự định còn dang dở và cả những nỗi sợ chưa từng gọi tên.',
  'Gió từ cánh đồng thổi qua, mang theo hương lúa chín và cảm giác bình yên khó diễn tả thành lời.',
  'Đôi khi, điều cần làm nhất không phải là chạy nhanh hơn, mà là dừng lại để nhìn rõ mình đang đi về đâu.',
  'Ký ức tuổi thơ hiện về thật rõ, từ tiếng cười giòn tan đến những buổi chiều lang thang bên bờ đê.',
  'Cuốn sổ cũ trong ngăn kéo vẫn nằm đó, những dòng chữ nguệch ngoạc giờ đây bỗng trở nên đáng quý.',
  'Thành công lớn thường được dựng nên từ vô số việc nhỏ, được lặp lại một cách bền bỉ và thầm lặng.',
  'Trong im lặng, ông nghe thấy rõ hơn tiếng lòng mình, thứ âm thanh mà ồn ào thường che lấp.',
  'Con đường phía trước vẫn còn dài, nhưng lần này họ đã biết mình mang theo những gì.',
];

const TITLES = ['Khởi đầu', 'Con đường phía trước', 'Những người bạn mới', 'Thử thách đầu tiên', 'Điều bất ngờ', 'Khoảng lặng', 'Trở về'];

const sentence = (i: number) => SENTENCES[i % SENTENCES.length];
const paragraph = (seed: number, sentences = 4) => `<p>${Array.from({ length: sentences }, (_, i) => sentence(seed + i * 3)).join(' ')}</p>`;

const makeContent = (title: string, bookId: number, no: number): string => {
  const s = bookId * 7 + no * 5;
  return [
    `<h2>${title}</h2>`,
    no === 1 ? '<p><em>Nội dung minh họa do dữ liệu giả tạo ra, không phải nội dung thật của sách.</em></p>' : '',
    paragraph(s), paragraph(s + 1), paragraph(s + 2),
    `<blockquote>${sentence(s + 4)}</blockquote>`,
    paragraph(s + 5), paragraph(s + 6), paragraph(s + 7, 5),
    '<h3>Ghi nhớ</h3>',
    `<ul><li>${sentence(s + 8)}</li><li>${sentence(s + 9)}</li><li>${sentence(s + 10)}</li></ul>`,
    '<hr>',
    paragraph(s + 11), paragraph(s + 12, 5), paragraph(s + 13),
  ].join('\n');
};

let seeded: MockChapter[] | null = null;
const seedChapters = (): MockChapter[] => {
  if (seeded) return seeded;
  const rows: MockChapter[] = [];
  MOCK_BOOKS.filter((b) => b.hasEbook && b.status === 'active').forEach((b) => {
    const count = 3 + (b.id % 3);
    for (let no = 1; no <= count; no += 1) {
      const title = `Chương ${no}: ${TITLES[(b.id + no) % TITLES.length]}`;
      rows.push({ id: rows.length + 1, bookId: b.id, chapterNumber: no, title, content: makeContent(title, b.id, no) });
    }
  });
  seeded = rows;
  return rows;
};

const KEY = 'mock_chapters';
export const allChapters = (): MockChapter[] => readJson<MockChapter[]>(KEY, seedChapters());
export const saveChapters = (list: MockChapter[]) => writeJson(KEY, list);

export const chaptersOf = (bookId: number): MockChapter[] =>
  allChapters().filter((c) => c.bookId === bookId).sort((a, b) => a.chapterNumber - b.chapterNumber);

export const findChapterById = (id: number): MockChapter | undefined => allChapters().find((c) => c.id === id);
export const nextChapterId = () => Math.max(0, ...allChapters().map((c) => c.id)) + 1;
