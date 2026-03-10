import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import nodemailer from 'nodemailer';
import db from './db.js';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// --- Authentication & Users ---

const otpStore = new Map(); // Store temporary OTPs in memory

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'panvikaushik8235369@gmail.com',
        pass: 'xeaiiqfxqxaaluzg'
    }
});

app.post('/api/auth/send-otp', async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required.' });

    const min = 100000;
    const max = 999999;
    const otp = Math.floor(Math.random() * (max - min + 1)) + min;
    const otpStr = otp.toString();

    otpStore.set(email.toLowerCase().trim(), {
        code: otpStr,
        expires: Date.now() + 10 * 60 * 1000 // 10 minutes
    });

    const mailOptions = {
        from: 'panvikaushik8235369@gmail.com',
        to: email,
        subject: 'Your HealthLink Login Code',
        text: `Your HealthLink OTP validation code is: ${otpStr}\n\nIt is valid for 10 minutes. Do not share this code with anyone.`
    };

    try {
        await transporter.sendMail(mailOptions);
        res.json({ message: 'OTP sent successfully!' });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Failed to send OTP email.' });
    }
});

app.post('/api/auth/verify-otp', (req, res) => {
    const { email, otp, role } = req.body;
    if (!email || !otp || !role) return res.status(400).json({ error: 'Email, OTP, and Role are required.' });

    const normalizedEmail = email.toLowerCase().trim();

    // Universal test OTP bypass
    if (otp === '111111') {
        const fakeData = otpStore.get(normalizedEmail);
        if (fakeData) otpStore.delete(normalizedEmail);
    } else {
        const storedData = otpStore.get(normalizedEmail);

        if (!storedData) {
            return res.status(400).json({ error: 'No OTP found or expired. Please request a new one.' });
        }

        if (Date.now() > storedData.expires) {
            otpStore.delete(normalizedEmail);
            return res.status(400).json({ error: 'OTP has expired. Please request a new one.' });
        }

        if (storedData.code !== otp) {
            return res.status(400).json({ error: 'Incorrect OTP.' });
        }
        otpStore.delete(normalizedEmail);
    }

    // Check if the user exists in our DB
    db.get('SELECT * FROM users WHERE email = ? AND role = ?', [normalizedEmail, role], (err, user) => {
        if (err) return res.status(500).json({ error: 'Server error' });

        if (!user) {
            // User does not exist, but OTP was valid. Tell frontend to proceed to onboarding.
            return res.json({ verified: true, exists: false });
        }

        const userData = { ...user };
        userData.hasBloodPressure = !!userData.hasBloodPressure;
        userData.hasBloodSugar = !!userData.hasBloodSugar;
        userData.hasThyroid = !!userData.hasThyroid;
        try {
            if (userData.latestMedicines) userData.latestMedicines = JSON.parse(userData.latestMedicines);
            userData.availability = {};
            if (userData.availabilityJSON) {
                try { userData.availability = JSON.parse(userData.availabilityJSON); } catch (e) { }
                delete userData.availabilityJSON;
            }
        } catch (e) { }
        delete userData.pin;

        // User exists and OTP valid
        res.json({ verified: true, exists: true, user: userData });
    });
});
app.get('/api/users/check-name', (req, res) => {
    const { name, role } = req.query;
    if (!name || !role) return res.status(400).json({ error: 'Name and role are required' });

    // For doctors, we need to check if they already have "Dr. " in the name or not, so we check both
    let searchName = name.trim();
    if (role === 'doctor' && !searchName.startsWith('Dr. ') && !searchName.startsWith('Dr ')) {
        searchName = 'Dr. ' + searchName;
    }

    db.get('SELECT id FROM users WHERE fullName = ? COLLATE NOCASE AND role = ?', [searchName, role], (err, user) => {
        if (err) return res.status(500).json({ error: 'Server error' });
        res.json({ exists: !!user });
    });
});

