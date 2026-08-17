const db = require('./db');

(async () => {
  try {
    await db.seedDemoData();
    console.log('\nFitnessHub demo data is ready.');
    console.log('Admin:   admin@fitnesshub.local / admin123');
    console.log('Member:  member@fitnesshub.local / member123');
    console.log('Trainer: trainer@fitnesshub.local / trainer123');
  } catch (e) {
    console.error('\nSeed failed:', e.message);
    process.exitCode = 1;
  } finally {
    await db.end();
  }
})();
