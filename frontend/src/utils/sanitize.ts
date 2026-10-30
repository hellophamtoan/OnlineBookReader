// utils/sanitize.ts
// Làm sạch HTML chương trước khi lưu / hiển thị reader.
// Cho phép img chỉ khi src là data:image, http(s) hoặc /uploads/ (tránh javascript:).

export const ALLOWED_TAGS = [
  'P',
  'BR',
  'HR',
  'H1',
  'H2',
  'H3',
  'H4',
  'STRONG',
  'B',
  'EM',
  'I',
  'U',
  'BLOCKQUOTE',
  'UL',
  'OL',
  'LI',
  'SPAN',
  'DIV',
  'IMG',
];

const SAFE_IMG_SRC =
  /^(data:image\/[a-z0-9+.-]+(;[^,]*)?,|https?:\/\/|\/uploads\/)/i;

export const sanitizeChapterHtml = (html: string): string => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  const cleanNode = (node: Node) => {
    const children = Array.from(node.childNodes);

    children.forEach((child) => {
      if (child.nodeType === Node.ELEMENT_NODE) {
        const element = child as HTMLElement;

        if (!ALLOWED_TAGS.includes(element.nodeName)) {
          while (element.firstChild) {
            element.parentNode?.insertBefore(element.firstChild, element);
          }
          element.parentNode?.removeChild(element);
        } else if (element.nodeName === 'IMG') {
          const src = element.getAttribute('src')?.trim() || '';
          const alt = element.getAttribute('alt')?.trim() || '';
          while (element.attributes.length > 0) {
            element.removeAttribute(element.attributes[0].name);
          }
          if (!src || !SAFE_IMG_SRC.test(src)) {
            element.parentNode?.removeChild(element);
            return;
          }
          element.setAttribute('src', src);
          if (alt) element.setAttribute('alt', alt);
        } else {
          while (element.attributes.length > 0) {
            element.removeAttribute(element.attributes[0].name);
          }
          cleanNode(element);
        }
      } else if (child.nodeType !== Node.TEXT_NODE) {
        node.removeChild(child);
      }
    });
  };

  cleanNode(doc.body);
  return doc.body.innerHTML;
};
