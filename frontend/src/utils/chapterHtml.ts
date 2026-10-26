// utils/chapterHtml.ts
// UC007 - hỗ trợ Admin soạn nội dung chương HTML.
const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Văn bản thường -> HTML: đoạn cách nhau bằng dòng trống thành <p>, xuống dòng đơn thành <br>.
export const textToHtml = (text: string): string =>
  text
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => `<p>${escapeHtml(block).replace(/\n/g, '<br>')}</p>`)
    .join('\n');