app.post('/api/auth/register', async (req, res) => {
    let {
        email, pin, role, fullName, phoneNumber, dateOfBirth, gender, bloodGroup, height, weight,
        profilePicture, recentSurgeries, previousFractures, latestMedicines,
        hasBloodPressure, hasBloodSugar, hasThyroid, experienceYears, consultationFee,
        licenseNumber, hospitalName, specialization, area, availability
    } = req.body;

    if (!email || !pin || !role) {
        return res.status(400).json({ error: 'Email, PIN, and Role are required.' });
    }

    if (role === 'doctor') {
        const trimmedName = fullName.trim();
        if (!trimmedName.toLowerCase().startsWith('dr. ') && !trimmedName.toLowerCase().startsWith('dr ')) {
            fullName = 'Dr. ' + trimmedName;
        }
    }

    try {
        const hashedPin = await bcrypt.hash(pin, 10);

        const stmt = db.prepare(`
      INSERT INTO users (
        email, pin, role, fullName, phoneNumber, dateOfBirth, gender, bloodGroup, height, weight, 
        profilePicture, recentSurgeries, previousFractures, latestMedicines,
        hasBloodPressure, hasBloodSugar, hasThyroid, experienceYears, consultationFee, 
        licenseNumber, hospitalName, specialization, area, availabilityJSON
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

        stmt.run([
            email, hashedPin, role, fullName, phoneNumber || null, dateOfBirth, gender, bloodGroup, height, weight,
            profilePicture || null, recentSurgeries || null, previousFractures || null,
            JSON.stringify(latestMedicines || []),
            hasBloodPressure ? 1 : 0, hasBloodSugar ? 1 : 0, hasThyroid ? 1 : 0,
            experienceYears || null, consultationFee || null, licenseNumber || null, hospitalName || null,
            specialization || null, area || null, JSON.stringify(availability || {})
        ], function (err) {
            if (err) {
                if (err.message.includes('UNIQUE constraint failed')) {
                    return res.status(400).json({ error: 'Email already exists.' });
                }
                return res.status(500).json({ error: 'Error registering user.' });
            }
            res.status(201).json({ message: 'User registered successfully!', userId: this.lastID });
        });
        stmt.finalize();
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/auth/login', (req, res) => {
    const { email, pin, role } = req.body;

    if (!email || !pin || !role) {
        return res.status(400).json({ error: 'Email, PIN, and Role are required.' });
    }

    db.get('SELECT * FROM users WHERE email = ? AND role = ?', [email, role], async (err, user) => {
        if (err) {
            return res.status(500).json({ error: 'Server error' });
        }
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials. User not found for the specified role.' });
        }

        const isMatch = await bcrypt.compare(pin, user.pin);
        if (!isMatch) {
            return res.status(401).json({ error: 'Incorrect PIN.' });
        }

        // Convert booleans and parse JSON for medicines
        const userData = { ...user };
        userData.hasBloodPressure = !!userData.hasBloodPressure;
        userData.hasBloodSugar = !!userData.hasBloodSugar;
        userData.hasThyroid = !!userData.hasThyroid;
        try {
            if (userData.latestMedicines) {
                userData.latestMedicines = JSON.parse(userData.latestMedicines);
            }
            if (userData.availabilityJSON) {
                userData.availability = JSON.parse(userData.availabilityJSON);
                delete userData.availabilityJSON;
            }
        } catch (e) { /* ignore */ }

        // Don't send hashed pin back to frontend
        delete userData.pin;

        res.json({ message: 'Login successful!', user: userData });
    });
});

app.put('/api/users/:email', (req, res) => {
    const { email } = req.params;
    let data = { ...req.body };

    if (data.role === 'doctor' && data.fullName) {
        const trimmedName = data.fullName.trim();
        if (!trimmedName.toLowerCase().startsWith('dr. ') && !trimmedName.toLowerCase().startsWith('dr ')) {
            data.fullName = 'Dr. ' + trimmedName;
        }
    }

    // Create dynamic update query based on fields provided
    const keys = Object.keys(data).filter(k => k !== 'email' && k !== 'pin');
    if (keys.length === 0) return res.status(400).json({ error: 'No fields to update' });

    const setClause = keys.map(k => {
        if (k === 'availability') return 'availabilityJSON = ?';
        return `${k} = ?`;
    }).join(', ');
    const values = keys.map(k => {
        if (k === 'latestMedicines' || k === 'availability') return JSON.stringify(data[k]);
        if (typeof data[k] === 'boolean') return data[k] ? 1 : 0;
        return data[k];
    });
    values.push(email);

    db.run(`UPDATE users SET ${setClause} WHERE email = ?`, values, function (err) {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Error updating user profile' });
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({ message: 'Profile updated successfully' });
    });
});

app.get('/api/doctors', (req, res) => {
    db.all('SELECT email, fullName, hospitalName, specialization, area, availabilityJSON, experienceYears, consultationFee, profilePicture FROM users WHERE role = "doctor"', [], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Server error fetching doctors' });
        const formatted = rows.map(r => {
            let availability = {};
            try { if (r.availabilityJSON) availability = JSON.parse(r.availabilityJSON); } catch (e) { }
            delete r.availabilityJSON;
            return { ...r, availability };
        });
        res.json(formatted);
    });
});

// --- Appointments ---

app.post('/api/appointments', (req, res) => {
    const { id, patientEmail, patientName, doctorEmail, doctorName, hospital, date, time, status, amountPaid } = req.body;
    if (!patientEmail || !doctorEmail || !date || !time) {
        return res.status(400).json({ error: 'Missing required appointment fields.' });
    }

    const stmt = db.prepare(`
    INSERT INTO appointments (id, patientEmail, patientName, doctorEmail, doctorName, hospital, date, time, status, amountPaid)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

    const bookingId = id || `APT-${Date.now()}`;

    stmt.run([bookingId, patientEmail, patientName, doctorEmail, doctorName, hospital, date, time, status || 'Scheduled', amountPaid || '0'], function (err) {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Error booking appointment' });
        }

        // Mark any unpaid emergencies for this doctor-patient pair as paid
        db.run(`UPDATE emergencies SET isFeePaid = 1 WHERE patientEmail = ? AND doctorEmail = ? AND isFeePaid = 0`, [patientEmail, doctorEmail], function (err2) {
            res.status(201).json({ message: 'Appointment booked successfully', appointmentId: bookingId });
        });
    });
    stmt.finalize();
});

app.get('/api/appointments', (req, res) => {
    const { role, email } = req.query;
    if (!role || !email) {
        return res.status(400).json({ error: 'Role and email query parameters required' });
    }

    const column = role === 'doctor' ? 'doctorEmail' : 'patientEmail';

    db.all(`SELECT * FROM appointments WHERE ${column} = ?`, [email], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Server error fetching appointments' });
        res.json(rows);
    });
});

