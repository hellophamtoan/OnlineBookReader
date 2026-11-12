/**
 * Xuất .xlsx (OOXML, sharedStrings) — tiêu đề gộp cột, header, dữ liệu; ≤40 ký tự/ô.
 */

const MAX = 40;

export type ExcelStyle = 'title' | 'section' | 'header' | 'normal' | 'number';
export type ExcelCell = { v: string | number; style?: ExcelStyle; mergeAcross?: number };
export type ExcelRow = ExcelCell[];
export type ExcelSheet = { name: string; rows: ExcelRow[]; colCount?: number };

// [Xử lý] Cắt nội dung ô quá dài.
export function clipCell(v: string | number | null | undefined, max = MAX): string {
  const s = String(v ?? '').trim();
  return s.length <= max ? s : `${s.slice(0, max - 1)}…`;
}

// [Xử lý] Dòng tiêu đề mục.
export function sectionRow(text: string, colCount: number, style: ExcelStyle = 'section'): ExcelRow {
  return [{ v: text, style, mergeAcross: Math.max(0, colCount - 1) }];
}

// [Xử lý] Dòng tiêu đề cột.
export function headerRow(labels: string[]): ExcelRow {
  return labels.map((v) => ({ v: clipCell(v), style: 'header' as const }));
}

// [Xử lý] Dòng dữ liệu.
export function valuesRow(vals: (string | number)[]): ExcelRow {
  return vals.map((v) =>
    typeof v === 'number' && Number.isFinite(v)
      ? { v, style: 'number' as const }
      : { v: clipCell(v), style: 'normal' as const },
  );
}

// [Xử lý] Thoát ký tự XML.
function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// [Xử lý] Đổi số cột sang chữ (A, B...).
function colLetter(i0: number) {
  let n = i0 + 1;
  let s = '';
  while (n > 0) {
    s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

const SID: Record<ExcelStyle, number> = { normal: 1, number: 2, header: 3, section: 4, title: 5 };

// [Xử lý] Tính CRC32 cho file zip.
/* ZIP STORE */
function crc32(buf: Uint8Array) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
  }
  return (c ^ 0xffffffff) >>> 0;
}
// [Xử lý] Ghi số 2 byte.
function u16(n: number) {
  const b = new Uint8Array(2);
  new DataView(b.buffer).setUint16(0, n, true);
  return b;
}
// [Xử lý] Ghi số 4 byte.
function u32(n: number) {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setUint32(0, n, true);
  return b;
}
// [Xử lý] Nối các mảng byte.
function cat(parts: Uint8Array[]) {
  const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}
// [Xử lý] Đóng gói file .xlsx (zip).
function zip(files: { path: string; data: Uint8Array }[]) {
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;
  for (const f of files) {
    const name = new TextEncoder().encode(f.path);
    const crc = crc32(f.data);
    const local = cat([
      u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0),
      u32(crc), u32(f.data.length), u32(f.data.length), u16(name.length), u16(0), name, f.data,
    ]);
    const central = cat([
      u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0),
      u32(crc), u32(f.data.length), u32(f.data.length), u16(name.length), u16(0), u16(0),
      u16(0), u16(0), u32(0), u32(offset), name,
    ]);
    locals.push(local);
    centrals.push(central);
    offset += local.length;
  }
  const dir = cat(centrals);
  return new Blob(
    [cat([...locals, dir, cat([u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length), u32(dir.length), u32(offset), u16(0)])])],
    { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
  );
}

// [Xử lý] Định dạng ô Excel.
function stylesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="6">
    <font><sz val="11"/><name val="Calibri"/></font>
    <font><sz val="11"/><name val="Calibri"/></font>
    <font><sz val="11"/><name val="Calibri"/></font>
    <font><b/><sz val="11"/><name val="Calibri"/></font>
    <font><b/><sz val="13"/><name val="Calibri"/></font>
    <font><b/><sz val="16"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
  </fonts>
  <fills count="5">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF1F4E79"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFD6E4F0"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFE8EEF7"/></patternFill></fill>
  </fills>
  <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="6">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="1" fontId="2" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="3" fillId="4" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="4" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="5" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
  </cellXfs>
