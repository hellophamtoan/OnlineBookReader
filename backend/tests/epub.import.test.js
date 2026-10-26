// Unit test script nhập EPUB: tạo file EPUB giả trong bộ nhớ, không cần file thật.
const AdmZip = require('adm-zip');
const { parseEpub, sanitizeChapterHtml } = require('../scripts/lib/epub');

const LONG = 'Nội dung của chương này đủ dài để không bị coi là quá ngắn. '.repeat(8);
const page = (inner) => `<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>x</title><style>p{color:red}</style></head><body>${inner}</body></html>`;

const build = (files) => {
  const zip = new AdmZip();
  zip.addFile('mimetype', Buffer.from('application/epub+zip'));
  zip.addFile('META-INF/container.xml', Buffer.from(
    '<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>'));
  for (const [name, content] of Object.entries(files)) zip.addFile(name, Buffer.from(content));
  return zip.toBuffer();
};

const opf = (manifest, spine, extra = '') => `<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0">
<metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>Sách Thử</dc:title></metadata>
<manifest>${manifest}</manifest><spine ${extra}>${spine}</spine></package>`;

describe('parseEpub - EPUB3 (nav)', () => {
  const epub = build({
    'OEBPS/content.opf': opf(
      '<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>' +
      '<item id="cover" href="cover.xhtml" media-type="application/xhtml+xml"/>' +
      '<item id="c1" href="Text/ch1.xhtml" media-type="application/xhtml+xml"/>' +
      '<item id="c2" href="Text/ch2.xhtml" media-type="application/xhtml+xml"/>' +
      '<item id="tiny" href="Text/tiny.xhtml" media-type="application/xhtml+xml"/>' +
      '<item id="img" href="Images/a.jpg" media-type="image/jpeg"/>',
      '<itemref idref="cover"/><itemref idref="nav"/><itemref idref="c1"/><itemref idref="c2"/><itemref idref="tiny"/>'),
    'OEBPS/nav.xhtml': page('<nav epub:type="toc"><ol><li><a href="Text/ch1.xhtml">Chương Một</a></li><li><a href="Text/ch2.xhtml#sec1">Phần A</a></li><li><a href="Text/ch2.xhtml#sec2">Phần B</a></li></ol></nav>'),
    'OEBPS/cover.xhtml': page('<img src="a.jpg"/>'),
    'OEBPS/Text/ch1.xhtml': page(`<h1>Chương Một</h1><p onclick="x()">${LONG}</p><script>alert(1)</script><img src="x" onerror="alert(1)"/><a href="http://evil">link</a>`),
    'OEBPS/Text/ch2.xhtml': page(`<h2 id="sec1">Phần A</h2><p>${LONG}</p><h2 id="sec2">Phần B</h2><p>${LONG}</p>`),
    'OEBPS/Text/tiny.xhtml': page('<p>ngắn</p>')
  });
  const { title, chapters } = parseEpub(epub);

  test('Đọc được tên sách', () => expect(title).toBe('Sách Thử'));
  test('Bỏ bìa, mục lục và trang quá ngắn', () => {
    const skipped = chapters.filter((c) => c.skipped).map((c) => c.source.split('/').pop());
    expect(skipped).toEqual(expect.arrayContaining(['cover.xhtml', 'nav.xhtml', 'tiny.xhtml']));
  });
  test('Chia file có 2 mục lục #fragment thành 2 chương, đúng tên và thứ tự', () => {
    expect(chapters.filter((c) => !c.skipped).map((c) => c.title)).toEqual(['Chương Một', 'Phần A', 'Phần B']);
  });
  test('Làm sạch XSS, ảnh, link; giữ chữ', () => {
    const c = chapters.find((x) => x.title === 'Chương Một');
    expect(c.html).not.toMatch(/script|onclick|onerror|<img|<a |href|style/i);
    expect(c.html).toContain('Nội dung của chương này');
  });
  test('Bỏ tiêu đề đầu chương trùng tên chương', () => {
    expect(chapters.find((x) => x.title === 'Chương Một').html).not.toMatch(/<h1>/);
  });
  test('Hai phần cắt theo anchor không lẫn nội dung nhau', () => {
    const a = chapters.find((x) => x.title === 'Phần A');
    const b = chapters.find((x) => x.title === 'Phần B');
    expect(a.html).not.toContain('Phần B');
    expect(a.textLength).toBeGreaterThan(200);
    expect(b.textLength).toBeGreaterThan(200);
  });
});

describe('parseEpub - EPUB2 (ncx), không có mục lục tên chương', () => {
  const epub = build({
    'OEBPS/content.opf': opf(
      '<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>' +
      '<item id="a" href="a.xhtml" media-type="application/xhtml+xml"/>' +
      '<item id="b" href="b.xhtml" media-type="application/xhtml+xml"/>',
      '<itemref idref="a"/><itemref idref="b"/>', 'toc="ncx"'),
    'OEBPS/toc.ncx': '<ncx><navMap><navPoint id="n1"><navLabel><text>Mở đầu</text></navLabel><content src="a.xhtml"/></navPoint></navMap></ncx>',
    'OEBPS/a.xhtml': page(`<p>${LONG}</p>`),
    'OEBPS/b.xhtml': page(`<p>${LONG}</p>`)
  });
  const { chapters } = parseEpub(epub);
  test('Lấy tên từ ncx, chương còn lại đặt tên theo thứ tự', () => {
    expect(chapters.map((c) => c.title)).toEqual(['Mở đầu', 'Chương 2']);
  });
  test('--skip-pattern loại thêm chương', () => {
    const r = parseEpub(epub, { skipPattern: 'mở đầu' });
    expect(r.chapters[0].skipped).toBe(true);
  });
});

describe('Lỗi file', () => {
  test('File không phải EPUB -> báo lỗi rõ ràng', () => {
    expect(() => parseEpub(build({}))).toThrow(/thiếu|EPUB/i);
  });
  test('Làm sạch: chỉ giữ thẻ cho phép', () => {
    expect(sanitizeChapterHtml('<div><h5>T</h5><p>a <em>b</em></p><table><tr><td>x</td></tr></table></div>')).toBe('<div><h4>T</h4><p>a <em>b</em></p>x</div>');
  });
});
