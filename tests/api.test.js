import request from 'supertest';
import app from '../server/index.js'; // You might need to adjust export in index.js to `module.exports = app`
import db from '../server/db.js';

describe('Backend API Endpoints', () => {

    // Create random testing email string to avoid unique constraint failures
    const testEmail = `testuser${Date.now()}@gmail.com`;
    const docEmail = `testdoctor${Date.now()}@gmail.com`;

    it('Should register a new patient successfully', async () => {
        const res = await request('http://localhost:5000')
            .post('/api/auth/register')
            .send({
                email: testEmail,
                pin: '123456',
                role: 'patient',
                fullName: 'Test Patient',
                dateOfBirth: '1990-01-01',
                gender: 'male',
                bloodGroup: 'A+',
                height: '180',
                weight: '75',
                hasBloodPressure: false,
                hasBloodSugar: false,
                hasThyroid: false
            });

        expect(res.statusCode).toEqual(201);
        expect(res.body).toHaveProperty('message', 'User registered successfully!');
    });

    it('Should login the newly created patient successfully', async () => {
        const res = await request('http://localhost:5000')
            .post('/api/auth/login')
            .send({
                email: testEmail,
                pin: '123456',
                role: 'patient'
            });

        expect(res.statusCode).toEqual(200);
        expect(res.body).toHaveProperty('message', 'Login successful!');
        expect(res.body.user).toHaveProperty('email', testEmail);
    });

    it('Should fail to login with an incorrect PIN', async () => {
        const res = await request('http://localhost:5000')
            .post('/api/auth/login')
            .send({
                email: testEmail,
                pin: '000000',
                role: 'patient'
            });

        expect(res.statusCode).toEqual(401);
        expect(res.body).toHaveProperty('error', 'Incorrect PIN.');
    });

    it('Should register a doctor successfully', async () => {
        const res = await request('http://localhost:5000')
            .post('/api/auth/register')
            .send({
                email: docEmail,
                pin: '654321',
                role: 'doctor',
                fullName: 'Test Doctor',
                specialization: 'Cardiology',
                area: 'Downtown',
                hospitalName: 'General Hospital',
                experienceYears: '10',
                consultationFee: '1000',
                licenseNumber: 'DOC12345'
            });

        expect(res.statusCode).toEqual(201);
    });

    it('Should fetch the list of dynamic doctors', async () => {
        const res = await request('http://localhost:5000')
            .get('/api/doctors');

        expect(res.statusCode).toEqual(200);
        expect(Array.isArray(res.body)).toBeTruthy();
        // At least our test doctor should be there
        expect(res.body.length).toBeGreaterThan(0);
    });

    it('Should allow a patient to book an appointment', async () => {
        const res = await request('http://localhost:5000')
            .post('/api/appointments')
            .send({
                id: 'TEST-APPT-123',
                patientEmail: testEmail,
                patientName: 'Test Patient',
                doctorEmail: docEmail,
                doctorName: 'Dr. Test Doctor',
                hospital: 'General Hospital',
                date: '2026-10-10',
                time: '10:00 AM - 11:00 AM'
            });

        expect(res.statusCode).toEqual(201);
        expect(res.body).toHaveProperty('message', 'Appointment booked successfully');
    });

    it('Should fetch appointments for the patient', async () => {
        const res = await request('http://localhost:5000')
            .get(`/api/appointments?role=patient&email=${testEmail}`);

        expect(res.statusCode).toEqual(200);
        expect(Array.isArray(res.body)).toBeTruthy();
        expect(res.body.length).toBe(1);
        expect(res.body[0].doctorName).toBe('Dr. Test Doctor');
    });

});
