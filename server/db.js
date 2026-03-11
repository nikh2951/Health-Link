import sqlite3Pkg from 'sqlite3';
const sqlite3 = sqlite3Pkg.verbose();
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database', err.message);
  } else {
    console.log('Connected to the SQLite database.');

    // Create Users Table
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      pin TEXT NOT NULL,
      role TEXT NOT NULL,
      fullName TEXT,
      phoneNumber TEXT,
      dateOfBirth TEXT,
      gender TEXT,
      bloodGroup TEXT,
      height TEXT,
      weight TEXT,
      profilePicture TEXT,
      recentSurgeries TEXT,
      previousFractures TEXT,
      latestMedicines TEXT,
      hasBloodPressure BOOLEAN DEFAULT 0,
      hasBloodSugar BOOLEAN DEFAULT 0,
      hasThyroid BOOLEAN DEFAULT 0,
      age TEXT,
      lastBloodTest TEXT,
      previousDoctor TEXT,
      experienceYears TEXT,
      consultationFee TEXT,
      licenseNumber TEXT,
      hospitalName TEXT,
      specialization TEXT,
      area TEXT,
      availabilityJSON TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Add missing columns if they don't exist
    const addColumns = [
      "ALTER TABLE users ADD COLUMN age TEXT",
      "ALTER TABLE users ADD COLUMN lastBloodTest TEXT",
      "ALTER TABLE users ADD COLUMN previousDoctor TEXT"
    ];

    addColumns.forEach(sql => {
      db.run(sql, (err) => {
        // ignore error if column already exists
      });
    });

    // Create Appointments Table
    db.run(`CREATE TABLE IF NOT EXISTS appointments (
      id TEXT PRIMARY KEY,
      patientEmail TEXT NOT NULL,
      patientName TEXT NOT NULL,
      doctorEmail TEXT NOT NULL,
      doctorName TEXT NOT NULL,
      hospital TEXT NOT NULL,
      date TEXT NOT NULL,
      time TEXT NOT NULL,
      status TEXT DEFAULT 'Scheduled',
      amountPaid TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (patientEmail) REFERENCES users (email),
      FOREIGN KEY (doctorEmail) REFERENCES users (email)
    )`);

    db.run("ALTER TABLE appointments ADD COLUMN amountPaid TEXT", (err) => {
      // ignore error if column already exists
    });

    // Create Prescriptions / Medicines Table
    db.run(`CREATE TABLE IF NOT EXISTS prescriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patientEmail TEXT NOT NULL,
      medicineName TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (patientEmail) REFERENCES users (email)
    )`);

    // Create Emergencies Table
    db.run(`CREATE TABLE IF NOT EXISTS emergencies (
      id TEXT PRIMARY KEY,
      patientEmail TEXT NOT NULL,
      patientName TEXT NOT NULL,
      doctorEmail TEXT NOT NULL,
      doctorName TEXT NOT NULL,
      problemDescription TEXT NOT NULL,
      prescription TEXT,
      status TEXT DEFAULT 'Pending',
      isFeePaid BOOLEAN DEFAULT 0,
      area TEXT,
      hospital TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(patientEmail) REFERENCES users(email),
      FOREIGN KEY(doctorEmail) REFERENCES users(email)
    )`);

    db.run("ALTER TABLE emergencies ADD COLUMN area TEXT", () => { });
    db.run("ALTER TABLE emergencies ADD COLUMN hospital TEXT", () => { });
  }
});

export default db; // Reload server to rebuild tables
