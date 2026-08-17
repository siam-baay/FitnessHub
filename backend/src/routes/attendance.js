const router = require('express').Router();
const db = require('../db');
const { auth, allow } = require('../middleware/auth');

router.get('/my', auth, async (req,res)=>{
  const [rows] = await db.query(`
    SELECT a.*, c.title,c.class_date
    FROM attendance a LEFT JOIN fitness_classes c ON c.id=a.class_id
    WHERE a.user_id=? ORDER BY a.attendance_date DESC,a.id DESC
  `,[req.user.id]);
  res.json(rows);
});

router.post('/', auth, allow('admin','trainer'), async (req,res)=>{
  const {user_id,class_id,attendance_date,check_in,status} = req.body;
  const [r] = await db.execute(`
    INSERT INTO attendance(user_id,class_id,attendance_date,check_in,status)
    VALUES(?,?,?,?,?)
  `,[user_id,class_id||null,attendance_date||new Date().toISOString().slice(0,10),check_in||null,status||'present']);
  res.status(201).json({id:r.insertId});
});

module.exports = router;
