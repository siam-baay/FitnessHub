# FitnessHub — Full Stack Gym Management System

## FIXED: MySQL + Server Startup

This version fixes the common `Request failed`, `Server error`, and MySQL setup problems.

### What changed
- Server automatically creates the `fitnesshub` database if it does not exist.
- Server automatically creates all required tables from `database/schema.sql`.
- Demo users/plans/sample data are created automatically when the server starts (you can also run `npm run seed`).
- No hard-coded user IDs in the SQL file.
- XAMPP/WAMP default MySQL (`root` with blank password) works without changing `.env`.
- `/api/health` now checks the actual MySQL connection.
- Startup errors clearly show the MySQL problem.

## Easiest Windows setup

1. Open **XAMPP Control Panel**.
2. Start **MySQL**. Apache is not required for this project.
3. Double-click:
   `START-FITNESSHUB.bat`
4. Open:
   `http://localhost:5000/`
5. Login:
   - Member: `member@fitnesshub.local` / `member123`
   - Admin: `admin@fitnesshub.local` / `admin123`
   - Trainer: `trainer@fitnesshub.local` / `trainer123`

The first run installs npm packages, creates the database/tables, and creates the demo accounts automatically.

## If your MySQL has a password

Open `backend/.env` and set:

    DB_HOST=localhost
    DB_PORT=3306
    DB_USER=root
    DB_PASSWORD=YOUR_MYSQL_PASSWORD
    DB_NAME=fitnesshub
    PORT=5000
    JWT_SECRET=your_secret

Then run `npm start` again.

## Check the server

Open:
`http://localhost:5000/api/health`

Expected:

    {"status":"ok","database":"connected","service":"FitnessHub API"}

If MySQL is not connected, the endpoint returns the actual database error.

## Manual commands

From `backend`:

    npm install
    npm run seed
    npm start

You do NOT need to import `schema.sql` manually when using the new server. It is loaded automatically.

## Technology
- Desktop: JavaFX
- Front-End: HTML, CSS, JavaScript, Bootstrap 5
- Back-End: Node.js + Express.js
- Database: MySQL
