#!/usr/bin/env node
// scripts/import-epub.js
// Nhập sách từ file EPUB: tách chương -> làm sạch HTML -> gọi API thêm chương (POST /admin/books/:id/chapters).
// Dùng lại validate, làm sạch và phân quyền của backend, nên cần backend đang chạy và tài khoản ADMIN.
const fs = require('fs');
const { parseEpub } = require('./lib/epub');

const HELP = `Cách dùng:
  Xem trước (không cần backend):
    node scripts/import-epub.js <file.epub> --dry-run
  Nhập vào hệ thống:
    node scripts/import-epub.js <file.epub> --book <mã sách>
  Cần đặt 2 biến môi trường (không gõ mật khẩu trên dòng lệnh):
    IMPORT_EMAIL, IMPORT_PASSWORD    tài khoản ADMIN
    IMPORT_API                       mặc định http://localhost:5000/api

Tùy chọn:
  --dry-run           chỉ in danh sách chương tìm được rồi dừng
  --book <id>         mã sách (sách phải bật hasEbook)
  --start <n>         số chương bắt đầu (mặc định 1)
  --skip 1,2,5        bỏ các dòng có STT này trong danh sách xem trước
  --skip-pattern <re> bỏ thêm chương có tên/file khớp biểu thức chính quy
  --min-chars <n>     bỏ chương ngắn hơn n ký tự (mặc định 200)
`;

const parseArgs = (argv) => {
  const a = { file: null, dryRun: false, book: null, start: 1, skip: [], skipPattern: null, minChars: 200 };
  for (let i = 0; i < argv.length; i += 1) {
    const k = argv[i];
    if (k === '--dry-run') a.dryRun = true;
    else if (k === '--book') a.book = argv[++i];
    else if (k === '--start') a.start = Number(argv[++i]);
    else if (k === '--skip') a.skip = String(argv[++i]).split(',').map(Number).filter(Boolean);
    else if (k === '--skip-pattern') a.skipPattern = argv[++i];
    else if (k === '--min-chars') a.minChars = Number(argv[++i]);
    else if (k === '--help' || k === '-h') a.help = true;
    else if (!k.startsWith('--') && !a.file) a.file = k;
    else throw new Error(`Tham số không hợp lệ: ${k}`);
  }
  return a;
};

const api = async (base, path, { method = 'GET', token, body } = {}) => {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  let json = null;
  try { json = await res.json(); } catch { /* phản hồi không phải JSON */ }
  return { status: res.status, json };
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.file) { console.log(HELP); return; }
  if (!fs.existsSync(args.file)) throw new Error(`Không tìm thấy file: ${args.file}`);
  if (!Number.isInteger(args.start) || args.start < 1) throw new Error('--start phải là số nguyên dương');

  const { title, chapters } = parseEpub(fs.readFileSync(args.file), { minChars: args.minChars, skipPattern: args.skipPattern });
  for (const c of chapters) if (args.skip.includes(c.index) && !c.skipped) { c.skipped = true; c.reason = 'bỏ theo --skip'; }

  console.log(`Sách: ${title || '(không rõ tên)'}`);
  console.log('STT  Số chương  Ký tự   Tên chương');
  let n = args.start - 1;
  for (const c of chapters) {
    if (!c.skipped) { n += 1; c.number = n; }
    const num = c.skipped ? '   -   ' : String(c.number).padStart(6);
    console.log(`${String(c.index).padStart(3)}  ${num}   ${String(c.textLength).padStart(7)}  ${c.title || '(chưa có tên)'}${c.skipped ? `   [BỎ: ${c.reason}]` : ''}`);
  }
  const keep = chapters.filter((c) => !c.skipped);
  console.log(`\nGiữ ${keep.length}/${chapters.length} phần.`);
  if (!keep.length) throw new Error('Không có chương nào để nhập');
  if (args.dryRun) { console.log('Chế độ xem trước: chưa gửi gì lên hệ thống.'); return; }

  if (!args.book || !/^\d+$/.test(args.book)) throw new Error('Thiếu --book <mã sách>');
  const { IMPORT_EMAIL: email, IMPORT_PASSWORD: password } = process.env;
  if (!email || !password) throw new Error('Thiếu biến môi trường IMPORT_EMAIL / IMPORT_PASSWORD');
  const base = (process.env.IMPORT_API || 'http://localhost:5000/api').replace(/\/+$/, '');

  const login = await api(base, '/auth/login', { method: 'POST', body: { email, password } });
  if (login.status !== 200) throw new Error(`Đăng nhập thất bại (${login.status}): ${login.json && login.json.message}`);
  const token = login.json.data.token;

  let ok = 0;
  let fail = 0;
  for (const c of keep) {
    const res = await api(base, `/admin/books/${args.book}/chapters`, {
      method: 'POST', token,
      body: { chapterNumber: c.number, title: c.title.slice(0, 255), content: c.html }
    });
    if (res.status === 201) { ok += 1; console.log(`  OK    chương ${c.number}: ${c.title}`); }
    else { fail += 1; console.log(`  LỖI   chương ${c.number}: ${c.title} -> ${res.status} ${(res.json && res.json.message) || ''}`); }
  }
  console.log(`\nXong: ${ok} chương thành công, ${fail} lỗi.`);
  if (fail) process.exitCode = 1;
};

main().catch((e) => { console.error(`Lỗi: ${e.message}`); process.exit(1); });
