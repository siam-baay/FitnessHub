const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { auth } = require('../middleware/auth');

function sign(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, full_name: user.full_name },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

router.post('/register', async (req, res) => {
  try {
    const { full_name, email, password, phone } = req.body;
    if (!full_name || !email || !password) {
      return res.status(400).json({ message: 'Name, email and password are required.' });
    }
    const [existing] = await db.execute('SELECT id FROM users WHERE email=?', [email]);
    if (existing.length) return res.status(409).json({ message: 'Email already exists.' });

    const hash = await bcrypt.hash(password, 10);
    const [result] = await db.execute(
      'INSERT INTO users(full_name,email,password_hash,role,phone) VALUES(?,?,?,?,?)',
      [full_name, email, hash, 'member', phone || null]
    );
    const user = { id: result.insertId, full_name, email, role: 'member' };
    res.status(201).json({ token: sign(user), user });
  } catch (e) {
    console.error('Register error:', e);
    res.status(500).json({ message: 'Database/server error during registration.', detail: e.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const [rows] = await db.execute('SELECT * FROM users WHERE email=?', [email]);
    if (!rows.length || !(await bcrypt.compare(password, rows[0].password_hash))) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }
    const u = rows[0];
    const user = { id: u.id, full_name: u.full_name, email: u.email, role: u.role };
    res.json({ token: sign(user), user });
  } catch (e) {
    console.error('Login error:', e);
    res.status(500).json({ message: 'Database/server error during login.', detail: e.message });
  }
});

router.get('/me', auth, async (req, res) => {
  const [rows] = await db.execute(
    'SELECT id,full_name,email,role,phone,gender,date_of_birth,avatar_url,created_at FROM users WHERE id=?',
    [req.user.id]
  );
  res.json(rows[0] || null);
});


router.put('/me', auth, async (req, res) => {
  try {
    const { full_name, email, phone } = req.body;
    if (!full_name?.trim() || !email?.trim()) {
      return res.status(400).json({ message: 'Full name and email are required.' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const [existing] = await db.execute(
      'SELECT id FROM users WHERE email=? AND id<>?',
      [normalizedEmail, req.user.id]
    );
    if (existing.length) {
      return res.status(409).json({ message: 'That email address is already in use.' });
    }

    await db.execute(
      'UPDATE users SET full_name=?, email=?, phone=? WHERE id=?',
      [full_name.trim(), normalizedEmail, phone?.trim() || null, req.user.id]
    );

    const [rows] = await db.execute(
      'SELECT id,full_name,email,role,phone,gender,date_of_birth,avatar_url,created_at FROM users WHERE id=?',
      [req.user.id]
    );

    res.json(rows[0]);
  } catch (e) {
    console.error('Profile update error:', e);
    res.status(500).json({ message: 'Unable to update profile.', detail: e.message });
  }
});

module.exports = router;
