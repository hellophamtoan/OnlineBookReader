// utils/epubParse.ts
// Parse EPUB trên trình duyệt.
// Lọc chương theo logic BE (scripts/lib/epub.js): SKIP bìa/TOC/bản quyền, minChars=200, sanitize HTML.
// Tận dụng thêm (form Thêm sách): ảnh bìa, dc:creator/publisher/description, toc, illustrationCount.
import { sanitizeChapterHtml } from './sanitize';
import type { EpubParseResult, EpubParsedChapter } from '../types';

const SKIP_WORD = /\b(cover|contents|toc|nav|licen[sc]e|endnotes|loi|bìa|mục lục|bản quyền)\b/i;
const SKIP_ANY = /(titlepage|title page|halftitle|copyright|colophon|imprint|pg-header|pg-footer|wrap-0\.html)/i;
/** Tiêu đề trang mục lục / bìa / Gutenberg — bỏ hẳn, không lấy làm nội dung chương */
const SKIP_TITLE =
  /^(contents|table of contents|mục lục|danh mục|project gutenberg|there are two editions|colored illustrations|grimm'?s fairy stories)\b/i;
/**
 * Lời nói đầu / giới thiệu / ghi chú ebook… — vẫn hiện trong list, mặc định không tích.
 * Nhận cả lỗi chính tả phổ biến: «Nhời nói đầu».
 */
const FRONT_MATTER_TITLE =
  /^(nh?ời\s*nói\s*đầu|lời\s*nói\s*đầu|lời\s*tựa|lời\s*mở\s*đầu|lời\s*nhà\s*xuất\s*bản|lời\s*người\s*dịch|lời\s*kết|phần\s*kết|kết\s*luận|giới\s*thiệu|phần\s*mở\s*đầu|ghi\s*chú(\s+của\s+nhóm)?|cảm\s*nhận(\s+của\s+độc\s*giả)?|ý\s*kiến\s*bạn\s*đọc|sách\s*của\s*(soạn\s*giả|tác\s*giả)|tác\s*phẩm\s*cùng\s*tác\s*giả|về\s*tác\s*giả|tiểu\s*sử|phụ\s*lục|chú\s*thích|mục\s*lục|danh\s*mục|preface|foreword|introduction|intro|prologue|epilogue|afterword|acknowledg(?:e)?ments?|dedication|note to the reader|about the author|author'?s note|editor'?s note|publisher'?s note|to the reader|bibliography|index)\b/i;

/** Trang meta sản xuất ebook (không phải lời nói đầu cũng không phải chương đọc) */
const META_PAGE =
  /\b(nguyên\s*thảo|biên\s*tập\s*ebook|kiểm\s*tra\s*chính\s*tả|ngày\s*hoàn\s*thành\s*ebook|số\s*hóa\s*\d*\s*quyển|dự\s*án\s*phi\s*lợi\s*nhuận)\b/i;
/** Tiêu đề chương dạng «1. – TÊN» / «10.—TÊN» */
const NUMBERED_TITLE = /^\s*(\d+)\s*[.．。:：)）]?[\s—–\-−]*\s*(.+)$/u;

/** Chuẩn BE scripts/import-epub --min-chars; trang chỉ ảnh vẫn bỏ dù có <img> */
export const EPUB_MIN_CHARS = 200;
const MIN_CHARS = EPUB_MIN_CHARS;
/** Trang spine chỉ có ảnh (Gutenberg image-wrap) */
const IMAGE_ONLY_MAX_TEXT = 40;
const IMAGE_EXT = /\.(jpe?g|png|gif|webp|svg)$/i;
/** Nén bìa nếu data URL vượt ngưỡng (tránh localStorage đầy → mất ảnh sau khi lưu) */
const COVER_MAX_DATA_CHARS = 350_000;
const COVER_MAX_EDGE = 900;

const stripTags = (html: string) =>
  html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

const normalize = (s: string) =>
  stripTags(s)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

/** Phần “có chương” — mặc định tích (số thứ tự hoặc chữ Chương) */
const STORY_CHAPTER_TITLE =
  /^(chương\s*\d+|(?:phần|hồi|mục)\s*\d+|\d+\s*[.．。:：)）\-—–])\b/iu;

const isFrontMatterTitle = (title: string) => {
  const t = title.replace(/\s+/g, ' ').trim();
  if (!t) return false;
  if (FRONT_MATTER_TITLE.test(t) || FRONT_MATTER_TITLE.test(normalize(t))) return true;
  if (META_PAGE.test(t)) return true;
  return false;
};

/** true = tích (tính số chương); false = phần phụ trong mục lục */
const countsAsStoryChapter = (title: string) => {
  if (isFrontMatterTitle(title)) return false;
  const t = title.replace(/\s+/g, ' ').trim();
  if (STORY_CHAPTER_TITLE.test(t) || NUMBERED_TITLE.test(t)) return true;
  // Tên chương không số trong mục lục vẫn tính chương
  return true;
};

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const dirname = (p: string) => (p.includes('/') ? p.slice(0, p.lastIndexOf('/') + 1) : '');

const resolvePath = (baseDir: string, href: string) => {
  const raw = href.split('#')[0];
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    /* giữ nguyên */
  }
  const parts = (baseDir + decoded).split('/');
  const out: string[] = [];
  for (const s of parts) {
    if (s === '..') out.pop();
    else if (s !== '.' && s !== '') out.push(s);
  }
  return out.join('/');
};

const extractBody = (html: string) => {
  const m = /<body[^>]*>([\s\S]*)<\/body>/i.exec(html);
  return m ? m[1] : html;
};

