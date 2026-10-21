require('dotenv').config();

const pool = require('./src/config/db.config');

async function testConnection() {
  try {
    const [rows] = await pool.query('SELECT DATABASE() AS db_name, VERSION() AS version');

    console.log('Ket noi MySQL Railway thanh cong!');
    console.log('Database:', rows[0].db_name);
    console.log('MySQL version:', rows[0].version);

    const [tables] = await pool.query('SHOW TABLES');
    console.log('So bang trong database:', tables.length);
  } catch (error) {
    console.error('Ket noi MySQL that bai!');
    console.error('Loi:', error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

testConnection();