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