/** Nhúng ảnh trong chương: src tương đối trong EPUB → data URL (để đọc offline / lưu DB) */
const inlineChapterImages = (
  html: string,
  chapterPath: string,
  binary: Map<string, Uint8Array>,
): string => {
  const baseDir = dirname(chapterPath);
  // Giới hạn file ảnh gốc; ảnh minh họa sách giấy thường < 400KB
  const MAX_RAW = 1_200_000;
  return html.replace(/<img\b([^>]*?)\/?>/gi, (_full, attrs: string) => {
    const srcM = /src\s*=\s*["']([^"']+)["']/i.exec(attrs);
    if (!srcM) return '';
    let src = srcM[1].trim();
    if (!src || /^javascript:/i.test(src)) return '';
    if (/^data:image\//i.test(src)) {
      const altM = /alt\s*=\s*["']([^"']*)["']/i.exec(attrs);
      return `<img src="${src}"${altM ? ` alt="${altM[1]}"` : ''}>`;
    }
    if (/^https?:\/\//i.test(src)) {
      const altM = /alt\s*=\s*["']([^"']*)["']/i.exec(attrs);
      return `<img src="${src}"${altM ? ` alt="${altM[1]}"` : ''}>`;
    }
    // Bỏ query/hash; resolve đường dẫn trong ZIP
    src = src.split('?')[0].split('#')[0];
    const path = resolvePath(baseDir, src);
    const bytes = getZipEntry(binary, path);
    if (!bytes?.length) return '';
    if (bytes.length > MAX_RAW) return ''; // ảnh quá lớn: bỏ để tránh localStorage/DB phình
    try {
      const dataUrl = bytesToDataUrl(path, bytes);
      const altM = /alt\s*=\s*["']([^"']*)["']/i.exec(attrs);
      return `<img src="${dataUrl}"${altM ? ` alt="${altM[1]}"` : ' alt=""'}>`;
    } catch {
      return '';
    }
  });
};

const cleanChapterHtml = (
  html: string,
  title = '',
  chapterPath = '',
  binary?: Map<string, Uint8Array>,
) => {
  let prepared = html;
  if (binary && chapterPath) prepared = inlineChapterImages(html, chapterPath, binary);
  let out = sanitizeChapterHtml(prepared);
  let prev = '';
  do {
    prev = out;
    out = out.replace(/<(p|div|span|h[1-4]|blockquote|li|ul|ol|strong|em|b|i|u)>\s*<\/\1>/gi, '');
  } while (out !== prev);
  out = out.replace(/\n{3,}/g, '\n\n').trim();
  const lead = /^<h([1-4])>([\s\S]*?)<\/h\1>\s*/i.exec(out);
  if (lead && title && normalize(lead[2]) === normalize(title)) out = out.slice(lead[0].length).trim();
  return out;
};

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error(
      'Trình duyệt không hỗ trợ giải nén EPUB (thiếu DecompressionStream). Dùng Chrome/Edge/Firefox bản mới.',
    );
  }
  try {
    const ds = new DecompressionStream('deflate-raw');
    const stream = new Blob([data as BlobPart]).stream().pipeThrough(ds);
    return new Uint8Array(await new Response(stream).arrayBuffer());
  } catch {
    throw new Error('Không giải nén được một phần trong EPUB (dữ liệu hỏng hoặc không phải deflate)');
  }
}

type ZipContent = {
  text: Map<string, string>;
  binary: Map<string, Uint8Array>;
};

const mimeFromPath = (path: string) => {
  const lower = path.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.svg')) return 'image/svg+xml';
  return 'image/jpeg';
};

const bytesToDataUrl = (path: string, bytes: Uint8Array) => {
  const chunk = 0x2000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunk) {
    const slice = bytes.subarray(i, Math.min(i + chunk, bytes.length));
    for (let j = 0; j < slice.length; j++) binary += String.fromCharCode(slice[j]);
  }
  return `data:${mimeFromPath(path)};base64,${btoa(binary)}`;
};

/** Thu nhỏ JPEG/PNG qua canvas nếu data URL quá lớn (giữ hiển thị, dễ lưu mock/DB) */
async function maybeCompressCover(dataUrl: string): Promise<string> {
  if (dataUrl.length <= COVER_MAX_DATA_CHARS) return dataUrl;
  if (typeof document === 'undefined') return dataUrl;
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('img'));
      el.src = dataUrl;
    });
    const scale = Math.min(1, COVER_MAX_EDGE / Math.max(img.width, img.height, 1));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return dataUrl;
    ctx.drawImage(img, 0, 0, w, h);
    let quality = 0.82;
    let out = canvas.toDataURL('image/jpeg', quality);
    while (out.length > COVER_MAX_DATA_CHARS && quality > 0.45) {
      quality -= 0.12;
      out = canvas.toDataURL('image/jpeg', quality);
    }
    return out;
  } catch {
    return dataUrl;
  }
}

function findEocdOffset(bytes: Uint8Array, view: DataView): number {
  const maxBack = Math.min(bytes.length, 22 + 65535);
  for (let i = bytes.length - 22; i >= bytes.length - maxBack; i--) {
    if (i < 0) break;
    if (view.getUint32(i, true) === 0x06054b50) return i;
  }
  return -1;
}

