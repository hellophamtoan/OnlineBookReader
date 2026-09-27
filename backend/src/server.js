// server.js
// File goc de chay server backend.

const { validateEnv } = require('./config/env.config');
validateEnv();

const express = require('express');
const cors = require('cors');
const routes = require('./routes');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'Online Book Reader API dang chay' });
});

app.use('/api', routes);

// Middleware xu ly 404 - dat cuoi cung, sau tat ca route
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Khong tim thay duong dan nay' });
});

app.listen(PORT, () => {
  console.log(`Server dang chay tai http://localhost:${PORT}`);
});
