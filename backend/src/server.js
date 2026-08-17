const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const db = require('./db');

const app = express();
const PORT = Number(process.env.PORT || 5000);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/api/health', async (req, res) => {
  try {
    await db.execute('SELECT 1 AS ok');
    res.json({ status: 'ok', database: 'connected', service: 'FitnessHub API' });
  } catch (e) {
    res.status(503).json({ status: 'error', database: 'disconnected', message: e.message });
  }
});

const frontend = path.join(__dirname, '../../frontend/public');
app.use(express.static(frontend));

async function start() {
  try {
    await db.initDatabase();
    await db.seedDemoData();

    app.use('/api/auth', require('./routes/auth'));
    app.use('/api/dashboard', require('./routes/dashboard'));
    app.use('/api/members', require('./routes/members'));
    app.use('/api/memberships', require('./routes/memberships'));
    app.use('/api/classes', require('./routes/classes'));
    app.use('/api/bookings', require('./routes/bookings'));
    app.use('/api/attendance', require('./routes/attendance'));
    app.use('/api/payments', require('./routes/payments'));
    app.use('/api/progress', require('./routes/progress'));

    app.use((req, res, next) => {
      if (req.path.startsWith('/api/')) return res.status(404).json({ message: 'API endpoint not found.' });
      res.sendFile(path.join(frontend, 'index.html'));
    });

    app.use((err, req, res, next) => {
      console.error(err);
      res.status(500).json({ message: 'Internal server error.', detail: err.message });
    });

    app.listen(PORT, () => {
      console.log(`\nFitnessHub is running at http://localhost:${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/api/health`);
      console.log('MySQL connection: READY\n');
    });
  } catch (err) {
    console.error('\nUnable to start FitnessHub.');
    console.error('MySQL error:', err.message);
    console.error('\nMake sure MySQL/XAMPP is running and check backend/.env.');
    process.exit(1);
  }
}

start();