async function readZipLocalScan(buf: ArrayBuffer): Promise<ZipContent> {
  const bytes = new Uint8Array(buf);
  const view = new DataView(buf);
  const text = new Map<string, string>();
  const binary = new Map<string, Uint8Array>();
  let offset = 0;

  const findNextLocal = (from: number) => {
    for (let i = from; i + 4 <= bytes.length; i++) {
      if (view.getUint32(i, true) === 0x04034b50) return i;
      if (view.getUint32(i, true) === 0x02014b50) return -1;
    }
    return -1;
  };

  while (offset + 30 <= bytes.length) {
    if (view.getUint32(offset, true) !== 0x04034b50) break;
    const method = view.getUint16(offset + 8, true);
    let compSize = view.getUint32(offset + 18, true);
    const nameLen = view.getUint16(offset + 26, true);
    const extraLen = view.getUint16(offset + 28, true);
    const nameStart = offset + 30;
    const name = new TextDecoder('utf-8').decode(bytes.subarray(nameStart, nameStart + nameLen)).replace(/\\/g, '/');
    const dataStart = nameStart + nameLen + extraLen;
    if (compSize === 0) {
      const next = findNextLocal(dataStart + 1);
      if (next > dataStart) compSize = next - dataStart;
      else break;
    }
    const dataEnd = dataStart + compSize;
    if (dataEnd > bytes.length) break;
    const payload = bytes.subarray(dataStart, dataEnd);
    try {
      let content: Uint8Array;
      if (method === 0) content = payload;
      else if (method === 8) content = await inflateRaw(payload);
      else {
        offset = dataEnd;
        continue;
      }
      if (!name.endsWith('/')) {
        if (IMAGE_EXT.test(name)) binary.set(name, content);
        else if (!/\.(ttf|otf|woff2?|css)$/i.test(name)) text.set(name, new TextDecoder('utf-8').decode(content));
      }
    } catch {
      /* bỏ entry hỏng */
    }
    offset = dataEnd;
  }
  return { text, binary };
}

async function readZip(buf: ArrayBuffer): Promise<ZipContent> {
  const bytes = new Uint8Array(buf);
  const view = new DataView(buf);
  const text = new Map<string, string>();
  const binary = new Map<string, Uint8Array>();

  const eocd = findEocdOffset(bytes, view);
  if (eocd < 0) return readZipLocalScan(buf);

  const totalEntries = view.getUint16(eocd + 10, true);
  let cdOffset = view.getUint32(eocd + 16, true);
  if (totalEntries === 0xffff || cdOffset === 0xffffffff) {
    throw new Error('EPUB dùng ZIP64 (file rất lớn) — hiện chưa hỗ trợ. Hãy dùng bản EPUB nhỏ hơn.');
  }

  let parsed = 0;
  while (parsed < totalEntries && cdOffset + 46 <= bytes.length) {
    if (view.getUint32(cdOffset, true) !== 0x02014b50) break;
    const method = view.getUint16(cdOffset + 10, true);
    const compSize = view.getUint32(cdOffset + 20, true);
    const nameLen = view.getUint16(cdOffset + 28, true);
    const extraLen = view.getUint16(cdOffset + 30, true);
    const commentLen = view.getUint16(cdOffset + 32, true);
    const localHeaderOffset = view.getUint32(cdOffset + 42, true);
    const nameStart = cdOffset + 46;
    const name = new TextDecoder('utf-8')
      .decode(bytes.subarray(nameStart, nameStart + nameLen))
      .replace(/\\/g, '/');

    if (localHeaderOffset + 30 <= bytes.length && view.getUint32(localHeaderOffset, true) === 0x04034b50) {
      const localNameLen = view.getUint16(localHeaderOffset + 26, true);
      const localExtraLen = view.getUint16(localHeaderOffset + 28, true);
      const dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen;
      const dataEnd = dataStart + compSize;
      if (dataEnd <= bytes.length && !name.endsWith('/')) {
        const payload = bytes.subarray(dataStart, dataEnd);
        try {
          let content: Uint8Array;
          if (method === 0) content = payload;
          else if (method === 8) content = await inflateRaw(payload);
          else {
            cdOffset = nameStart + nameLen + extraLen + commentLen;
            parsed += 1;
            continue;
          }
          if (IMAGE_EXT.test(name)) binary.set(name, content);
          else if (!/\.(ttf|otf|woff2?|css)$/i.test(name)) {
            text.set(name, new TextDecoder('utf-8').decode(content));
          }
        } catch {
          /* bỏ entry hỏng */
        }
      }
    }
    cdOffset = nameStart + nameLen + extraLen + commentLen;
    parsed += 1;
  }

  if (!text.size && !binary.size) {
    const fallback = await readZipLocalScan(buf);
    if (!fallback.text.size && !fallback.binary.size) {
      throw new Error('Không đọc được nội dung trong file EPUB (ZIP rỗng hoặc định dạng không hỗ trợ)');
    }
    return fallback;
  }
  return { text, binary };
}

