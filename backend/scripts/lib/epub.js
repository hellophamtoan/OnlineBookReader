// scripts/lib/epub.js
// Đọc file EPUB và tách thành các chương (HTML đã làm sạch) để nhập vào bảng chapters.
// EPUB thực chất là file zip chứa các trang XHTML:
//   META-INF/container.xml -> file .opf (danh sách + thứ tự các trang) -> mục lục (nav.xhtml / toc.ncx).
const AdmZip = require('adm-zip');
const { XMLParser } = require('fast-xml-parser');
const sanitizeHtml = require('sanitize-html');

const xml = new XMLParser({
  ignoreAttributes: false, attributeNamePrefix: '@_', removeNSPrefix: true,
  isArray: (name) => ['item', 'itemref'].includes(name)
});

// Trang bìa, bản quyền, mục lục... không phải chương. Từ ngắn dùng \b để tránh bắt nhầm (vd. "naval").
const SKIP_WORD = /\b(cover|contents|toc|nav|licen[sc]e|endnotes|loi|bìa|mục lục|bản quyền)\b/i;
const SKIP_ANY = /(titlepage|title page|halftitle|copyright|colophon|imprint|pg-header|pg-footer)/i;

const ALLOWED_TAGS = ['p', 'br', 'hr', 'h1', 'h2', 'h3', 'h4', 'strong', 'b', 'em', 'i', 'u',
  'blockquote', 'ul', 'ol', 'li', 'span', 'div'];

const textOf = (v) => {
  if (v === undefined || v === null) return '';
  if (typeof v === 'string' || typeof v === 'number') return String(v);
  if (Array.isArray(v)) return textOf(v[0]);
  return textOf(v['#text']);
};
const stripTags = (html) => html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
const normalize = (s) => stripTags(s).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const dirname = (p) => (p.includes('/') ? p.slice(0, p.lastIndexOf('/') + 1) : '');

// Ghép đường dẫn tương đối (có thể chứa ../) với thư mục gốc, bỏ phần #fragment
const resolvePath = (baseDir, href) => {
  const parts = (baseDir + decodeURIComponent(href.split('#')[0])).split('/');
  const out = [];
  for (const s of parts) {
    if (s === '..') out.pop();
    else if (s !== '.' && s !== '') out.push(s);
  }
  return out.join('/');
};

const extractBody = (html) => {
  const m = /<body[^>]*>([\s\S]*)<\/body>/i.exec(html);
  return m ? m[1] : html;
};

// Làm sạch HTML chương: chỉ giữ thẻ định dạng chữ (cùng danh sách với BE), bỏ ảnh/script/style/thuộc tính
const sanitizeChapterHtml = (html, title = '') => {
  let out = sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {},
    nonTextTags: ['script', 'style', 'textarea', 'option', 'svg', 'head', 'title'],
    transformTags: { h5: 'h4', h6: 'h4' }
  });
  // Xóa thẻ rỗng (lặp vì xóa thẻ con có thể làm thẻ cha rỗng)
  let prev;
  do {
    prev = out;
    out = out.replace(/<(p|div|span|h[1-4]|blockquote|li|ul|ol|strong|em|b|i|u)>\s*<\/\1>/g, '');
  } while (out !== prev);
  out = out.replace(/\n{3,}/g, '\n\n').trim();
  // Bỏ tiêu đề đầu chương nếu trùng tên chương (FE đã hiển thị tên chương riêng)
  const lead = /^<h([1-4])>([\s\S]*?)<\/h\1>\s*/.exec(out);
  if (lead && title && normalize(lead[2]) === normalize(title)) out = out.slice(lead[0].length).trim();
  return out;
};

