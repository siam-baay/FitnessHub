const router = require('express').Router();
const db = require('../db');
const { auth, allow } = require('../middleware/auth');

router.get('/my', auth, async (req,res)=>{
  const [rows] = await db.query(`
    SELECT p.*, mp.name plan_name
    FROM payments p
    LEFT JOIN memberships m ON m.id=p.membership_id
    LEFT JOIN membership_plans mp ON mp.id=m.plan_id
    WHERE p.user_id=? ORDER BY p.payment_date DESC,p.id DESC
  `,[req.user.id]);
  res.json(rows);
});

router.post('/', auth, allow('admin'), async (req,res)=>{
  const {user_id,membership_id,amount,method,status,payment_date,reference} = req.body;
  const [r] = await db.execute(`
    INSERT INTO payments(user_id,membership_id,amount,method,status,payment_date,reference)
    VALUES(?,?,?,?,?,?,?)
  `,[user_id,membership_id||null,amount,method||'cash',status||'paid',payment_date||new Date().toISOString().slice(0,10),reference||null]);
  res.status(201).json({id:r.insertId});
});

module.exports = router;