app.put('/api/appointments/:id/status', (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    db.run('UPDATE appointments SET status = ? WHERE id = ?', [status, id], function (err) {
        if (err) return res.status(500).json({ error: 'Error updating appointment status' });
        if (this.changes === 0) return res.status(404).json({ error: 'Appointment not found' });
        res.json({ message: 'Appointment status updated' });
    });
});

// --- Add Patient by Doctor (Direct Vitals Registration) ---

app.get('/api/users/:email', (req, res) => {
    const { email } = req.params;
    const { role } = req.query; // 'patient' or 'doctor'

    let query = 'SELECT * FROM users WHERE email = ?';
    let params = [email];

    if (role) {
        query += ' AND role = ?';
        params.push(role);
    }

    db.get(query, params, (err, user) => {
        if (err) return res.status(500).json({ error: 'Server error' });
        if (!user) return res.status(404).json({ error: 'User not found' });

        const userData = { ...user };
        userData.hasBloodPressure = !!userData.hasBloodPressure;
        userData.hasBloodSugar = !!userData.hasBloodSugar;
        userData.hasThyroid = !!userData.hasThyroid;
        try {
            if (userData.latestMedicines) userData.latestMedicines = JSON.parse(userData.latestMedicines);
        } catch (e) { }
        delete userData.pin;

        res.json(userData);
    });
});
// --- Emergencies ---

app.post('/api/emergencies', (req, res) => {
    const { id, patientEmail, patientName, doctorEmail, doctorName, problemDescription, area, hospital } = req.body;
    if (!patientEmail || !doctorEmail || !problemDescription) {
        return res.status(400).json({ error: 'Missing required emergency fields.' });
    }

    const emergencyId = id || `EMG-${Date.now()}`;

    db.run(`
    INSERT INTO emergencies (id, patientEmail, patientName, doctorEmail, doctorName, problemDescription, area, hospital)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [emergencyId, patientEmail, patientName, doctorEmail, doctorName, problemDescription, area || null, hospital || null], function (err) {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Error creating emergency request' });
        }
        res.status(201).json({ message: 'Emergency request submitted', emergencyId });
    });
});

app.get('/api/emergencies', (req, res) => {
    const { role, email } = req.query;
    if (!role || !email) {
        return res.status(400).json({ error: 'Role and email query parameters required' });
    }

    const column = role === 'doctor' ? 'doctorEmail' : 'patientEmail';

    db.all(`SELECT * FROM emergencies WHERE ${column} = ? ORDER BY created_at DESC`, [email], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Server error fetching emergencies' });
        res.json(rows);
    });
});

app.put('/api/emergencies/:id', (req, res) => {
    const { id } = req.params;
    const { prescription } = req.body;

    db.run('UPDATE emergencies SET status = ?, prescription = ? WHERE id = ?', ['Replied', prescription, id], function (err) {
        if (err) return res.status(500).json({ error: 'Error updating emergency request' });
        if (this.changes === 0) return res.status(404).json({ error: 'Emergency request not found' });
        res.json({ message: 'Emergency replied' });
    });
});

app.get('/api/emergencies/unpaid/:doctorEmail/:patientEmail', (req, res) => {
    const { doctorEmail, patientEmail } = req.params;
    db.get(`SELECT COUNT(*) as count FROM emergencies WHERE doctorEmail = ? AND patientEmail = ? AND isFeePaid = 0`, [doctorEmail, patientEmail], (err, row) => {
        if (err) return res.status(500).json({ error: 'Server error checking unpaid emergencies' });
        res.json({ count: row.count || 0 });
    });
});

if (process.env.NODE_ENV !== 'test') {
    app.listen(PORT, () => {
        console.log(`🚀 Backend Server running brightly on port ${PORT}`);
    });
}

export default app;
