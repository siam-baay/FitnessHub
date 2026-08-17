const router = require('express').Router();
const db = require('../db');
const { auth } = require('../middleware/auth');

router.get('/stats', auth, async (req, res) => {
  try {
    if (req.user.role === 'admin') {
      const [[members]] = await db.query("SELECT COUNT(*) count FROM users WHERE role='member'");
      const [[active]] = await db.query("SELECT COUNT(*) count FROM memberships WHERE status='active' AND end_date >= CURDATE()");
      const [[revenue]] = await db.query("SELECT COALESCE(SUM(amount),0) total FROM payments WHERE status='paid'");
      const [[classes]] = await db.query("SELECT COUNT(*) count FROM fitness_classes WHERE class_date >= CURDATE()");
      return res.json({
        members: members.count,
        active_memberships: active.count,
        revenue: Number(revenue.total),
        upcoming_classes: classes.count
      });
    }

    const [[membership]] = await db.query(
      "SELECT COUNT(*) count FROM memberships WHERE user_id=? AND status='active' AND end_date >= CURDATE()",
      [req.user.id]
    );
    const [[attendance]] = await db.query(
      "SELECT COUNT(*) count FROM attendance WHERE user_id=? AND status='present'",
      [req.user.id]
    );
    const [[bookings]] = await db.query(
      "SELECT COUNT(*) count FROM bookings WHERE user_id=? AND status='booked'",
      [req.user.id]
    );
    const [progress] = await db.query(
      "SELECT * FROM workout_progress WHERE user_id=? ORDER BY metric_date DESC LIMIT 1",
      [req.user.id]
    );
    res.json({
      membership_active: !!membership.count,
      attendance: attendance.count,
      bookings: bookings.count,
      latest_progress: progress[0] || null
    });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

module.exports = router;
