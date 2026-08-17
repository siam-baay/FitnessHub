const router = require('express').Router();
const db = require('../db');
const { auth } = require('../middleware/auth');

router.get('/my', auth, async (req,res)=>{
  const [rows] = await db.query(
    'SELECT * FROM workout_progress WHERE user_id=? ORDER BY metric_date DESC',
    [req.user.id]
  );
  res.json(rows);
});

router.post('/', auth, async (req,res)=>{
  const {metric_date,weight_kg,body_fat,chest_cm,waist_cm,notes} = req.body;
  const [r] = await db.execute(`
    INSERT INTO workout_progress(user_id,metric_date,weight_kg,body_fat,chest_cm,waist_cm,notes)
    VALUES(?,?,?,?,?,?,?)
  `,[req.user.id,metric_date||new Date().toISOString().slice(0,10),weight_kg||null,body_fat||null,chest_cm||null,waist_cm||null,notes||null]);
  res.status(201).json({id:r.insertId});
});

module.exports = router;