const getZipEntry = <T>(map: Map<string, T>, path: string): T | undefined => {
  if (!path) return undefined;
  const norm = path.replace(/\\/g, '/').replace(/^\.\//, '');
  return (
    map.get(norm) ??
    map.get(norm.replace(/^\//, '')) ??
    map.get(`/${norm}`) ??
    [...map.entries()].find(([k]) => k.toLowerCase() === norm.toLowerCase())?.[1]
  );
};

type TocEntry = { file: string; frag: string; title: string };
type ManifestItem = { href: string; type: string; props: string };

const attr = (tag: string, name: string) => {
  const m = new RegExp(`${name}\\s*=\\s*["']([^"']+)["']`, 'i').exec(tag);
  return m ? m[1] : '';
};

const readToc = (manifest: Record<string, ManifestItem>, read: (p: string) => string): TocEntry[] => {
  const entries: TocEntry[] = [];
  const seen = new Set<string>();
  const list = Object.values(manifest);
  const nav = list.find((m) => /\bnav\b/.test(m.props));
  const ncx = list.find((m) => m.type === 'application/x-dtbncx+xml');
  const tocXhtml = list.find(
    (m) => /toc\.x?html?$/i.test(m.href) || /\/toc\./i.test(m.href),
  );

  const push = (tocFile: string, href: string, label: string) => {
    if (!href) return;
    const [path, frag = ''] = href.split('#');
    const file = resolvePath(dirname(tocFile), path);
    const title = stripTags(label).replace(/\s+/g, ' ').trim();
    if (!title) return;
    const key = `${file.toLowerCase()}#${frag}::${normalize(title)}`;
    if (seen.has(key)) return;
    seen.add(key);
    entries.push({ file, frag, title });
  };

  const fromHtml = (file: string, html: string) => {
    const section =
      /<nav[^>]*(?:epub:)?type=["']toc["'][^>]*>([\s\S]*?)<\/nav>/i.exec(html) ||
      /<nav[^>]*>([\s\S]*?)<\/nav>/i.exec(html);
    const src = section ? section[1] : html;
    const re = /<a\s[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src))) push(file, m[1], m[2]);
  };

  const fromNcx = (file: string, xml: string) => {
    // label trước content (chuẩn) hoặc ngược lại
    const re1 =
      /<(?:\w+:)?navLabel>\s*<(?:\w+:)?text>([\s\S]*?)<\/(?:\w+:)?text>\s*<\/(?:\w+:)?navLabel>\s*<(?:\w+:)?content\s+[^>]*src=["']([^"']+)["']/gi;
    const re2 =
      /<(?:\w+:)?content\s+[^>]*src=["']([^"']+)["'][^>]*\/>\s*<(?:\w+:)?navLabel>\s*<(?:\w+:)?text>([\s\S]*?)<\/(?:\w+:)?text>/gi;
    let m: RegExpExecArray | null;
    while ((m = re1.exec(xml))) push(file, m[2], m[1]);
    while ((m = re2.exec(xml))) push(file, m[1], m[2]);
  };

  // Ưu tiên lấy nhiều nguồn rồi gộp (Gutenberg: toc.xhtml + ncx)
  for (const src of [nav, tocXhtml, ncx]) {
    if (!src) continue;
    try {
      const data = read(src.href);
      if (/ncx/i.test(src.type) || /\.ncx$/i.test(src.href)) fromNcx(src.href, data);
      else fromHtml(src.href, data);
    } catch {
      /* bỏ nguồn lỗi */
    }
  }
  return entries;
};

const splitByAnchors = (body: string, entries: TocEntry[]) => {
  const marks: { index: number; title: string }[] = [];
  for (const e of entries) {
    if (!e.frag) continue;
    const frag = escapeRe(e.frag);
    // id= hoặc name= (EPUB/HTML cũ); có thể là <a id>, <h2 id>, <div id>...
    const m =
      new RegExp(`<[^>]*\\bid=["']${frag}["'][^>]*>`, 'i').exec(body) ||
      new RegExp(`<[^>]*\\bname=["']${frag}["'][^>]*>`, 'i').exec(body);
    if (m && !marks.some((x) => x.index === m.index)) {
      marks.push({ index: m.index, title: e.title });
    }
  }
  marks.sort((a, b) => a.index - b.index);
  if (marks.length < 2) return null;
  // Bắt đầu từ mốc đầu tiên (bỏ phần trước chương 1 nếu là front matter)
  return marks.map((m, i) => ({
    title: m.title,
    html: body.slice(m.index, marks[i + 1] ? marks[i + 1].index : body.length),
  }));
};

/** Tách file lớn theo heading h1–h2 khi TOC không đủ mốc */
const splitByHeadings = (body: string) => {
  const re = /<h([12])\b[^>]*>([\s\S]*?)<\/h\1>/gi;
  const marks: { index: number; title: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) {
    const title = stripTags(m[2]).replace(/\s+/g, ' ').trim();
    if (!title || title.length > 120) continue;
    if (SKIP_TITLE.test(title) || SKIP_WORD.test(title)) continue;
    marks.push({ index: m.index, title });
  }
  if (marks.length < 2) return null;
  return marks.map((mk, i) => ({
    title: mk.title,
    html: body.slice(mk.index, marks[i + 1] ? marks[i + 1].index : body.length),
  }));
};

/**
 * Suy tiêu đề chuẩn từ HTML chương:
 * 1) h1–h3  2) dòng mở đầu dạng «1. – TÊN»  3) khớp mục lục  4) dòng đầu ngắn
 * Bỏ tiền tố trùng tên sách (thường Calibre nhúng vào mọi trang).
 */
const inferChapterTitle = (
  html: string,
  opts: { bookTitle?: string; tocTitles?: string[]; tocHint?: string },
): string => {
  const { bookTitle = '', tocTitles = [], tocHint = '' } = opts;
  const h = /<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/i.exec(html);
  if (h) {
    const t = stripTags(h[1]).replace(/\s+/g, ' ').trim();
    if (t && t.length <= 160 && !SKIP_TITLE.test(t)) return t;
  }

  let text = stripTags(html).replace(/\s+/g, ' ').trim();
  if (bookTitle) {
    const bt = bookTitle.replace(/\s+/g, ' ').trim();
    if (bt && text.toLowerCase().startsWith(bt.toLowerCase())) {
      text = text.slice(bt.length).replace(/^[\s\-–—:：|]+/, '').trim();
    }
  }

  // «1. – TÊN CHƯƠNG» ở đầu trang (sau khi bỏ tên sách)
  const numSimple = /^(\d+)\s*[.．。:：)）]?\s*[—–\-−]*\s*(.+)$/u.exec(text);
  if (numSimple) {
    let rest = numSimple[2].trim();
    const n = numSimple[1];
    // Ưu tiên tiêu đề đúng trong mục lục cùng số thứ tự
    const byNum = tocTitles.find((tt) => {
      const m = NUMBERED_TITLE.exec(tt.trim());
      return m && m[1] === n;
    });
    if (byNum) return byNum.replace(/\s+/g, ' ').trim();

    const cut = rest.match(
      /^(.{2,100}?)(?:\s+(?:Khi|Ông|Bào|Thầy|Quân|Nước|Một|Trương|Vua|Bà|Người|Ngày)\b|$)/u,
    );
    if (cut) rest = cut[1].trim();
    rest = rest.replace(/[\s.,;:]+$/u, '').trim();
    if (rest.length >= 2 && rest.length <= 120) {
      return `${n}. – ${rest}`.replace(/\s+/g, ' ').trim();
    }
  }

  // Khớp mục lục chỉ ở **đầu** nội dung (tránh dính danh sách TOC nhúng cuối trang)
  const normText = normalize(text);
  let best = '';
  for (const tt of tocTitles) {
    const nt = normalize(tt);
    if (!nt || nt.length < 3) continue;
    if (normText.startsWith(nt) || normText.startsWith(nt.slice(0, Math.min(nt.length, 48)))) {
      if (nt.length > normalize(best).length) best = tt.replace(/\s+/g, ' ').trim();
    }
  }
  if (best) return best;

  if (tocHint && tocHint.length <= 160 && !SKIP_TITLE.test(tocHint)) {
    const nh = normalize(tocHint);
    if (nh && (normText.startsWith(nh) || normText.startsWith(nh.slice(0, Math.min(30, nh.length))))) {
      return tocHint.replace(/\s+/g, ' ').trim();
    }
  }

  const firstChunk = text.slice(0, 90).trim();
  if (
    firstChunk.length >= 3 &&
    firstChunk.length <= 80 &&
    !META_PAGE.test(firstChunk) &&
    !/^ghi\s*chú/i.test(firstChunk)
  ) {
    return firstChunk;
  }
  return '';
};

function findCoverPath(
  opfXml: string,
  manifest: Record<string, ManifestItem>,
  readText: (p: string) => string | undefined,
  binaryKeys: string[],
): string | null {
  const byProp = Object.values(manifest).find((m) => /\bcover-image\b/i.test(m.props));
  if (byProp && (IMAGE_EXT.test(byProp.href) || /^image\//i.test(byProp.type))) return byProp.href;

  const meta =
    /<(?:\w+:)?meta\b[^>]*name\s*=\s*["']cover["'][^>]*content\s*=\s*["']([^"']+)["'][^>]*\/?>/i.exec(opfXml) ||
    /<(?:\w+:)?meta\b[^>]*content\s*=\s*["']([^"']+)["'][^>]*name\s*=\s*["']cover["'][^>]*\/?>/i.exec(opfXml);
  if (meta) {
    const item = manifest[meta[1]];
    if (item) {
      if (IMAGE_EXT.test(item.href) || /^image\//i.test(item.type)) return item.href;
      if (/x?html/i.test(item.type)) {
        const html = readText(item.href);
        if (html) {
          const img = /<img\b[^>]*src\s*=\s*["']([^"']+)["']/i.exec(html);
          if (img) return resolvePath(dirname(item.href), img[1]);
        }
      }
    }
  }

  for (const [id, m] of Object.entries(manifest)) {
    if (/cover/i.test(id) || /cover/i.test(m.href)) {
      if (IMAGE_EXT.test(m.href) || /^image\//i.test(m.type)) return m.href;
      if (/x?html/i.test(m.type)) {
        const html = readText(m.href);
        if (html) {
          const img = /<img\b[^>]*src\s*=\s*["']([^"']+)["']/i.exec(html);
          if (img) return resolvePath(dirname(m.href), img[1]);
        }
      }
    }
  }

  for (const key of binaryKeys) {
    if (/cover/i.test(key) && IMAGE_EXT.test(key)) return key;
  }
  return null;
}

/** Parse EPUB từ ArrayBuffer */
export async function parseEpubBuffer(buf: ArrayBuffer): Promise<EpubParseResult> {
  if (buf.byteLength < 4) throw new Error('File EPUB không hợp lệ hoặc rỗng');
  const head = new Uint8Array(buf, 0, 2);
  if (head[0] !== 0x50 || head[1] !== 0x4b) throw new Error('File không phải định dạng EPUB/ZIP');

  const zip = await readZip(buf);
  const read = (p: string) => {
    const v = getZipEntry(zip.text, p);
    if (v == null) throw new Error(`File EPUB thiếu: ${p}`);
    return v;
  };
  const tryRead = (p: string) => getZipEntry(zip.text, p);

  let container: string;
  try {
    container = read('META-INF/container.xml');
  } catch {
    throw new Error('EPUB thiếu META-INF/container.xml — file có thể hỏng hoặc không phải EPUB chuẩn');
  }

  const rf = /full-path\s*=\s*["']([^"']+)["']/i.exec(container);
  if (!rf) throw new Error('EPUB thiếu đường dẫn package (.opf) trong container.xml');
  const opfPath = rf[1];
  const opfDir = dirname(opfPath);

  let opfXml: string;
  try {
    opfXml = read(opfPath);
  } catch {
    throw new Error(`Không đọc được file package EPUB (${opfPath})`);
  }

  const titleMatch =
    /<dc:title[^>]*>([\s\S]*?)<\/dc:title>/i.exec(opfXml) ||
    /<title[^>]*>([\s\S]*?)<\/title>/i.exec(opfXml);
  const bookTitle = titleMatch ? stripTags(titleMatch[1]) : '';

  const collectDc = (tag: string): string[] => {
    const re = new RegExp(`<dc:${tag}[^>]*>([\\s\\S]*?)<\\/dc:${tag}>`, 'gi');
    const out: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(opfXml))) {
      const v = stripTags(m[1]);
      if (v && !out.some((x) => normalize(x) === normalize(v))) out.push(v);
    }
    return out;
  };
  const authors = collectDc('creator');
  const publishers = collectDc('publisher');
  const subjects = collectDc('subject');
  const bookDescription = collectDc('description').join('\n\n').trim();

  const manifest: Record<string, ManifestItem> = {};
  // Calibre: <opf:item ...>
  const itemRe = /<(?:\w+:)?item\b([^>]*)\/?>/gi;
  let im: RegExpExecArray | null;
  while ((im = itemRe.exec(opfXml))) {
    const t = im[1];
    if (/\bidref\s*=/i.test(t)) continue;
    const id = attr(t, 'id');
    const href = attr(t, 'href');
    if (!id || !href) continue;
    manifest[id] = {
      href: resolvePath(opfDir, href),
      type: attr(t, 'media-type') || '',
      props: attr(t, 'properties') || '',
    };
  }

  if (!Object.keys(manifest).length) {
    throw new Error(
      'EPUB không có manifest (danh sách file) — package .opf sai định dạng hoặc namespace không đọc được',
    );
  }

  let coverUrl: string | null = null;
  const coverPath = findCoverPath(opfXml, manifest, tryRead, [...zip.binary.keys()]);
  if (coverPath) {
    const imgBytes = getZipEntry(zip.binary, coverPath);
    if (imgBytes?.length) {
      try {
        coverUrl = await maybeCompressCover(bytesToDataUrl(coverPath, imgBytes));
      } catch {
        coverUrl = null;
      }
    }
  }

  const coverNorm = coverPath ? coverPath.replace(/\\/g, '/').toLowerCase() : '';
  const illustrationCount = [...zip.binary.keys()].filter((k) => {
    if (!IMAGE_EXT.test(k)) return false;
    const kn = k.replace(/\\/g, '/').toLowerCase();
    return !coverNorm || kn !== coverNorm;
  }).length;

  const spineIds: string[] = [];
  const spineRe = /<(?:\w+:)?itemref\b([^>]*)\/?>/gi;
  let sm: RegExpExecArray | null;
  while ((sm = spineRe.exec(opfXml))) {
    const t = sm[1];
    if (/linear\s*=\s*["']no["']/i.test(t)) continue;
    const idref = attr(t, 'idref');
    if (idref) spineIds.push(idref);
  }

  const isHtmlType = (type: string, href: string) => /x?html/i.test(type) || /\.x?html?$/i.test(href);
  const spine = spineIds
    .map((id) => manifest[id])
    .filter((m): m is ManifestItem => !!m && isHtmlType(m.type, m.href));

  if (!spine.length) {
    throw new Error('EPUB không có trang nội dung (spine) — không tách được chương');
  }

  const toc = readToc(manifest, read);
  const tocTitles = toc.map((e) => e.title).filter(Boolean);

  const sameFile = (a: string, b: string) =>
    a.replace(/\\/g, '/').toLowerCase() === b.replace(/\\/g, '/').toLowerCase() ||
    a.replace(/\\/g, '/').toLowerCase().endsWith('/' + b.replace(/\\/g, '/').toLowerCase()) ||
    b.replace(/\\/g, '/').toLowerCase().endsWith('/' + a.replace(/\\/g, '/').toLowerCase());

  /** Spine pages usable as nội dung (bỏ bìa/meta ngắn) */
  type SpinePage = { href: string; html: string; text: string; used: boolean };
  const spinePages: SpinePage[] = [];
  for (const item of spine) {
    try {
      const base = item.href.split('/').pop()?.replace(/\.[^.]+$/, '') ?? '';
      if (SKIP_ANY.test(base) || SKIP_WORD.test(base)) continue;
      const html = extractBody(read(item.href));
      const text = stripTags(html).replace(/\s+/g, ' ').trim();
      if (!text) continue;
      if (text.length < 40 && !/<img\b/i.test(html)) continue;
      spinePages.push({ href: item.href, html, text, used: false });
    } catch {
      /* bỏ */
    }
  }

  const tocTargetCounts = new Map<string, number>();
  for (const e of toc) {
    const k = `${e.file.toLowerCase()}#${(e.frag || '').toLowerCase()}`;
    tocTargetCounts.set(k, (tocTargetCounts.get(k) || 0) + 1);
  }
  const brokenToc =
    toc.length >= 5 &&
    [...tocTargetCounts.values()].some((n) => n >= Math.max(3, Math.floor(toc.length * 0.25)));

  /**
   * Lấy HTML cho 1 mục TOC: ưu tiên file#frag; nếu TOC lệch thì khớp nội dung spine theo tiêu đề.
   */
  const contentForTocEntry = (
    entry: TocEntry,
    next: TocEntry | undefined,
  ): { html: string; source: string } => {
    // 1) Tách theo anchor trong cùng file khi frag hợp lệ và không bị dồn
    const key = `${entry.file.toLowerCase()}#${(entry.frag || '').toLowerCase()}`;
    const crowded = (tocTargetCounts.get(key) || 0) >= 3;

    if (!brokenToc && !crowded) {
      try {
        const body = extractBody(read(entry.file));
        if (entry.frag) {
          const frag = escapeRe(entry.frag);
          const re = new RegExp(`<[^>]*\\bid=["']${frag}["'][^>]*>`, 'i');
          const re2 = new RegExp(`<[^>]*\\bname=["']${frag}["'][^>]*>`, 'i');
          const m = re.exec(body) || re2.exec(body);
          if (m) {
            let end = body.length;
            if (next && sameFile(next.file, entry.file) && next.frag) {
              const nf = escapeRe(next.frag);
              const nm =
                new RegExp(`<[^>]*\\bid=["']${nf}["'][^>]*>`, 'i').exec(body) ||
                new RegExp(`<[^>]*\\bname=["']${nf}["'][^>]*>`, 'i').exec(body);
              if (nm && nm.index > m.index) end = nm.index;
            }
            return { html: body.slice(m.index, end), source: entry.file };
          }
        }
        // Cả file chỉ thuộc 1 mục TOC
        const onlyThis = toc.filter((e) => sameFile(e.file, entry.file)).length === 1;
        if (onlyThis) return { html: body, source: entry.file };
      } catch {
        /* fallback */
      }
    }

    // 2) Khớp spine theo tiêu đề (TOC lệch file — Calibre)
    const nt = normalize(entry.title);
    const numM = NUMBERED_TITLE.exec(entry.title.trim());
    let bestIdx = -1;
    let bestScore = 0;
    for (let i = 0; i < spinePages.length; i++) {
      const p = spinePages[i];
      if (p.used) continue;
      let head = p.text;
      if (bookTitle) {
        const bt = bookTitle.replace(/\s+/g, ' ').trim();
        if (bt && head.toLowerCase().startsWith(bt.toLowerCase())) {
          head = head.slice(bt.length).replace(/^[\s\-–—:：|]+/, '').trim();
        }
      }
      const nh = normalize(head);
      let score = 0;
      if (nt && (nh.startsWith(nt) || nh.startsWith(nt.slice(0, Math.min(nt.length, 40))))) {
        score = 100 + Math.min(nt.length, 50);
      } else if (numM) {
        const bodyNum = NUMBERED_TITLE.exec(head);
        if (bodyNum && bodyNum[1] === numM[1]) score = 80;
      }
      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }
    if (bestIdx >= 0 && bestScore >= 80) {
      spinePages[bestIdx].used = true;
      return { html: spinePages[bestIdx].html, source: spinePages[bestIdx].href };
    }

    // 3) Thử đọc đúng file TOC ghi (dù crowded) — lấy cả trang nếu còn
    try {
      const body = extractBody(read(entry.file));
      if (stripTags(body).length >= 40) return { html: body, source: entry.file };
    } catch {
      /* */
    }

    return { html: '', source: entry.file || '' };
  };

  // ——— Nguồn chính: từng mục trong mục lục (đầy đủ danh mục) ———
  type Section = { title: string; html: string; source: string; fromToc: boolean };
  const sections: Section[] = [];

  if (toc.length > 0) {
    for (let i = 0; i < toc.length; i++) {
      const entry = toc[i];
      const title = (entry.title || '').replace(/\s+/g, ' ').trim();
      if (!title) continue;
      // Chỉ bỏ hẳn trang mang tên «Mục lục / Contents» (không phải các mục con)
      if (SKIP_TITLE.test(title) && !NUMBERED_TITLE.test(title)) continue;

      const { html, source } = contentForTocEntry(entry, toc[i + 1]);
      sections.push({ title, html, source, fromToc: true });
    }
  }

  // Fallback khi không có TOC: mỗi spine 1 phần (như trước)
  if (!sections.length) {
    for (const p of spinePages) {
      const title = inferChapterTitle(p.html, { bookTitle, tocTitles: [] });
      sections.push({ title, html: p.html, source: p.href, fromToc: false });
    }
  }

  // Bổ sung spine còn thừa chưa khớp TOC (tránh sót nội dung)
  if (toc.length > 0) {
    for (const p of spinePages) {
      if (p.used) continue;
      const plain = p.text;
      if (plain.length < MIN_CHARS) continue;
      if (META_PAGE.test(plain.slice(0, 280)) && plain.length < 800) continue;
      const numberedHits = (plain.match(/(?:^|\s)\d{1,3}\s*[.．—–\-]\s*\S/g) || []).length;
      if (numberedHits >= 8 && plain.length < 12000) continue; // mục lục nhúng
      const title = inferChapterTitle(p.html, { bookTitle, tocTitles });
      // Chỉ thêm nếu suy được tiêu đề “chương” — tránh nhét trang meta
      if (!title) continue;
      if (SKIP_TITLE.test(title)) continue;
      sections.push({ title, html: p.html, source: p.href, fromToc: false });
      p.used = true;
    }
  }

  if (!sections.length) throw new Error('Không đọc được nội dung chương nào trong EPUB');

  type Raw = {
    index: number;
    title: string;
    html: string;
    textLength: number;
    skipped: boolean;
    reason: string | null;
    source: string;
    fromToc: boolean;
  };

  const raw: Raw[] = sections.map((s, i) => {
    const base = s.source.split('/').pop()?.replace(/\.[^.]+$/, '') ?? '';
    let title = (s.title || '').replace(/\s+/g, ' ').trim();
    if (/^nhời\s*nói\s*đầu/i.test(title)) title = title.replace(/^nhời/i, 'Lời');

    // TOC đã có title chuẩn — chỉ suy lại khi thiếu
    if (!title) {
      title = inferChapterTitle(s.html, { bookTitle, tocTitles, tocHint: s.title });
    }

    const html = s.html ? cleanChapterHtml(s.html, title, s.source, zip.binary) : '';
    const textLength = stripTags(html).length;
    const plain = stripTags(html);
    const hasInlineImg = /<img\b/i.test(html);
    const numberedHits = (plain.match(/(?:^|\s)\d{1,3}\s*[.．—–\-]\s*\S/g) || []).length;

    let reason: string | null = null;
    // Mục từ TOC: giữ lại kể cả hơi ngắn (trừ trang rỗng / bìa thuần)
    const minKeep = s.fromToc ? 30 : MIN_CHARS;

    if (SKIP_ANY.test(base) && !s.fromToc) {
      reason = 'không phải chương (bìa/mục lục/bản quyền)';
    } else if (SKIP_TITLE.test(title) && !NUMBERED_TITLE.test(title)) {
      reason = 'trang mục lục / contents';
    } else if (hasInlineImg && textLength <= IMAGE_ONLY_MAX_TEXT && !s.fromToc) {
      reason = 'trang chỉ có ảnh minh họa';
    } else if (textLength < minKeep && !s.fromToc) {
      reason = `quá ngắn (< ${minKeep} ký tự)`;
    } else if (!s.fromToc && META_PAGE.test(plain.slice(0, 280)) && textLength < 800) {
      reason = 'trang meta sản xuất ebook';
    } else if (!s.fromToc && numberedHits >= 8 && textLength < 12000) {
      reason = 'trang mục lục nhúng trong nội dung';
    } else if (s.fromToc && textLength === 0) {
      // Vẫn giữ mục TOC (đủ danh mục); nội dung trống — user có thể sửa sau
      reason = null;
    }

    return {
      index: i + 1,
      title,
      html,
      textLength,
      skipped: !!reason,
      reason,
      source: s.source,
      fromToc: s.fromToc,
    };
  });

  const kept = raw.filter((c) => !c.skipped);
  if (!kept.length) {
    throw new Error(
      'EPUB không còn chương nội dung sau khi lọc (bìa/mục lục/quá ngắn). Thử file khác.',
    );
  }

  // Đánh số chương 1..n chỉ phần tích; phần phụ mục lục vẫn hiện nhưng không tích
  let storyN = 0;
  const chapters: EpubParsedChapter[] = kept.map((c) => {
    let title = (c.title || '').replace(/\s+/g, ' ').trim();
    if (/^nhời\s*nói\s*đầu/i.test(title)) title = title.replace(/^nhời/i, 'Lời');

    const plainHead = (() => {
      let t = stripTags(c.html).replace(/\s+/g, ' ').trim();
      const bt = bookTitle.replace(/\s+/g, ' ').trim();
      if (bt && t.toLowerCase().startsWith(bt.toLowerCase())) {
        t = t.slice(bt.length).replace(/^[\s\-–—:：|]+/, '').trim();
      }
      return t.slice(0, 120);
    })();

    const front =
      isFrontMatterTitle(title) ||
      isFrontMatterTitle(plainHead) ||
      /^ghi\s*chú\b/i.test(plainHead);

    const story = !front && countsAsStoryChapter(title);

    if (!story) {
      if (!title || /^chương\s+\d+$/i.test(title)) {
        if (/^ghi\s*chú/i.test(plainHead)) title = 'Ghi chú';
        else if (isFrontMatterTitle(plainHead)) {
          const m = plainHead.match(/^[^.]{3,60}/);
          title = (m ? m[0] : title || 'Phần phụ').replace(/\s+/g, ' ').trim();
        } else title = title || 'Phần phụ';
      }
      return {
        chapterNumber: 0,
        title: title || 'Phần phụ',
        content: c.html,
        textLength: c.textLength,
        countsAsChapter: false,
      };
    }

    storyN += 1;
    return {
      chapterNumber: storyN,
      title: title || `Chương ${storyN}`,
      content: c.html,
      textLength: c.textLength,
      countsAsChapter: true,
    };
  });

  const storyCount = chapters.filter((c) => c.countsAsChapter !== false).length;
  return {
    title: bookTitle,
    description: bookDescription,
    authors,
    publishers,
    subjects,
    coverUrl,
    illustrationCount,
    tocTitles,
    chapterCount: storyCount,
    chapters,
    skipped: raw.filter((c) => c.skipped).map((c) => ({ title: c.title || c.source, reason: c.reason })),
  };
}

export async function parseEpubFile(file: File): Promise<EpubParseResult> {
  if (!file || file.size === 0) throw new Error('File EPUB rỗng');
  if (file.size > 40 * 1024 * 1024) throw new Error('File EPUB tối đa 40MB');
  const name = (file.name || '').toLowerCase();
  if (name && !name.endsWith('.epub') && file.type && file.type !== 'application/epub+zip' && file.type !== 'application/zip') {
    throw new Error('Chỉ chấp nhận file .epub');
  }
  try {
    return await parseEpubBuffer(await file.arrayBuffer());
  } catch (e) {
    if (e instanceof Error) throw e;
    throw new Error('Không đọc được file EPUB');
  }
}

export async function parseEpubUrl(url: string): Promise<EpubParseResult> {
  const u = url.trim();
  if (!/^https?:\/\//i.test(u)) throw new Error('URL phải bắt đầu bằng http:// hoặc https://');
  let res: Response;
  try {
    res = await fetch(u);
  } catch {
    throw new Error('Không tải được URL (mạng lỗi hoặc bị chặn CORS). Hãy tải file về máy rồi chọn từ máy.');
  }
  if (!res.ok) throw new Error(`Không tải được EPUB từ URL (HTTP ${res.status})`);
  const buf = await res.arrayBuffer();
  if (buf.byteLength > 40 * 1024 * 1024) throw new Error('File EPUB tối đa 40MB');
  if (buf.byteLength < 4) throw new Error('Nội dung tải về không phải file EPUB hợp lệ');
  return parseEpubBuffer(buf);
}