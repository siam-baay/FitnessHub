const router = require('express').Router();
const db = require('../db');
const { auth, allow } = require('../middleware/auth');

router.get('/', auth, allow('admin'), async (req,res)=>{
  const [rows] = await db.query(`
    SELECT u.id,u.full_name,u.email,u.phone,u.role,u.created_at,
           m.status membership_status, mp.name plan_name, m.end_date
    FROM users u
    LEFT JOIN memberships m ON m.user_id=u.id AND m.id=(SELECT MAX(id) FROM memberships m2 WHERE m2.user_id=u.id)
    LEFT JOIN membership_plans mp ON mp.id=m.plan_id
    WHERE u.role='member'
    ORDER BY u.id DESC
  `);
  res.json(rows);
});

router.post('/', auth, allow('admin'), async (req,res)=>{
  const {full_name,email,password,phone} = req.body;
  if(!full_name || !email || !password) return res.status(400).json({message:'Name, email and password are required.'});
  const bcrypt = require('bcryptjs');
  const hash = await bcrypt.hash(password,10);
  try {
    const [r] = await db.execute(
      "INSERT INTO users(full_name,email,password_hash,role,phone) VALUES(?,?,?,?,?)",
      [full_name,email,hash,'member',phone||null]
    );
    res.status(201).json({id:r.insertId});
  } catch(e){ res.status(400).json({message:e.message}); }
});

router.put('/:id', auth, allow('admin'), async (req,res)=>{
  const {full_name,phone,email} = req.body;
  await db.execute("UPDATE users SET full_name=?,phone=?,email=? WHERE id=? AND role='member'",
    [full_name,phone||null,email,req.params.id]);
  res.json({message:'Member updated.'});
});

router.delete('/:id', auth, allow('admin'), async (req,res)=>{
  await db.execute("DELETE FROM users WHERE id=? AND role='member'", [req.params.id]);
  res.json({message:'Member deleted.'});
});

module.exports = router;
