# Online Book Reader

He thong doc sach online - Client (React) + Server (Node.js/Express) + MySQL.

## Cong nghe
| Thanh phan | Cong nghe |
|---|---|
| Frontend | React, TypeScript, Vite |
| Backend | Node.js, Express |
| Database | MySQL |

## Cau truc thu muc

```
OnlineBookReader/
├── backend/              <- API (Node.js/Express) chui vao day
│   ├── src/
│   │   ├── config/       (Ket noi DB, doc bien moi truong)
│   │   ├── controllers/  (Logic xu ly nghiep vu)
│   │   ├── middlewares/  (Kiem tra JWT dang nhap)
│   │   ├── routes/       (Khai bao duong dan API)
│   │   ├── utils/        (Ham dung chung: response, validate...)
│   │   └── server.js     (File goc de chay server)
│   ├── database/migrations/  (File .sql tao bang, chay tay tren MySQL)
│   ├── .env.example
│   └── package.json
│
├── frontend/              <- Giao dien (React) chui vao day
│   ├── src/
│   │   ├── assets/       (Anh, icon, CSS chung)
│   │   ├── components/   (Cac cuc UI dung lai nhieu lan)
│   │   ├── pages/         (Cac trang: LoginPage, HomePage...)
│   │   ├── services/     (File goi API tu backend)
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── .env.example
│   └── package.json
│
└── .gitignore
```

## Cai dat

### Backend
```bash
cd backend
npm install
cp .env.example .env   # dien thong tin MySQL that vao day
npm run dev
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## Database
1. Tao database `online_book_reader` tren MySQL.
2. Chay lan luot cac file trong `backend/database/migrations/` theo thu tu so (001, 002...).

## Cach chay du an

### 1. Co so du lieu
```bash
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS online_book_reader CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -u root -p online_book_reader < backend/database/migrations/001_create_users.sql
```
Cac migration sau chay theo thu tu so (002, 003, ...).

### 2. Backend (cong 5000)
```bash
cd backend
cp .env.example .env      # Windows: copy .env.example .env, roi dien DB_PASSWORD, JWT_SECRET
npm install
npm run dev
```
Kiem tra: mo http://localhost:5000 se thay `{"success":true,...}`.

### 3. Frontend (cong 3000)
```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

## Quy uoc
Xem file `CLAUDE.md` (quy uoc code, quy tac nghiep vu, quy trinh Git).
