const router = require('express').Router();
const db = require('../db');
const { auth, allow } = require('../middleware/auth');

router.get('/plans', auth, async (req,res)=>{
  const [rows] = await db.query('SELECT * FROM membership_plans ORDER BY price');
  res.json(rows);
});

router.get('/my', auth, async (req,res)=>{
  const [rows] = await db.query(`
    SELECT m.*, mp.name plan_name, mp.price, mp.duration_months
    FROM memberships m JOIN membership_plans mp ON mp.id=m.plan_id
    WHERE m.user_id=? ORDER BY m.id DESC
  `,[req.user.id]);
  res.json(rows);
});

router.post('/', auth, async (req,res)=>{
  const userId = req.user.role === 'admin' && req.body.user_id ? req.body.user_id : req.user.id;
  const {plan_id,start_date} = req.body;
  const [[plan]] = await db.query('SELECT * FROM membership_plans WHERE id=?',[plan_id]);
  if(!plan) return res.status(404).json({message:'Plan not found.'});
  const start = start_date || new Date().toISOString().slice(0,10);
  const [r] = await db.execute(
    "INSERT INTO memberships(user_id,plan_id,start_date,end_date,status) VALUES(?,?,?,DATE_ADD(?,INTERVAL ? MONTH),'active')",
    [userId,plan_id,start,start,plan.duration_months]
  );
  res.status(201).json({id:r.insertId});
});

router.put('/:id', auth, allow('admin'), async (req,res)=>{
  const {status,end_date} = req.body;
  await db.execute('UPDATE memberships SET status=?,end_date=? WHERE id=?',[status,end_date,req.params.id]);
  res.json({message:'Membership updated.'});
});

module.exports = router;
