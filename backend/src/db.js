const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Defaults friendly to local MySQL/XAMPP/WAMP installations
const config = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'fitnesshub',
  waitForConnections: true,
  connectionLimit: 10,
  namedPlaceholders: true,
  multipleStatements: true
};

let pool = null;
let initialized = false;

async function initDatabase() {
  if (initialized && pool) return pool;

  // First connect without selecting a database so MySQL can create it if missing
  const bootstrap = await mysql.createConnection({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password
  });

  await bootstrap.query(
    `CREATE DATABASE IF NOT EXISTS \`${config.database.replace(/`/g, '')}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
  );
  await bootstrap.end();

  pool = mysql.createPool(config);

  // Automatically load schema if present
  const schemaPath = path.join(__dirname, '../../database/schema.sql');
  if (fs.existsSync(schemaPath)) {
    let schema = fs.readFileSync(schemaPath, 'utf8');
    schema = schema
      .replace(/CREATE DATABASE[\s\S]*?;\s*/i, '')
      .replace(/USE\s+`?fitnesshub`?\s*;\s*/i, '')
      .replace(/SET FOREIGN_KEY_CHECKS\s*=\s*0\s*;\s*/gi, '')
      .replace(/SET FOREIGN_KEY_CHECKS\s*=\s*1\s*;\s*/gi, '');

    if (schema.trim()) {
      await pool.query(schema);
    }
  }

  initialized = true;
  return pool;
}

function execute(...args) {
  if (!pool) throw new Error('Database is not initialized. Start the server normally.');
  return pool.execute(...args);
}

function query(...args) {
  if (!pool) throw new Error('Database is not initialized. Start the server normally.');
  return pool.query(...args);
}

async function seedDemoData() {
  await initDatabase();

  const users = [
    ['FitnessHub Admin', 'admin@fitnesshub.local', 'admin123', 'admin', '+8801700000000'],
    ['Alex Rahman', 'member@fitnesshub.local', 'member123', 'member', '+8801800000000'],
    ['Nadia Trainer', 'trainer@fitnesshub.local', 'trainer123', 'trainer', '+8801900000000']
  ];

  for (const [name, email, password, role, phone] of users) {
    const hash = await bcrypt.hash(password, 10);
    await execute(
      `INSERT INTO users(full_name,email,password_hash,role,phone)
       VALUES(?,?,?,?,?)
       ON DUPLICATE KEY UPDATE full_name=VALUES(full_name), password_hash=VALUES(password_hash), role=VALUES(role), phone=VALUES(phone)`,
      [name, email, hash, role, phone]
    );
  }

  const plans = [
    ['Essential', 1, 1500, 'Flexible access for one month.'],
    ['Performance', 3, 3900, 'Three months with classes and progress tracking.'],
    ['Elite', 12, 12000, 'Full-year membership with premium class access.']
  ];
  for (const p of plans) {
    await execute(
      `INSERT INTO membership_plans(name,duration_months,price,description)
       VALUES(?,?,?,?) ON DUPLICATE KEY UPDATE duration_months=VALUES(duration_months),price=VALUES(price),description=VALUES(description)`,
      p
    );
  }

  const [[member]] = await query("SELECT id FROM users WHERE email='member@fitnesshub.local'");
  const [[trainer]] = await query("SELECT id FROM users WHERE email='trainer@fitnesshub.local'");
  const [[performance]] = await query("SELECT id FROM membership_plans WHERE name='Performance'");

  if (!member || !trainer || !performance) {
    throw new Error('Failed to retrieve seed reference records (user/plan).');
  }

  const [membershipRows] = await execute('SELECT id FROM memberships WHERE user_id=? LIMIT 1', [member.id]);
  let membershipId;
  if (!membershipRows.length) {
    const [r] = await execute(
      `INSERT INTO memberships(user_id,plan_id,start_date,end_date,status)
       VALUES(?,?,CURDATE(),DATE_ADD(CURDATE(),INTERVAL 3 MONTH),'active')`,
      [member.id, performance.id]
    );
    membershipId = r.insertId;
  } else {
    membershipId = membershipRows[0].id;
  }

  const classData = [
    ['Strength Lab', 'Progressive strength and resistance training.', '07:00:00', '08:00:00', 18, 'Studio A', 1],
    ['Redline HIIT', 'High-intensity interval training.', '18:00:00', '19:00:00', 20, 'Studio B', 2],
    ['Mobility Flow', 'Recovery-focused mobility and stretching.', '19:30:00', '20:30:00', 15, 'Studio A', 3]
  ];
  for (const [title, description, start, end, capacity, room, days] of classData) {
    const [existing] = await execute(
      'SELECT id FROM fitness_classes WHERE title=? AND class_date=DATE_ADD(CURDATE(), INTERVAL ? DAY) LIMIT 1',
      [title, days]
    );
    if (!existing.length) {
      // Fixed: Exactly 8 column placeholders matching 8 input array values
      await execute(
        `INSERT INTO fitness_classes(title,description,trainer_id,class_date,start_time,end_time,capacity,room)
         VALUES(?,?,?,DATE_ADD(CURDATE(),INTERVAL ? DAY),?,?,?,?)`,
        [title, description, trainer.id, days, start, end, capacity, room]
      );
    }
  }

  const [[firstClass]] = await query('SELECT id FROM fitness_classes ORDER BY id LIMIT 1');
  if (firstClass) {
    const [booking] = await execute('SELECT id FROM bookings WHERE class_id=? AND user_id=? LIMIT 1', [firstClass.id, member.id]);
    if (!booking.length) {
      await execute('INSERT INTO bookings(class_id,user_id,status) VALUES(?,?,?)', [firstClass.id, member.id, 'booked']);
    }
  }

  const [payment] = await execute('SELECT id FROM payments WHERE reference=? LIMIT 1', ['FH-DEMO-001']);
  if (!payment.length) {
    await execute(
      `INSERT INTO payments(user_id,membership_id,amount,method,status,payment_date,reference) VALUES(?,?,?,?,?,CURDATE(),?)`,
      [member.id, membershipId, 3900, 'cash', 'paid', 'FH-DEMO-001']
    );
  }

  const [progress] = await execute('SELECT id FROM workout_progress WHERE user_id=? LIMIT 1', [member.id]);
  if (!progress.length) {
    await execute(
      `INSERT INTO workout_progress(user_id,metric_date,weight_kg,body_fat,chest_cm,waist_cm,notes)
       VALUES(?,DATE_SUB(CURDATE(),INTERVAL 30 DAY),71.50,18.20,96,82,'Starting measurement'),
             (?,CURDATE(),70.80,17.40,98,80,'Improved strength and consistency')`,
      [member.id, member.id]
    );
  }
}

async function end() {
  if (pool) await pool.end();
  pool = null;
  initialized = false;
}

module.exports = { initDatabase, seedDemoData, execute, query, end };