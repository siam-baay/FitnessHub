const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = Number(process.env.PORT || 5000);
const JWT_SECRET = process.env.JWT_SECRET || "fitnesshub_local_secret";

const DATA_DIR = path.join(__dirname, "data");
const DB_FILE = path.join(DATA_DIR, "db.json");
const PUBLIC_DIR = path.join(__dirname, "..", "frontend", "public");

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

function readDB() {
  const raw = fs.readFileSync(DB_FILE, "utf8");
  const db = JSON.parse(raw);
  db.members ||= [];
  db.plans ||= [];
  db.attendances ||= [];
  db.users ||= [];
  db.classes ||= [];
  db.bookings ||= [];
  db.payments ||= [];
  db.progress ||= [];
  return db;
}

function writeDB(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

function nextId(items) {
  return Math.max(0, ...items.map(x => Number(x.id) || 0)) + 1;
}

function publicUser(u) {
  return {
    id: u.id,
    name: u.name || u.full_name || "",
    full_name: u.name || u.full_name || "",
    email: u.email || "",
    phone: u.phone || "",
    role: u.role
  };
}

function auth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: "Authentication required." });

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token." });
  }
}

function role(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Access denied." });
    }
    next();
  };
}

function memberByUser(db, user) {
  return db.members.find(m => m.user_id === user.id || (m.email && user.email && m.email.toLowerCase() === user.email.toLowerCase()));
}

function planWithMember(db, member) {
  if (!member) return null;
  const plan = db.plans.find(p => Number(p.id) === Number(member.plan_id));
  return plan ? { ...member, plan_name: plan.plan_name, price: plan.price, duration_days: plan.duration_days } : { ...member, plan_name: "No plan" };
}

function normalizeDate(value) {
  return value ? String(value).slice(0, 10) : new Date().toISOString().slice(0, 10);
}

// Health
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", database: "json-file", mysql: false, service: "FitnessHub API" });
});

// Authentication
app.post("/api/auth/register", (req, res) => {
  try {
    const { name, full_name, email, password, phone } = req.body || {};
    const userName = String(name || full_name || "").trim();
    const normalizedEmail = String(email || "").trim().toLowerCase();
    if (!userName || !normalizedEmail || !password) {
      return res.status(400).json({ message: "Name, email and password are required." });
    }

    const db = readDB();
    if (db.users.some(u => String(u.email || "").toLowerCase() === normalizedEmail)) {
      return res.status(409).json({ message: "Email already registered." });
    }

    const id = nextId(db.users);
    const user = {
      id,
      name: userName,
      email: normalizedEmail,
      passwordHash: bcrypt.hashSync(String(password), 10),
      role: "member"
    };
    db.users.push(user);

    const memberId = nextId(db.members);
    db.members.push({
      id: memberId,
      name: userName,
      phone: phone || "",
      email: normalizedEmail,
      plan_id: null,
      join_date: normalizeDate(),
      expiry_date: "",
      status: "pending"
    });

    writeDB(db);

    const token = jwt.sign({ id: user.id, email: user.email, role: user.role, full_name: user.name }, JWT_SECRET, { expiresIn: "7d" });
    res.status(201).json({ token, user: publicUser(user) });
  } catch (e) {
    console.error("Register error:", e);
    res.status(500).json({ message: "Unable to register.", detail: e.message });
  }
});

app.post("/api/auth/login", (req, res) => {
  try {
    const { email, password } = req.body || {};
    const normalizedEmail = String(email || "").trim().toLowerCase();
    const db = readDB();
    const u = db.users.find(x => String(x.email || "").toLowerCase() === normalizedEmail);

    let valid = false;
    if (u) {
      if (u.passwordHash) valid = bcrypt.compareSync(String(password || ""), u.passwordHash);
      else if (u.password) valid = String(password || "") === String(u.password);
    }

    if (!u || !valid) return res.status(401).json({ message: "Invalid email or password." });

    // Upgrade legacy plain password records to a hash.
    if (!u.passwordHash) {
      u.passwordHash = bcrypt.hashSync(String(password), 10);
      delete u.password;
      writeDB(db);
    }

    const token = jwt.sign({ id: u.id, email: u.email, role: u.role, full_name: u.name }, JWT_SECRET, { expiresIn: "7d" });
    res.json({ token, user: publicUser(u) });
  } catch (e) {
    console.error("Login error:", e);
    res.status(500).json({ message: "Unable to log in.", detail: e.message });
  }
});

