// Làm sạch HTML nội dung chương (chống XSS, quy tắc 12). Chỉ giữ thẻ định dạng văn bản.
const sanitizeHtml = require('sanitize-html');

// [Backend] Làm sạch HTML nội dung chương, chỉ giữ thẻ định dạng (chống XSS).
const sanitizeChapterContent = (html) =>
  sanitizeHtml(html, {
    allowedTags: ['p', 'br', 'hr', 'h1', 'h2', 'h3', 'h4', 'strong', 'b', 'em', 'i', 'u',
      'blockquote', 'ul', 'ol', 'li', 'span', 'div'],
    allowedAttributes: {},
    disallowedTagsMode: 'discard'
  });

module.exports = { sanitizeChapterContent };