</styleSheet>`;
}

// [Xử lý] Nội dung sheet Excel.
function sheetXml(rowsIn: ExcelRow[], colCount: number, shared: string[], idx: (s: string) => number) {
  const rows = rowsIn.map((r) => (r?.length ? r : [{ v: '', style: 'normal' as const }]));
  const merges: string[] = [];
  const body: string[] = [];

  rows.forEach((row, ri) => {
    const r = ri + 1;
    let c = 0;
    const cells: string[] = [];
    for (const cell of row) {
      const style = cell.style ?? (typeof cell.v === 'number' ? 'number' : 'normal');
      const ref = `${colLetter(c)}${r}`;
      const span = Math.max(0, cell.mergeAcross ?? 0);
      if (span) merges.push(`<mergeCell ref="${ref}:${colLetter(c + span)}${r}"/>`);
      if (typeof cell.v === 'number' && Number.isFinite(cell.v) && style === 'number') {
        cells.push(`<c r="${ref}" s="${SID[style]}"><v>${cell.v}</v></c>`);
      } else {
        cells.push(`<c r="${ref}" s="${SID[style]}" t="s"><v>${idx(clipCell(cell.v))}</v></c>`);
      }
      c += 1 + span;
    }
    while (c < colCount) {
      cells.push(`<c r="${colLetter(c)}${r}" s="1" t="s"><v>${idx('')}</v></c>`);
      c++;
    }
    const ht = row[0]?.style === 'title' ? ' ht="30"' : row[0]?.style === 'section' ? ' ht="24"' : '';
    body.push(`<row r="${r}"${ht} spans="1:${colCount}">${cells.join('')}</row>`);
  });

  const w = colCount <= 2 ? 32 : colCount === 4 ? 24 : 18;
  const cols = Array.from({ length: colCount }, (_, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('');
  const merge = merges.length ? `<mergeCells count="${merges.length}">${merges.join('')}</mergeCells>` : '';

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <dimension ref="A1:${colLetter(Math.max(0, colCount - 1))}${Math.max(1, rows.length)}"/>
  <sheetViews><sheetView workbookViewId="0"/></sheetViews>
  <sheetFormatPr defaultRowHeight="18"/>
  <cols>${cols}</cols>
  <sheetData>${body.join('')}</sheetData>
  ${merge}
  <pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.3" footer="0.3"/>
  <pageSetup orientation="landscape" fitToWidth="1" fitToHeight="0" paperSize="9"/>
</worksheet>`;
}

// [Xử lý] Admin > Báo cáo: tạo và tải file Excel báo cáo về máy.
/** Tải file .xlsx */
export function downloadExcelXml(filename: string, sheets: ExcelSheet[]) {
  const enc = new TextEncoder();
  const shared: string[] = [];
  const idx = (s: string) => {
    let i = shared.indexOf(s);
    if (i < 0) {
      i = shared.length;
      shared.push(s);
    }
    return i;
  };

  const names = sheets.map((s, i) => s.name.replace(/[\\/*?:\[\]]/g, '_').slice(0, 31) || `Sheet${i + 1}`);
  const sheetFiles = sheets.map((s) => {
    const cols =
      s.colCount ??
      Math.max(2, ...s.rows.map((r) => r.reduce((n, c) => n + 1 + (c.mergeAcross ?? 0), 0)));
    return sheetXml(s.rows, cols, shared, idx);
  });

  const files: { path: string; data: Uint8Array }[] = [
    {
      path: '[Content_Types].xml',
      data: enc.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  <Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>
  ${sheetFiles.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}
</Types>`),
    },
    {
      path: '_rels/.rels',
      data: enc.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`),
    },
    {
      path: 'xl/workbook.xml',
      data: enc.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
 xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>${names.map((n, i) => `<sheet name="${esc(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets>
</workbook>`),
    },
    {
      path: 'xl/_rels/workbook.xml.rels',
      data: enc.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${names.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}
  <Relationship Id="rId${names.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  <Relationship Id="rId${names.length + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>
</Relationships>`),
    },
    { path: 'xl/styles.xml', data: enc.encode(stylesXml()) },
    {
      path: 'xl/sharedStrings.xml',
      data: enc.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${shared.length}" uniqueCount="${shared.length}">
${shared.map((s) => `<si><t>${esc(s)}</t></si>`).join('')}
</sst>`),
    },
  ];

  sheetFiles.forEach((xml, i) => {
    files.push({ path: `xl/worksheets/sheet${i + 1}.xml`, data: enc.encode(xml) });
  });

  const blob = zip(files);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.xlsx') ? filename : `${filename.replace(/\.xls$/i, '')}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