app.get("/api/auth/me", auth, (req, res) => {
  const db = readDB();
  const u = db.users.find(x => Number(x.id) === Number(req.user.id));
  if (!u) return res.status(404).json({ message: "User not found." });
  const member = memberByUser(db, u);
  res.json({
    ...publicUser(u),
    phone: member?.phone || u.phone || ""
  });
});

app.put("/api/auth/me", auth, (req, res) => {
  try {
    const db = readDB();
    const u = db.users.find(x => Number(x.id) === Number(req.user.id));
    if (!u) return res.status(404).json({ message: "User not found." });

    const fullName = String(req.body.full_name || req.body.name || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const phone = String(req.body.phone || "").trim();

    if (!fullName || !email) return res.status(400).json({ message: "Full name and email are required." });
    if (db.users.some(x => Number(x.id) !== Number(u.id) && String(x.email || "").toLowerCase() === email)) {
      return res.status(409).json({ message: "That email address is already in use." });
    }

    u.name = fullName;
    u.email = email;
    const member = memberByUser(db, u);
    if (member) {
      member.name = fullName;
      member.email = email;
      member.phone = phone;
    } else if (u.role === "member") {
      db.members.push({
        id: nextId(db.members),
        user_id: u.id,
        name: fullName,
        phone,
        email,
        plan_id: null,
        join_date: normalizeDate(),
        expiry_date: "",
        status: "pending"
      });
    }

    writeDB(db);
    const token = jwt.sign({ id: u.id, email: u.email, role: u.role, full_name: u.name }, JWT_SECRET, { expiresIn: "7d" });
    res.json({ ...publicUser(u), phone, token });
  } catch (e) {
    console.error("Profile update error:", e);
    res.status(500).json({ message: "Unable to update profile.", detail: e.message });
  }
});

// Dashboard
app.get("/api/dashboard/stats", auth, (req, res) => {
  const db = readDB();
  if (req.user.role === "admin" || req.user.role === "receptionist") {
    const today = new Date().toISOString().slice(0, 10);
    const active = db.members.filter(m => String(m.status).toLowerCase() === "active" && (!m.expiry_date || m.expiry_date >= today)).length;
    const payments = Array.isArray(db.payments) ? db.payments : [];
    const classes = Array.isArray(db.classes) ? db.classes : [];
    const revenue = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
    return res.json({
      members: db.members.length,
      active_memberships: active,
      revenue,
      upcoming_classes: classes.length
    });
  }

  const member = memberByUser(db, db.users.find(u => Number(u.id) === Number(req.user.id)) || req.user);
  const today = new Date().toISOString().slice(0, 10);
  res.json({
    membership_active: !!member && String(member.status).toLowerCase() === "active" && (!member.expiry_date || member.expiry_date >= today),
    attendance: db.attendances.filter(a => Number(a.member_id) === Number(member?.id)).length,
    bookings: db.bookings.filter(b => Number(b.userId) === Number(req.user.id) && b.status === "Confirmed").length,
    latest_progress: db.progress.filter(p => Number(p.userId) === Number(req.user.id)).sort((a,b) => String(b.date).localeCompare(String(a.date)))[0] || null
  });
});

// Plans - simple table
app.get("/api/plans", auth, (req, res) => {
  const db = readDB();
  res.json(db.plans);
});

app.post("/api/plans", auth, role("admin"), (req, res) => {
  const { plan_name, price, duration_days } = req.body || {};
  if (!plan_name || price === undefined || !duration_days) {
    return res.status(400).json({ message: "Plan name, price and duration are required." });
  }
  const db = readDB();
  const plan = { id: nextId(db.plans), plan_name: String(plan_name).trim(), price: Number(price), duration_days: Number(duration_days) };
  db.plans.push(plan);
  writeDB(db);
  res.status(201).json(plan);
});

app.delete("/api/plans/:id", auth, role("admin"), (req, res) => {
  const db = readDB();
  const id = Number(req.params.id);
  if (db.members.some(m => Number(m.plan_id) === id)) return res.status(409).json({ message: "Cannot delete a plan that is assigned to a member." });
  db.plans = db.plans.filter(p => Number(p.id) !== id);
  writeDB(db);
  res.json({ message: "Plan deleted." });
});

// Members - simple table
app.get("/api/members", auth, role("admin"), (req, res) => {
  const db = readDB();
  res.json(db.members.map(m => planWithMember(db, m)));
});

app.post("/api/members", auth, role("admin"), (req, res) => {
  const { name, phone, email, plan_id, join_date, expiry_date, status } = req.body || {};
  if (!name || !email) return res.status(400).json({ message: "Name and email are required." });
  const db = readDB();
  if (db.members.some(m => String(m.email).toLowerCase() === String(email).toLowerCase())) {
    return res.status(409).json({ message: "A member with this email already exists." });
  }
  const id = nextId(db.members);
  db.members.push({
    id, name: String(name).trim(), phone: String(phone || "").trim(),
    email: String(email).trim().toLowerCase(), plan_id: plan_id ? Number(plan_id) : null,
    join_date: normalizeDate(join_date), expiry_date: expiry_date || "", status: status || "active"
  });
  writeDB(db);
  res.status(201).json(db.members.find(m => m.id === id));
});

app.delete("/api/members/:id", auth, role("admin"), (req, res) => {
  const db = readDB();
  const id = Number(req.params.id);
  db.members = db.members.filter(m => Number(m.id) !== id);
  db.attendances = db.attendances.filter(a => Number(a.member_id) !== id);
  writeDB(db);
  res.json({ message: "Member deleted." });
});

// Attendance - simple table
app.get("/api/attendance", auth, role("admin","receptionist"), (req, res) => {
  const db = readDB();
  const rows = db.attendances.map(a => {
    const member = db.members.find(m => Number(m.id) === Number(a.member_id));
    return { ...a, member_name: member?.name || "Unknown member" };
  });
  rows.sort((a,b) => String(b.date).localeCompare(String(a.date)) || Number(b.id) - Number(a.id));
  res.json(rows);
});

app.post("/api/attendance", auth, role("admin","receptionist"), (req, res) => {
  const { member_id, date, check_in_time } = req.body || {};
  const db = readDB();
  const member = db.members.find(m => Number(m.id) === Number(member_id));
  if (!member) return res.status(404).json({ message: "Member not found." });
  const item = {
    id: nextId(db.attendances),
    member_id: Number(member_id),
    check_in_time: check_in_time || new Date().toTimeString().slice(0,5),
    date: normalizeDate(date)
  };
  db.attendances.push(item);
  writeDB(db);
  res.status(201).json(item);
});

app.delete("/api/attendance/:id", auth, role("admin","receptionist"), (req, res) => {
  const db = readDB();
  db.attendances = db.attendances.filter(a => Number(a.id) !== Number(req.params.id));
  writeDB(db);
  res.json({ message: "Attendance record deleted." });
});

// Users - authentication users, only admin can manage
app.get("/api/users", auth, role("admin"), (req, res) => {
  const db = readDB();
  res.json(db.users.map(publicUser));
});

app.post("/api/users", auth, role("admin"), (req, res) => {
  const { name, email, password, role: userRole } = req.body || {};
  if (!name || !email || !password) return res.status(400).json({ message: "Name, email and password are required." });
  if (!["admin","receptionist"].includes(userRole)) return res.status(400).json({ message: "Role must be admin or receptionist." });

  const db = readDB();
  if (db.users.some(u => String(u.email).toLowerCase() === String(email).toLowerCase())) {
    return res.status(409).json({ message: "Email already exists." });
  }
  const u = {
    id: nextId(db.users),
    name: String(name).trim(),
    email: String(email).trim().toLowerCase(),
    passwordHash: bcrypt.hashSync(String(password), 10),
    role: userRole
  };
  db.users.push(u);
  writeDB(db);
  res.status(201).json(publicUser(u));
});

app.delete("/api/users/:id", auth, role("admin"), (req, res) => {
  const db = readDB();
  const id = Number(req.params.id);
  if (id === Number(req.user.id)) return res.status(400).json({ message: "You cannot delete your own account." });
  db.users = db.users.filter(u => Number(u.id) !== id);
  db.members = db.members.filter(m => Number(m.user_id) !== id);
  writeDB(db);
  res.json({ message: "User deleted." });
});

// Profile compatibility endpoints backed by the four main tables.
app.get("/api/memberships", auth, (req, res) => {
  try {
    const db = readDB();
    if (req.user.role === "admin" || req.user.role === "receptionist") {
      return res.json(db.members.map(m => planWithMember(db, m)).filter(Boolean));
    }
    const u = db.users.find(x => Number(x.id) === Number(req.user.id));
    const member = memberByUser(db, u || req.user);
    return res.json(member ? [planWithMember(db, member)] : []);
  } catch (e) {
    console.error("Membership load error:", e);
    return res.status(200).json([]);
  }
});

app.get("/api/attendance", auth, (req, res) => {
  const db = readDB();
  let rows = db.attendances;
  if (req.user.role !== "admin" && req.user.role !== "receptionist") {
    const u = db.users.find(x => Number(x.id) === Number(req.user.id));
    const member = memberByUser(db, u || req.user);
    rows = member ? rows.filter(a => Number(a.member_id) === Number(member.id)) : [];
  }
  res.json(rows.map(a => {
    const member = db.members.find(m => Number(m.id) === Number(a.member_id));
    return { ...a, member_name: member?.name || "Unknown member", status: "Present" };
  }));
});

app.get("/api/payments", auth, (req, res) => {
  const db = readDB();
  let rows = db.payments || [];
  if (req.user.role !== "admin" && req.user.role !== "receptionist") {
    rows = rows.filter(p => Number(p.userId) === Number(req.user.id));
  }
  res.json(rows);
});

app.get("/api/progress", auth, (req, res) => {
  const db = readDB();
  let rows = db.progress || [];
  if (req.user.role !== "admin" && req.user.role !== "receptionist") {
    rows = rows.filter(p => Number(p.userId) === Number(req.user.id));
  }
  res.json(rows);
});

// Membership compatibility for the profile page, backed by the members/plans tables.
app.get("/api/memberships/plans", auth, (req, res) => {
  const db = readDB();
  res.json(db.plans.map(p => ({
    id: p.id, name: p.plan_name, plan_name: p.plan_name,
    price: p.price, duration_days: p.duration_days,
    duration_months: Math.max(1, Math.round(Number(p.duration_days) / 30))
  })));
});

app.get("/api/memberships/my", auth, (req, res) => {
  const db = readDB();
  const u = db.users.find(x => Number(x.id) === Number(req.user.id));
  const member = memberByUser(db, u || req.user);
  if (!member) return res.json([]);
  const plan = db.plans.find(p => Number(p.id) === Number(member.plan_id));
  res.json([{ ...member, plan_name: plan?.plan_name || "No plan", price: plan?.price || 0, duration_days: plan?.duration_days || 0, start_date: member.join_date, end_date: member.expiry_date, status: member.status }]);
});

app.post("/api/memberships", auth, (req, res) => {
  const db = readDB();
  const u = db.users.find(x => Number(x.id) === Number(req.user.id));
  const targetUserId = req.user.role === "admin" && req.body.user_id ? Number(req.body.user_id) : Number(req.user.id);
  const member = db.members.find(m => Number(m.user_id) === targetUserId) || db.members.find(m => String(m.email).toLowerCase() === String(u?.email || "").toLowerCase());
  const plan = db.plans.find(p => Number(p.id) === Number(req.body.plan_id));
  if (!member || !plan) return res.status(404).json({ message: "Member or plan not found." });
  const start = normalizeDate(req.body.start_date);
  const end = req.body.end_date || (() => {
    const d = new Date(`${start}T00:00:00`);
    d.setDate(d.getDate() + Number(plan.duration_days));
    return d.toISOString().slice(0,10);
  })();
  member.plan_id = plan.id;
  member.join_date = start;
  member.expiry_date = end;
  member.status = "active";
  writeDB(db);
  res.status(201).json(planWithMember(db, member));
});

app.put("/api/memberships/:id", auth, role("admin"), (req, res) => {
  const db = readDB();
  const id = Number(req.params.id);
  const member = db.members.find(m => Number(m.id) === id || Number(m.plan_id) === id);
  if (!member) return res.status(404).json({ message: "Membership not found." });
  if (req.body.status) member.status = req.body.status;
  if (req.body.end_date) member.expiry_date = req.body.end_date;
  writeDB(db);
  res.json(planWithMember(db, member));
});

// Payments compatibility (not a fourth table; payments are kept as optional application data)
app.get("/api/payments/my", auth, (req, res) => {
  const db = readDB();
  const member = memberByUser(db, db.users.find(u => Number(u.id) === Number(req.user.id)));
  res.json((db.payments || []).filter(p => Number(p.userId) === Number(req.user.id) || Number(p.member_id) === Number(member?.id)));
});

// Progress compatibility
app.get("/api/progress/my", auth, (req, res) => {
  const db = readDB();
  res.json((db.progress || []).filter(p => Number(p.userId) === Number(req.user.id)));
});

app.post("/api/progress", auth, (req, res) => {
  const db = readDB();
  const { metric_date, weight_kg, body_fat, chest_cm, waist_cm, notes } = req.body || {};
  const item = {
    id: nextId(db.progress || []), userId: req.user.id,
    date: metric_date || normalizeDate(), metric_date: metric_date || normalizeDate(),
    weight_kg: weight_kg === "" ? null : Number(weight_kg),
    body_fat: body_fat === "" ? null : Number(body_fat),
    chest_cm: chest_cm === "" ? null : Number(chest_cm),
    waist_cm: waist_cm === "" ? null : Number(waist_cm),
    notes: notes || ""
  };
  db.progress.push(item);
  writeDB(db);
  res.status(201).json(item);
});

// Classes and bookings are kept as schedule/application data, not database tables.
app.get("/api/classes", auth, (req, res) => {
  const db = readDB();

  // Classes are application schedule data, not one of the four core tables.
  // Provide a small built-in schedule so the Classes page is useful even
  // when the JSON database contains only members/plans/attendances/users.
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const pad = n => String(n).padStart(2, "0");
  const dateAfter = days => {
    const d = new Date(today);
    d.setDate(d.getDate() + days);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };

  const defaultClasses = [
    { id: 1, title: "Strength & Conditioning", description: "Build strength, improve movement, and train with purpose.", trainer_name: "Coach Alex", class_date: dateAfter(1), start_time: "08:00", end_time: "09:00", capacity: 20, room: "Studio A" },
    { id: 2, title: "HIIT Burn", description: "A fast-paced session focused on fitness, power, and endurance.", trainer_name: "Coach Sam", class_date: dateAfter(1), start_time: "18:00", end_time: "19:00", capacity: 18, room: "Studio B" },
    { id: 3, title: "Functional Fitness", description: "Full-body training designed for everyday strength and mobility.", trainer_name: "Coach Maya", class_date: dateAfter(2), start_time: "09:00", end_time: "10:00", capacity: 20, room: "Studio A" },
    { id: 4, title: "Core & Mobility", description: "Improve core control, flexibility, balance, and recovery.", trainer_name: "Coach Alex", class_date: dateAfter(3), start_time: "17:30", end_time: "18:30", capacity: 16, room: "Studio B" },
    { id: 5, title: "Full Body Strength", description: "Progressive resistance training for a stronger, fitter body.", trainer_name: "Coach Sam", class_date: dateAfter(4), start_time: "08:30", end_time: "09:30", capacity: 20, room: "Studio A" },
    { id: 6, title: "Weekend Conditioning", description: "A balanced conditioning session to finish the week strong.", trainer_name: "Coach Maya", class_date: dateAfter(5), start_time: "10:00", end_time: "11:00", capacity: 24, room: "Main Floor" }
  ];

  const source = Array.isArray(db.classes) && db.classes.length ? db.classes : defaultClasses;
  const rows = source
    .filter(c => !c.class_date || String(c.class_date) >= today.toISOString().slice(0, 10))
    .map(c => {
      const booked = db.bookings.filter(b =>
        Number(b.classId) === Number(c.id) && b.status === "Confirmed"
      ).length;
      return { ...c, booked_count: booked };
    });

  res.json(rows);
});

app.post("/api/classes/:id/book", auth, role("member"), (req, res) => {
  const db = readDB();
  const classId = Number(req.params.id);

  // The Classes page can use the built-in schedule when there is no
  // `classes` collection in the 4-table database. Booking must therefore
  // validate against that same built-in schedule instead of only db.classes.
  const builtInClasses = {
    1: { id: 1, capacity: 20 },
    2: { id: 2, capacity: 18 },
    3: { id: 3, capacity: 20 },
    4: { id: 4, capacity: 16 },
    5: { id: 5, capacity: 20 },
    6: { id: 6, capacity: 24 }
  };

  const c = (Array.isArray(db.classes) ? db.classes : [])
    .find(x => Number(x.id) === classId) || builtInClasses[classId];

  if (!c) return res.status(404).json({ message: "Class not found." });

  const bookings = Array.isArray(db.bookings) ? db.bookings : [];
  const booked = bookings.filter(b =>
    Number(b.classId) === classId && b.status === "Confirmed"
  ).length;

  if (booked >= Number(c.capacity || 0)) {
    return res.status(400).json({ message: "Class is full." });
  }

  const existing = bookings.find(b =>
    Number(b.userId) === Number(req.user.id) &&
    Number(b.classId) === classId &&
    b.status === "Confirmed"
  );

  if (existing) return res.status(409).json({ message: "Already booked." });

  bookings.push({
    id: nextId(bookings),
    userId: req.user.id,
    classId,
    status: "Confirmed"
  });

  db.bookings = bookings;
  writeDB(db);

  res.status(201).json({ message: "Booking confirmed." });
});

app.get("/api/bookings/my", auth, (req, res) => {
  const db = readDB();
  const bookings = Array.isArray(db.bookings) ? db.bookings : [];

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const pad = n => String(n).padStart(2, "0");
  const dateAfter = days => {
    const d = new Date(today);
    d.setDate(d.getDate() + days);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };

  const builtInClasses = [
    { id: 1, title: "Strength & Conditioning", class_date: dateAfter(1), start_time: "08:00", end_time: "09:00", room: "Studio A" },
    { id: 2, title: "HIIT Burn", class_date: dateAfter(1), start_time: "18:00", end_time: "19:00", room: "Studio B" },
    { id: 3, title: "Functional Fitness", class_date: dateAfter(2), start_time: "09:00", end_time: "10:00", room: "Studio A" },
    { id: 4, title: "Core & Mobility", class_date: dateAfter(3), start_time: "17:30", end_time: "18:30", room: "Studio B" },
    { id: 5, title: "Full Body Strength", class_date: dateAfter(4), start_time: "08:30", end_time: "09:30", room: "Studio A" },
    { id: 6, title: "Weekend Conditioning", class_date: dateAfter(5), start_time: "10:00", end_time: "11:00", room: "Main Floor" }
  ];

  const source = Array.isArray(db.classes) && db.classes.length ? db.classes : builtInClasses;
  const allowed = req.user.role === "admin"
    ? bookings
    : bookings.filter(b => Number(b.userId) === Number(req.user.id));

  const rows = allowed.map(b => {
    const c = source.find(x => Number(x.id) === Number(b.classId));
    return {
      ...b,
      class_id: b.classId,
      title: c?.title || "Fitness class",
      class_date: c?.class_date || "",
      start_time: c?.start_time || "",
      end_time: c?.end_time || "",
      room: c?.room || ""
    };
  }).filter(b => !b.class_date || String(b.class_date) >= today.toISOString().slice(0,10));

  rows.sort((a,b) => String(a.class_date).localeCompare(String(b.class_date)) || String(a.start_time).localeCompare(String(b.start_time)));
  res.json(rows);
});

app.use(express.static(PUBLIC_DIR));
app.get("*", (req, res) => {
  if (req.path.startsWith("/api/")) return res.status(404).json({ message: "API route not found." });
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: "Internal server error.", detail: err.message });
});

app.listen(PORT, () => {
  console.log(`FitnessHub server running at http://localhost:${PORT}`);
  console.log(`Database: JSON file (4 main tables)`);
});