// Mục lục EPUB3 (nav) hoặc EPUB2 (ncx) -> [{ file, frag, title }]
const readToc = (opfManifest, read, opfDir) => {
  const entries = [];
  const nav = Object.values(opfManifest).find((m) => /\bnav\b/.test(m.props));
  const ncx = Object.values(opfManifest).find((m) => m.type === 'application/x-dtbncx+xml');
  const push = (tocFile, href, label) => {
    if (!href) return;
    const [, frag = ''] = href.split('#');
    entries.push({ file: resolvePath(dirname(tocFile), href), frag, title: stripTags(label) });
  };
  if (nav) {
    const html = read(nav.href);
    const section = /<nav[^>]*(?:epub:)?type=["']toc["'][^>]*>([\s\S]*?)<\/nav>/i.exec(html);
    const re = /<a\s[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let m;
    const src = section ? section[1] : html;
    while ((m = re.exec(src))) push(nav.href, m[1], m[2]);
  } else if (ncx) {
    const re = /<navLabel>\s*<text>([\s\S]*?)<\/text>\s*<\/navLabel>\s*<content\s+src=["']([^"']+)["']/gi;
    let m;
    const src = read(ncx.href);
    while ((m = re.exec(src))) push(ncx.href, m[2], m[1]);
  }
  return entries;
};

// Một file chứa nhiều mục lục có #fragment -> cắt theo vị trí các id
const splitByAnchors = (body, entries) => {
  const marks = [];
  for (const e of entries) {
    if (!e.frag) continue;
    const m = new RegExp(`<[^>]*\\bid=["']${escapeRe(e.frag)}["'][^>]*>`).exec(body);
    if (m && !marks.some((x) => x.index === m.index)) marks.push({ index: m.index, title: e.title });
  }
  marks.sort((a, b) => a.index - b.index);
  if (marks.length < 2) return null;
  return marks.map((m, i) => ({
    title: m.title,
    html: body.slice(i === 0 ? 0 : m.index, marks[i + 1] ? marks[i + 1].index : body.length)
  }));
};

/**
 * Đọc EPUB (Buffer) và trả về { title, chapters }.
 * Mỗi phần tử: { index, title, html, textLength, skipped, reason, source }.
 * `skipped = true` là phần bị loại (bìa, mục lục, quá ngắn...); in ra để người dùng kiểm tra.
 */
const parseEpub = (buffer, { minChars = 200, skipPattern = null } = {}) => {
  const zip = new AdmZip(buffer);
  const read = (p) => {
    const entry = zip.getEntry(p);
    if (!entry) throw new Error(`File EPUB thiếu: ${p}`);
    return entry.getData().toString('utf8');
  };

  const container = xml.parse(read('META-INF/container.xml'));
  const rootfile = [].concat(container.container.rootfiles.rootfile)[0];
  const opfPath = rootfile['@_full-path'];
  const opfDir = dirname(opfPath);
  const opf = xml.parse(read(opfPath)).package;

  const manifest = {};
  for (const it of opf.manifest.item) {
    manifest[it['@_id']] = { href: resolvePath(opfDir, it['@_href']), type: it['@_media-type'] || '', props: it['@_properties'] || '' };
  }
  const spine = (opf.spine.itemref || [])
    .filter((r) => r['@_linear'] !== 'no')
    .map((r) => manifest[r['@_idref']])
    .filter((m) => m && /x?html/.test(m.type));
  if (!spine.length) throw new Error('EPUB không có trang nội dung nào');

  const toc = readToc(manifest, read, opfDir);
  const extraSkip = skipPattern ? new RegExp(skipPattern, 'i') : null;

  const sections = [];
  for (const item of spine) {
    const body = extractBody(read(item.href));
    const entries = toc.filter((e) => e.file === item.href);
    const parts = entries.filter((e) => e.frag).length >= 2 ? splitByAnchors(body, entries) : null;
    if (parts) parts.forEach((p) => sections.push({ ...p, source: item.href }));
    else sections.push({ title: entries[0] ? entries[0].title : '', html: body, source: item.href });
  }

  const chapters = sections.map((s, i) => {
    const base = s.source.split('/').pop().replace(/\.[^.]+$/, '');
    let title = s.title;
    if (!title) {
      const h = /<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/i.exec(s.html);
      title = h ? stripTags(h[1]) : '';
    }
    const html = sanitizeChapterHtml(s.html, title);
    const textLength = stripTags(html).length;
    let reason = null;
    if (SKIP_ANY.test(base) || SKIP_ANY.test(title) || SKIP_WORD.test(base) || SKIP_WORD.test(title)) reason = 'không phải chương (bìa/mục lục/bản quyền)';
    else if (extraSkip && (extraSkip.test(base) || extraSkip.test(title))) reason = 'khớp --skip-pattern';
    else if (textLength < minChars) reason = `quá ngắn (< ${minChars} ký tự)`;
    return { index: i + 1, title, html, textLength, skipped: !!reason, reason, source: s.source };
  });

  // Chương không tìm được tên thì đặt theo thứ tự trong số các chương được giữ
  let n = 0;
  for (const c of chapters) {
    if (c.skipped) continue;
    n += 1;
    if (!c.title) c.title = `Chương ${n}`;
  }
  return { title: textOf(opf.metadata && opf.metadata.title), chapters };
};

module.exports = { parseEpub, sanitizeChapterHtml };
