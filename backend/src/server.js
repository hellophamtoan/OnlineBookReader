
// server.js
// File gốc để chạy server backend.

const { validateEnv } = require('./config/env.config');
validateEnv();

const express = require('express');
const cors = require('cors');
const routes = require('./routes');
const { notFound, errorHandler } = require('./middlewares/error.middleware');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
  origin: process.env.CORS_ORIGIN || '*'
}));

// Nội dung chương e-book có thể lớn hơn mặc định 100kb
app.use(express.json({ limit: '5mb' }));

app.get('/', (req, res) => {
  res.json({
    message: 'Online Book Reader API dang chay'
  });
});

app.use('/api', routes);

// Xu ly duong dan khong ton tai
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Khong tim thay duong dan nay'
  });
});

app.listen(PORT, () => {
  console.log(`Server đang chạy tại http://localhost:${PORT}`);
});
