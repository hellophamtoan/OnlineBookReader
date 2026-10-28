// utils/epubParse.ts
// Parse EPUB trên trình duyệt.
// Lọc chương theo logic BE (scripts/lib/epub.js): SKIP bìa/TOC/bản quyền, minChars=200, sanitize HTML.
// Tận dụng thêm (form Thêm sách): ảnh bìa, dc:creator/publisher/description, toc, illustrationCount.
import { sanitizeChapterHtml } from './sanitize';
import type { EpubParseResult, EpubParsedChapter } from '../types';

const SKIP_WORD = /\b(cover|contents|toc|nav|licen[sc]e|endnotes|loi|bìa|mục lục|bản quyền)\b/i;
const SKIP_ANY = /(titlepage|title page|halftitle|copyright|colophon|imprint|pg-header|pg-footer|wrap-0\.html)/i;
/** Tiêu đề mục lục / Gutenberg front matter — không phải chương đọc */
const SKIP_TITLE =
  /^(contents|table of contents|mục lục|project gutenberg|there are two editions|colored illustrations|grimm'?s fairy stories)\b/i;
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
  const sections: { title: string; html: string; source: string }[] = [];

  const sameFile = (a: string, b: string) =>
    a.replace(/\\/g, '/').toLowerCase() === b.replace(/\\/g, '/').toLowerCase() ||
    a.replace(/\\/g, '/').toLowerCase().endsWith('/' + b.replace(/\\/g, '/').toLowerCase()) ||
    b.replace(/\\/g, '/').toLowerCase().endsWith('/' + a.replace(/\\/g, '/').toLowerCase());

  for (const item of spine) {
    try {
      const body = extractBody(read(item.href));
      const entries = toc.filter((e) => sameFile(e.file, item.href));
      let parts =
        entries.filter((e) => e.frag).length >= 2 ? splitByAnchors(body, entries) : null;
      // File dài (Gutenberg gộp nhiều truyện) mà TOC không tách được → tách theo heading
      if (!parts && stripTags(body).length > 8000) {
        parts = splitByHeadings(body);
      }
      if (parts && parts.length >= 2) {
        parts.forEach((p) => sections.push({ ...p, source: item.href }));
      } else {
        sections.push({ title: entries[0]?.title ?? '', html: body, source: item.href });
      }
    } catch {
      /* bỏ trang lỗi */
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
  };

  const raw: Raw[] = sections.map((s, i) => {
    const base = s.source.split('/').pop()?.replace(/\.[^.]+$/, '') ?? '';
    let title = s.title;
    if (!title) {
      const h = /<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/i.exec(s.html);
      title = h ? stripTags(h[1]) : '';
    }
    const html = cleanChapterHtml(s.html, title, s.source, zip.binary);
    const textLength = stripTags(html).length;
    const hasInlineImg = /<img\b/i.test(html);
    let reason: string | null = null;
    if (
      SKIP_ANY.test(base) ||
      SKIP_ANY.test(title) ||
      SKIP_WORD.test(base) ||
      SKIP_WORD.test(title) ||
      SKIP_TITLE.test(title.trim())
    ) {
      reason = 'không phải chương (bìa/mục lục/bản quyền/front matter)';
    } else if (hasInlineImg && textLength <= IMAGE_ONLY_MAX_TEXT) {
      // Spine Gutenberg: mỗi ảnh một trang wrap — không phải chương đọc
      reason = 'trang chỉ có ảnh minh họa';
    } else if (textLength < MIN_CHARS) {
      reason = `quá ngắn (< ${MIN_CHARS} ký tự)`;
    }
    return { index: i + 1, title, html, textLength, skipped: !!reason, reason, source: s.source };
  });

  let n = 0;
  for (const c of raw) {
    if (c.skipped) continue;
    n += 1;
    if (!c.title) c.title = `Chương ${n}`;
  }

  const kept = raw.filter((c) => !c.skipped);
  if (!kept.length) {
    throw new Error(
      'EPUB không còn chương nội dung sau khi lọc (bìa/mục lục/quá ngắn). Thử file khác.',
    );
  }

  const chapters: EpubParsedChapter[] = kept.map((c, i) => ({
    chapterNumber: i + 1,
    title: c.title || `Chương ${i + 1}`,
    content: c.html,
    textLength: c.textLength,
  }));

  return {
    title: bookTitle,
    description: bookDescription,
    authors,
    publishers,
    subjects,
    coverUrl,
    illustrationCount,
    tocTitles,
    chapterCount: chapters.length,
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