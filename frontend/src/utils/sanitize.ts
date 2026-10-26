// utils/sanitize.ts
export const ALLOWED_TAGS = ['P', 'BR', 'HR', 'H1', 'H2', 'H3', 'H4', 'STRONG', 'B', 'EM', 'I', 'U', 'BLOCKQUOTE', 'UL', 'OL', 'LI', 'SPAN', 'DIV'];

export const sanitizeChapterHtml = (html: string): string => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // Hàm đệ quy duyệt qua tất cả các node để lọc
  const cleanNode = (node: Node) => {
    const children = Array.from(node.childNodes);
    
    children.forEach((child) => {
      if (child.nodeType === Node.ELEMENT_NODE) {
        const element = child as HTMLElement;
        
        // Nếu thẻ không nằm trong danh sách cho phép -> Gỡ bỏ thẻ nhưng giữ lại nội dung bên trong
        if (!ALLOWED_TAGS.includes(element.nodeName)) {
          while (element.firstChild) {
            element.parentNode?.insertBefore(element.firstChild, element);
          }
          element.parentNode?.removeChild(element);
        } else {
          // Xóa tất cả các thuộc tính (attribute) như style, class, onclick, href...
          while (element.attributes.length > 0) {
            element.removeAttribute(element.attributes[0].name);
          }
          // Tiếp tục duyệt các node con bên trong
          cleanNode(element);
        }
      } else if (child.nodeType !== Node.TEXT_NODE) {
        // Xóa các node không phải Element hoặc Text (ví dụ: comment <!-- -->)
        node.removeChild(child);
      }
    });
  };

  cleanNode(doc.body);
  return doc.body.innerHTML;
};