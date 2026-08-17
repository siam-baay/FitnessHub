const router = require('express').Router();
const db = require('../db');
const { auth } = require('../middleware/auth');

router.get('/my', auth, async (req,res)=>{
  const [rows] = await db.query(`
    SELECT b.*, c.title,c.class_date,c.start_time,c.end_time,c.room,u.full_name trainer_name
    FROM bookings b
    JOIN fitness_classes c ON c.id=b.class_id
    LEFT JOIN users u ON u.id=c.trainer_id
    WHERE b.user_id=? ORDER BY c.class_date,c.start_time
  `,[req.user.id]);
  res.json(rows);
});

router.post('/', auth, async (req,res)=>{
  const {class_id} = req.body;
  const [[c]] = await db.query('SELECT * FROM fitness_classes WHERE id=?',[class_id]);
  if(!c) return res.status(404).json({message:'Class not found.'});
  const [[count]] = await db.query("SELECT COUNT(*) count FROM bookings WHERE class_id=? AND status='booked'",[class_id]);
  if(count.count >= c.capacity) return res.status(409).json({message:'This class is full.'});
  try {
    const [r] = await db.execute('INSERT INTO bookings(class_id,user_id,status) VALUES(?,?,?)',[class_id,req.user.id,'booked']);
    res.status(201).json({id:r.insertId,message:'Class booked successfully.'});
  } catch(e){ res.status(409).json({message:'You already booked this class.'}); }
});

router.delete('/:id', auth, async (req,res)=>{
  await db.execute("UPDATE bookings SET status='cancelled' WHERE id=? AND user_id=?",[req.params.id,req.user.id]);
  res.json({message:'Booking cancelled.'});
});

module.exports = router;
