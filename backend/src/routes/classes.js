const router = require('express').Router();
const db = require('../db');
const { auth, allow } = require('../middleware/auth');

router.get('/', auth, async (req,res)=>{
  const [rows] = await db.query(`
    SELECT c.*, u.full_name trainer_name,
      (SELECT COUNT(*) FROM bookings b WHERE b.class_id=c.id AND b.status='booked') booked_count
    FROM fitness_classes c
    LEFT JOIN users u ON u.id=c.trainer_id
    WHERE c.class_date >= CURDATE()
    ORDER BY c.class_date,c.start_time
  `);
  res.json(rows);
});

router.post('/', auth, allow('admin','trainer'), async (req,res)=>{
  const {title,description,trainer_id,class_date,start_time,end_time,capacity,room} = req.body;
  const [r] = await db.execute(`
    INSERT INTO fitness_classes(title,description,trainer_id,class_date,start_time,end_time,capacity,room)
    VALUES(?,?,?,?,?,?,?,?)
  `,[title,description||null,trainer_id||req.user.id,class_date,start_time,end_time,capacity||20,room||null]);
  res.status(201).json({id:r.insertId});
});

router.delete('/:id', auth, allow('admin','trainer'), async (req,res)=>{
  await db.execute('DELETE FROM fitness_classes WHERE id=?',[req.params.id]);
  res.json({message:'Class deleted.'});
});

module.exports = router;
