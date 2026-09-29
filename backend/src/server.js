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

app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:3000' }));
// Nội dung chương có thể dài nên nới giới hạn body so với mặc định (100kb)
app.use(express.json({ limit: '2mb' }));

app.get('/', (req, res) => {
  res.json({ success: true, message: 'Online Book Reader API đang chạy', data: null });
});

app.use('/api', routes);

// Đặt cuối cùng, sau tất cả route
app.use(notFound);
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server đang chạy tại http://localhost:${PORT}`);
});
