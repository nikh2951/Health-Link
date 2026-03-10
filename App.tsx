

import React, { useState, useRef, useEffect, useMemo } from 'react';
import QRCode from 'react-qr-code';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { HealthChart } from './components/HealthChart';
import { CARE_TEAM, MEDICAL_DATA } from './constants';
import { PatientDetails, DoctorDetails, BookedAppointment, StatData, AppNotification } from './types';
import { getHealthInsight } from './services/geminiService';

const AVAILABLE_TIME_SLOTS = [
  '10:00 AM - 11:00 AM', '11:00 AM - 12:00 PM', '12:00 PM - 01:00 PM',
  '01:00 PM - 02:00 PM', '02:00 PM - 03:00 PM', '03:00 PM - 04:00 PM',
  '04:00 PM - 05:00 PM', '05:00 PM - 06:00 PM', '06:00 PM - 07:00 PM',
  '07:00 PM - 08:00 PM', '08:00 PM - 09:00 PM', '09:00 PM - 10:00 PM',
  '10:00 PM - 11:00 PM'
];

const MAX_APPOINTMENTS_PER_SLOT = 5;
const API_BASE = typeof window !== 'undefined' ? `http://${window.location.hostname}:5000` : 'http://localhost:5000';

// --- GLOBAL STORAGE HELPERS ---
const getGlobalDoctors = (): DoctorDetails[] => {
  const data = localStorage.getItem('healthlink_global_doctors');
  return data ? JSON.parse(data) : [];
};

const saveGlobalDoctor = (doctor: DoctorDetails) => {
  const current = getGlobalDoctors();
  const filtered = current.filter(d => d.email !== doctor.email);
  localStorage.setItem('healthlink_global_doctors', JSON.stringify([...filtered, doctor]));
};

const getGlobalAppointments = (): BookedAppointment[] => {
  const data = localStorage.getItem('healthlink_global_appointments');
  return data ? JSON.parse(data) : [];
};

const saveGlobalAppointment = (appt: BookedAppointment) => {
  const current = getGlobalAppointments();
  localStorage.setItem('healthlink_global_appointments', JSON.stringify([...current, appt]));
};

const getGlobalNotifications = (): AppNotification[] => {
  const data = localStorage.getItem('healthlink_global_notifications');
  return data ? JSON.parse(data) : [];
};

const saveGlobalNotification = (notif: AppNotification) => {
  const current = getGlobalNotifications();
  localStorage.setItem('healthlink_global_notifications', JSON.stringify([...current, notif]));
};

const updateGlobalNotifications = (notifs: AppNotification[]) => {
  localStorage.setItem('healthlink_global_notifications', JSON.stringify(notifs));
};

const calculateAge = (dob: string): string => {
  if (!dob) return '';
  const birthDate = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age >= 0 ? age.toString() : '0';
};

const isValidGmail = (email: string) => {
  return email.toLowerCase().endsWith('@gmail.com');
};

const isTimePassed = (slot: string, date: string) => {
  try {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const today = `${y}-${m}-${d}`;

    if (date < today) return true;
    if (date > today) return false;

    const startTimePart = slot.split('-')[0].trim().toUpperCase();
    const match = startTimePart.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/);
    if (!match) return false;

    let [_, hoursStr, minutesStr, modifier] = match;
    let hours = parseInt(hoursStr, 10);
    const minutes = parseInt(minutesStr, 10);

    if (modifier === 'PM' && hours < 12) hours += 12;
    else if (modifier === 'AM' && hours === 12) hours = 0;

    const slotTime = new Date(now);
    slotTime.setHours(hours, minutes, 0, 0);
    return slotTime.getTime() <= now.getTime();
  } catch (e) {
    return false;
  }
};

const isSlotPassed = (slot: string, date: string) => {
  try {
    const now = new Date();
    const today = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0')
    ].join('-');

    if (date !== today) return false;

    // slot is something like "10:00 AM - 11:00 AM"
    const startTimePart = slot.split('-')[0].trim(); // "10:00 AM"
    const match = startTimePart.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);

    if (!match) return false;

    let [_, hoursStr, minutesStr, modifier] = match;
    let hours = parseInt(hoursStr, 10);
    let minutes = parseInt(minutesStr, 10);

    modifier = modifier.toUpperCase();
    if (modifier === 'PM' && hours < 12) hours += 12;
    else if (modifier === 'AM' && hours === 12) hours = 0;

    const slotTime = new Date(now);
    slotTime.setHours(hours, minutes, 0, 0);

    return slotTime.getTime() < now.getTime();
  } catch (e) {
    return false;
  }
};

const LiveClock = () => {
  const [time, setTime] = useState(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex items-center gap-3 bg-white px-5 py-2.5 rounded-2xl border border-slate-100 shadow-sm">
      <div className="relative flex h-3 w-3">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
      </div>
      <span className="text-sm font-black text-slate-900 tabular-nums tracking-tight">{time}</span>
    </div>
  );
};

// --- COMPONENTS ---

const ProfileModal = ({ isOpen, onClose, details, role, email }: { isOpen: boolean, onClose: () => void, details: any, role: string, email: string }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[210] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-2xl rounded-[40px] p-10 shadow-2xl relative text-left max-h-[90vh] overflow-y-auto">
        <button onClick={onClose} className="absolute top-8 right-8 text-slate-400 hover:text-slate-900 transition-colors">✕</button>
        <div className="flex items-center gap-6 mb-8">
          <div className="w-24 h-24 rounded-3xl bg-slate-100 flex items-center justify-center text-slate-300 overflow-hidden shrink-0">
            {details?.profilePicture ? <img src={details.profilePicture} alt="Profile" className="w-full h-full object-cover" /> : <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" /></svg>}
          </div>
          <div>
            <h2 className="text-3xl font-black text-slate-900">{details?.fullName || 'User'}</h2>
            <p className="text-slate-500 font-medium">{email}</p>
            <span className="inline-block mt-2 bg-[#004D40] text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest">{role}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest border-b pb-2">Vital Statistics</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-slate-50 rounded-2xl"><p className="text-[10px] text-slate-400 font-bold uppercase">Age</p><p className="font-bold">{details?.age} Yrs</p></div>
              <div className="p-3 bg-slate-50 rounded-2xl"><p className="text-[10px] text-slate-400 font-bold uppercase">Blood Group</p><p className="font-bold">{details?.bloodGroup || 'N/A'}</p></div>
              <div className="p-3 bg-slate-50 rounded-2xl"><p className="text-[10px] text-slate-400 font-bold uppercase">Weight</p><p className="font-bold">{details?.weight} kg</p></div>
              <div className="p-3 bg-slate-50 rounded-2xl"><p className="text-[10px] text-slate-400 font-bold uppercase">Height</p><p className="font-bold">{details?.height} cm</p></div>
              {role === 'patient' && (
                <>
                  <div className="p-3 bg-slate-50 rounded-2xl"><p className="text-[10px] text-slate-400 font-bold uppercase">Gender</p><p className="font-bold capitalize">{details?.gender || 'N/A'}</p></div>
                </>
              )}
            </div>
          </div>
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest border-b pb-2">Medical History</h3>
            <div className="p-4 bg-slate-50 rounded-2xl">
              <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Recent Surgeries</p>
              <p className="text-sm font-medium">{details?.recentSurgeries || 'No surgeries reported.'}</p>
            </div>
            <div className="p-4 bg-slate-50 rounded-2xl">
              <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Previous Fractures</p>
              <p className="text-sm font-medium">{details?.previousFractures || 'No fractures reported.'}</p>
            </div>
            <div className="p-4 bg-slate-50 rounded-2xl">
              <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Current Medicines</p>
              <div className="flex flex-wrap gap-2 mt-1">
                {details?.latestMedicines?.map((m: string, i: number) => (
                  <span key={i} className="text-[10px] bg-white border px-2 py-0.5 rounded-md font-bold text-slate-600">{m}</span>
                )) || 'None'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const SettingsView = ({ details, role, email, onUpdate }: { details: any, role: string, email: string, onUpdate: (newDetails: any) => void }) => {
  const [formData, setFormData] = useState(details);

  useEffect(() => {
    setFormData(details);
  }, [details]);

  const handleSave = () => {
    onUpdate(formData);
    alert('Profile updated successfully!');
  };

  return (
    <div className="bg-white p-10 rounded-[40px] border border-slate-100 shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-4xl mx-auto">
      <h2 className="text-3xl font-black text-slate-900 mb-8">Personal Records & Settings</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
        <div className="space-y-6">
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Registration Data</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 ml-1">Email</label>
              <input readOnly value={email} className="w-full bg-slate-50 border-none rounded-2xl py-3 px-4 outline-none text-slate-500 font-medium cursor-not-allowed" />
            </div>
            {role === 'doctor' && (
              <>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 ml-1">Role</label>
                  <input readOnly value="Doctor / Medical Professional" className="w-full bg-slate-50 border-none rounded-2xl py-3 px-4 outline-none text-slate-500 font-medium cursor-not-allowed" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 ml-1">Hospital / Clinic</label>
                  <input readOnly value={details?.hospitalName} className="w-full bg-slate-50 border-none rounded-2xl py-3 px-4 outline-none text-slate-500 font-bold cursor-not-allowed" />
                </div>
              </>
            )}
            {role === 'patient' && (
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 ml-1">Role</label>
                <input readOnly value="Patient" className="w-full bg-slate-50 border-none rounded-2xl py-3 px-4 outline-none text-slate-500 font-medium cursor-not-allowed" />
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <h3 className="text-sm font-bold text-[#004D40] uppercase tracking-widest mb-4">Editable Records</h3>

          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center overflow-hidden border border-slate-200">
              {formData?.profilePicture ? <img src={formData.profilePicture} alt="Profile" className="w-full h-full object-cover" /> : <svg className="w-8 h-8 text-slate-300" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" /></svg>}
            </div>
            <div>
              <label className="cursor-pointer bg-white text-slate-700 border border-slate-200 px-4 py-2 rounded-xl text-xs font-bold hover:bg-slate-50 transition-all shadow-sm">
                Change Photo
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onloadend = () => {
                        setFormData({ ...formData, profilePicture: reader.result });
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                />
              </label>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 ml-1">Full Name</label>
            <input
              type="text"
              value={formData?.fullName}
              onChange={e => setFormData({ ...formData, fullName: e.target.value })}
              className="w-full bg-emerald-50/30 border border-emerald-100 rounded-2xl py-3 px-4 outline-none focus:ring-2 focus:ring-[#004D40] font-bold"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 ml-1">Age</label>
              <input
                type="number"
                value={formData?.age}
                onChange={e => setFormData({ ...formData, age: e.target.value })}
                className="w-full bg-emerald-50/30 border border-emerald-100 rounded-2xl py-3 px-4 outline-none focus:ring-2 focus:ring-[#004D40] font-bold"
              />
            </div>
            {role === 'patient' && (
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 ml-1">Blood Group</label>
                <input
                  type="text"
                  value={formData?.bloodGroup}
                  onChange={e => setFormData({ ...formData, bloodGroup: e.target.value })}
                  className="w-full bg-emerald-50/30 border border-emerald-100 rounded-2xl py-3 px-4 outline-none focus:ring-2 focus:ring-[#004D40] font-bold"
                />
              </div>
            )}
            {role === 'doctor' && (
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 ml-1">Exp (Years)</label>
                <input
                  type="number"
                  value={formData?.experienceYears}
                  onChange={e => setFormData({ ...formData, experienceYears: e.target.value })}
                  className="w-full bg-emerald-50/30 border border-emerald-100 rounded-2xl py-3 px-4 outline-none focus:ring-2 focus:ring-[#004D40] font-bold"
                />
              </div>
            )}
          </div>

          {role === 'doctor' && (
            <>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 ml-1">Consultation Fee (INR)</label>
                <input
                  type="number"
                  value={formData?.consultationFee}
                  onChange={e => setFormData({ ...formData, consultationFee: e.target.value })}
                  className="w-full bg-emerald-50/30 border border-emerald-100 rounded-2xl py-3 px-4 outline-none focus:ring-2 focus:ring-[#004D40] font-bold"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 ml-1">License Number</label>
                <input
                  type="text"
                  value={formData?.licenseNumber}
                  onChange={e => setFormData({ ...formData, licenseNumber: e.target.value })}
                  className="w-full bg-emerald-50/30 border border-emerald-100 rounded-2xl py-3 px-4 outline-none focus:ring-2 focus:ring-[#004D40] font-bold"
                />
              </div>
            </>
          )}

          {role === 'patient' && (
            <>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 ml-1">Body Weight (kg)</label>
                <input
                  type="number"
                  value={formData?.weight}
                  onChange={e => setFormData({ ...formData, weight: e.target.value })}
                  className="w-full bg-emerald-50/30 border border-emerald-100 rounded-2xl py-3 px-4 outline-none focus:ring-2 focus:ring-[#004D40] font-bold"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 ml-1">Recent Surgeries</label>
                <textarea
                  rows={2}
                  value={formData?.recentSurgeries}
                  onChange={e => setFormData({ ...formData, recentSurgeries: e.target.value })}
                  className="w-full bg-emerald-50/30 border border-emerald-100 rounded-2xl py-3 px-4 outline-none focus:ring-2 focus:ring-[#004D40] text-sm font-medium"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 ml-1">Previous Fractures</label>
                <textarea
                  rows={2}
                  value={formData?.previousFractures}
                  onChange={e => setFormData({ ...formData, previousFractures: e.target.value })}
                  className="w-full bg-emerald-50/30 border border-emerald-100 rounded-2xl py-3 px-4 outline-none focus:ring-2 focus:ring-[#004D40] text-sm font-medium"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 ml-1">Medicines Used (Comma separated)</label>
                <textarea
                  rows={3}
                  value={formData?.latestMedicines?.join(', ')}
                  onChange={e => setFormData({ ...formData, latestMedicines: e.target.value.split(',').map(s => s.trim()) })}
                  className="w-full bg-emerald-50/30 border border-emerald-100 rounded-2xl py-3 px-4 outline-none focus:ring-2 focus:ring-[#004D40] text-sm font-medium"
                />
              </div>
            </>
          )}
          <button onClick={handleSave} className="w-full bg-[#004D40] text-white font-bold py-4 rounded-2xl shadow-xl hover:bg-[#00382D] transition-all">Save Changes</button>
        </div>
      </div>
    </div>
  );
};

const AppointmentsView = ({ appointments, role }: { appointments: BookedAppointment[], role: 'patient' | 'doctor' }) => (
  <div className="space-y-8 animate-in fade-in duration-500">
    <div className="bg-white p-10 rounded-[40px] border border-slate-100 shadow-sm">
      <h2 className="text-3xl font-black text-slate-900 mb-8">{role === 'doctor' ? 'Patient Appointments' : 'My Appointments'}</h2>
      {appointments.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {appointments.map(a => (
            <div key={a.id} className="p-6 bg-slate-50 rounded-[32px] border border-transparent hover:border-[#004D40] transition-all group">
              <div className="flex justify-between items-start mb-4">
                <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-[#004D40] shadow-sm">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                </div>
                <div className="bg-emerald-100 text-[#004D40] text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest">
                  ID: {a.bookingId || 'N/A'}
                </div>
              </div>
              <h3 className="text-xl font-black text-slate-900 mb-1">
                {role === 'doctor' ? (a.patientName ? `Patient: ${a.patientName}` : 'Patient Records') : a.doctor}
              </h3>
              <p className="text-slate-500 text-sm font-medium mb-4">
                {role === 'doctor' ? 'Scheduled Consultation' : a.hospital}
              </p>
              <div className="flex items-center gap-4 text-[#004D40]">
                <div className="flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  <span className="text-xs font-bold">{a.date}</span>
                </div>
                <div className="flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  <span className="text-xs font-bold">{a.time}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-20 text-center bg-slate-50 rounded-[40px] border-2 border-dashed border-slate-200">
          <p className="text-slate-400 font-medium italic">No appointments found.</p>
        </div>
      )}
    </div>
  </div>
);

const PrescriptionsView = ({ medicines }: { medicines: string[] }) => (
  <div className="space-y-8 animate-in fade-in duration-500">
    <div className="bg-white p-10 rounded-[40px] border border-slate-100 shadow-sm">
      <h2 className="text-3xl font-black text-slate-900 mb-8">My Medicines</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {medicines && medicines.length > 0 && medicines.some(m => m.trim() !== "") ? medicines.filter(m => m.trim() !== "").map((med, idx) => (
          <div key={idx} className="p-6 bg-slate-50 rounded-[32px] border-2 border-transparent hover:border-[#004D40] hover:bg-white transition-all">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-10 h-10 bg-[#004D40] text-white rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
              </div>
              <h3 className="text-lg font-black text-slate-900">{med}</h3>
            </div>
            <p className="text-sm text-slate-500 font-medium italic">Active Medication</p>
          </div>
        )) : (
          <div className="col-span-3 py-20 text-center bg-slate-50 rounded-[40px] border-2 border-dashed border-slate-200">
            <p className="text-slate-400 italic">No medicines listed in your records.</p>
          </div>
        )}
      </div>
    </div>
  </div>
);

const VitalsView = ({ appointments, doctorEmail }: { appointments: BookedAppointment[], doctorEmail: string }) => {
  const [selectedPatientEmail, setSelectedPatientEmail] = useState<string>('');
  const [patientDetails, setPatientDetails] = useState<PatientDetails | null>(null);
  const [isNewPatientModalOpen, setIsNewPatientModalOpen] = useState(false);
  const [manualPatients, setManualPatients] = useState<{ name: string, email: string }[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem(`healthlink_manual_patients_${doctorEmail}`);
    if (saved) {
      setManualPatients(JSON.parse(saved));
    }
  }, [doctorEmail]);

  // Filter appointments for this doctor and get unique patients
  const doctorAppointments = appointments.filter(a => a.doctorEmail === doctorEmail);
  const allPatients = [...doctorAppointments.map(a => ({ name: a.patientName, email: a.patientEmail })), ...manualPatients];
  const uniquePatients = Array.from(new Set(allPatients.map(a => JSON.stringify(a))))
    .map(s => JSON.parse(s));

  const handleAddDirectPatient = (email: string, details: PatientDetails) => {
    const exists = uniquePatients.find((p: any) => p.email === email);
    if (!exists) {
      const newPatient = { name: details.fullName, email };
      const updated = [...manualPatients, newPatient];
      setManualPatients(updated);
      localStorage.setItem(`healthlink_manual_patients_${doctorEmail}`, JSON.stringify(updated));
    }
    localStorage.setItem(`healthlink_data_patient_${email}`, JSON.stringify({ details }));
    setSelectedPatientEmail(email);
    setIsNewPatientModalOpen(false);
  };

  useEffect(() => {
    if (selectedPatientEmail) {
      const saved = localStorage.getItem(`healthlink_data_patient_${selectedPatientEmail}`);
      if (saved) {
        setPatientDetails(JSON.parse(saved).details);
      } else {
        setPatientDetails(null);
      }
    } else {
      setPatientDetails(null);
    }
  }, [selectedPatientEmail]);

  const calculateBMI = (details: PatientDetails) => {
    const h = parseFloat(details.height) / 100;
    const w = parseFloat(details.weight);
    if (!h || !w) return 'N/A';
    return (w / (h * h)).toFixed(1);
  };

  const getBMICategory = (bmi: string) => {
    if (bmi === 'N/A') return 'Unknown';
    const num = parseFloat(bmi);
    if (num < 18.5) return 'Underweight';
    if (num < 25) return 'Healthy';
    if (num < 30) return 'Overweight';
    return 'Obese';
  };

  const getHealthStatus = (details: PatientDetails) => {
    let riskScore = 0;
    const reasons: string[] = [];

    // BMI Risk
    const h = parseFloat(details.height) / 100;
    const w = parseFloat(details.weight);
    const bmi = h > 0 ? (w / (h * h)) : 0;
    if (bmi > 30) {
      riskScore += 2;
      reasons.push("Obesity");
    } else if (bmi > 25) {
      riskScore += 1;
      reasons.push("Overweight");
    } else if (bmi < 18.5 && bmi > 0) {
      riskScore += 1;
      reasons.push("Underweight");
    }

    // Chronic Conditions
    if (details.hasBloodPressure) {
      riskScore += 2;
      reasons.push("Hypertension (BP)");
    }
    if (details.hasBloodSugar) {
      riskScore += 2;
      reasons.push("Diabetes (Sugar)");
    }
    if (details.hasThyroid) {
      riskScore += 1;
      reasons.push("Thyroid Issue");
    }

    // Medical History
    const medCount = details.latestMedicines?.filter(m => m.trim() !== "").length || 0;
    if (medCount > 3) {
      riskScore += 2;
      reasons.push("Heavy Medication");
    } else if (medCount > 0) {
      riskScore += 1;
      reasons.push("On Medication");
    }

    const hasSurgeries = details.recentSurgeries && details.recentSurgeries.toLowerCase() !== 'none' && details.recentSurgeries.trim() !== "";
    if (hasSurgeries) {
      riskScore += 2;
      reasons.push("Recent Surgery/Surgical History");
    }

    const hasFractures = details.previousFractures && details.previousFractures.toLowerCase() !== 'none' && details.previousFractures.trim() !== "";
    if (hasFractures) {
      riskScore += 1;
      reasons.push("Previous Fracture");
    }

    // Age Risk
    const ageNum = parseInt(details.age);
    if (ageNum > 60) {
      riskScore += 1;
      reasons.push("High Age Group");
    }

    if (riskScore <= 1) {
      return {
        status: 'Good',
        color: 'bg-emerald-500',
        text: 'Patient condition is stable with no significant risk factors noted.',
        riskScore,
        reasons
      };
    }
    if (riskScore <= 4) {
      return {
        status: 'Moderate',
        color: 'bg-amber-500',
        text: reasons.length > 0 ? `Moderate health risks: ${reasons.slice(0, 3).join(', ')}...` : 'Regular monitoring required for stable recovery.',
        riskScore,
        reasons
      };
    }
    return {
      status: 'Serious',
      color: 'bg-red-500',
      text: `Serious condition! Multiple risk factors: ${reasons.join(', ')}. Immediate care and strict evaluation required.`,
      riskScore,
      reasons
    };
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="bg-white/90 backdrop-blur-sm p-10 rounded-[40px] border border-white shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
        <h2 className="text-3xl font-black text-slate-900 mb-8 flex items-center gap-3">
          <span className="w-2 h-8 rounded-full bg-blue-500 block"></span>
          Patient Vitals & Diagnostic History
        </h2>

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-10 gap-4">
          <div className="w-full max-w-md">
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2 ml-1">Select Patient from Appointment List</label>
            <select
              value={selectedPatientEmail}
              onChange={(e) => setSelectedPatientEmail(e.target.value)}
              className="w-full bg-slate-50 border-none rounded-2xl py-4 px-6 outline-none focus:ring-2 focus:ring-blue-600 font-bold"
            >
              <option value="">Choose a patient...</option>
              {uniquePatients.map((p: any) => (
                <option key={p.email} value={p.email}>{p.name} ({p.email})</option>
              ))}
            </select>
          </div>
          <button onClick={() => setIsNewPatientModalOpen(true)} className="bg-blue-600 text-white font-bold py-3 px-6 rounded-2xl shadow-xl hover:bg-blue-700 transition-all flex items-center gap-2 h-14">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
            New Patient Vitals
          </button>
        </div>

        {patientDetails ? (
          <div className="animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
              {/* BMI Card */}
              <div className="p-8 bg-gradient-to-br from-slate-50 to-white rounded-[32px] border border-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)] transition-shadow">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/30">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 0 002 2h2a2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-900">BMI Index</h3>
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Body Mass Index</p>
                  </div>
                </div>

                <div className="flex items-end gap-3 mb-4">
                  <span className="text-5xl font-black text-blue-600">{calculateBMI(patientDetails)}</span>
                  <span className="text-sm font-bold text-slate-400 pb-1">kg/m²</span>
                </div>

                <div className={`inline-block px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest bg-blue-600 text-white`}>
                  Category: {getBMICategory(calculateBMI(patientDetails))}
                </div>

                <div className="mt-8 space-y-3">
                  <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase">
                    <span>Underweight</span>
                    <span>Healthy</span>
                    <span>Overweight</span>
                  </div>
                  <div className="h-3 w-full bg-slate-200 rounded-full overflow-hidden flex">
                    <div className="h-full bg-blue-300" style={{ width: '25%' }}></div>
                    <div className="h-full bg-emerald-400" style={{ width: '25%' }}></div>
                    <div className="h-full bg-amber-400" style={{ width: '25%' }}></div>
                    <div className="h-full bg-red-400" style={{ width: '25%' }}></div>
                  </div>
                </div>
              </div>

              {/* Health Indicator Card */}
              <div className="p-8 bg-gradient-to-br from-slate-50 to-white rounded-[32px] border border-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)] transition-shadow flex flex-col">
                {(() => {
                  const health = getHealthStatus(patientDetails);
                  return (
                    <>
                      <div className="flex items-center gap-4 mb-6">
                        <div className={`w-12 h-12 text-white rounded-2xl flex items-center justify-center ${health.color} shadow-lg`}>
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                        </div>
                        <div>
                          <h3 className="text-xl font-black text-slate-900">Health Indicator</h3>
                          <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Diagnostic Level</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 mb-4">
                        <div className={`w-4 h-4 rounded-full ${health.color} animate-pulse shadow-glow`}></div>
                        <span className="text-2xl font-black text-slate-900">{health.status} Status</span>
                      </div>

                      <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm flex-1 mb-6">
                        <p className="text-sm font-medium text-slate-600 leading-relaxed mb-4">
                          "{health.text}"
                        </p>
                        {health.reasons.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {health.reasons.map((r, i) => (
                              <span key={i} className="bg-red-50 text-red-600 text-[10px] font-black px-2 py-1 rounded-lg uppercase tracking-wider border border-red-100 italic">
                                ⚠ {r}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          <span>Risk Severity</span>
                          <span>Score: {health.riskScore} / 10</span>
                        </div>
                        <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-1000 ${health.color}`}
                            style={{ width: `${Math.min((health.riskScore / 8) * 100, 100)}%` }}
                          ></div>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Medical History */}
              <div className="space-y-6">
                <h3 className="text-xl font-black text-slate-900 px-2">Patient Records</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-50 rounded-2xl"><p className="text-[10px] text-slate-400 font-bold uppercase">Weight</p><p className="font-black text-lg">{patientDetails.weight} kg</p></div>
                  <div className="p-4 bg-slate-50 rounded-2xl"><p className="text-[10px] text-slate-400 font-bold uppercase">Height</p><p className="font-black text-lg">{patientDetails.height} cm</p></div>
                  <div className="p-4 bg-slate-50 rounded-2xl"><p className="text-[10px] text-slate-400 font-bold uppercase">Blood Group</p><p className="font-black text-lg">{patientDetails.bloodGroup}</p></div>
                  <div className="p-4 bg-slate-50 rounded-2xl"><p className="text-[10px] text-slate-400 font-bold uppercase">Age</p><p className="font-black text-lg">{patientDetails.age} yrs</p></div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className={`p-4 rounded-2xl border-2 transition-all ${patientDetails.hasBloodPressure ? 'bg-red-50 border-red-100 text-red-700' : 'bg-emerald-50 border-emerald-100 text-emerald-700'}`}>
                    <p className="text-[9px] font-black uppercase mb-1">BP (H-Risk)</p>
                    <p className="font-black text-xs">{patientDetails.hasBloodPressure ? 'POSITIVE' : 'NEGATIVE'}</p>
                  </div>
                  <div className={`p-4 rounded-2xl border-2 transition-all ${patientDetails.hasBloodSugar ? 'bg-red-50 border-red-100 text-red-700' : 'bg-emerald-50 border-emerald-100 text-emerald-700'}`}>
                    <p className="text-[9px] font-black uppercase mb-1">SUGAR (Diabetes)</p>
                    <p className="font-black text-xs">{patientDetails.hasBloodSugar ? 'POSITIVE' : 'NEGATIVE'}</p>
                  </div>
                  <div className={`p-4 rounded-2xl border-2 transition-all ${patientDetails.hasThyroid ? 'bg-red-50 border-red-100 text-red-700' : 'bg-emerald-50 border-emerald-100 text-emerald-700'}`}>
                    <p className="text-[9px] font-black uppercase mb-1">THYROID</p>
                    <p className="font-black text-xs">{patientDetails.hasThyroid ? 'POSITIVE' : 'NEGATIVE'}</p>
                  </div>
                </div>
                <div className="p-6 bg-slate-50 rounded-2xl">
                  <p className="text-[10px] text-slate-400 font-bold uppercase mb-2">Recent Surgeries</p>
                  <p className="font-medium text-sm">{patientDetails.recentSurgeries || 'None reported'}</p>
                </div>
                <div className="p-6 bg-slate-50 rounded-2xl">
                  <p className="text-[10px] text-slate-400 font-bold uppercase mb-2">Previous Fractures</p>
                  <p className="font-medium text-sm">{patientDetails.previousFractures || 'None reported'}</p>
                </div>
                <div className="p-6 bg-slate-50 rounded-2xl">
                  <p className="text-[10px] text-slate-400 font-bold uppercase mb-2">Prescribed Medicines</p>
                  <div className="flex flex-wrap gap-2">
                    {patientDetails.latestMedicines?.filter(m => m.trim() !== "").map((m, i) => (
                      <span key={i} className="bg-white px-3 py-1 rounded-lg text-xs font-bold border border-slate-100 shadow-sm">{m}</span>
                    )) || 'None'}
                  </div>
                </div>
              </div>

              {/* Appointment History */}
              <div className="space-y-6">
                <h3 className="text-xl font-black text-slate-900 px-2 flex items-center gap-3">
                  <span className="w-2 h-8 rounded-full bg-blue-500 block"></span>
                  Appointment History
                </h3>
                <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
                  {doctorAppointments.filter(a => a.patientEmail === selectedPatientEmail).map(a => (
                    <div key={a.id} className="p-6 bg-white/80 backdrop-blur-md border border-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-3xl hover:-translate-y-1 hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)] transition-all">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">{a.bookingId}</p>
                          <p className="text-lg font-black text-slate-900">{a.hospital}</p>
                        </div>
                        <span className="bg-emerald-100 text-[#004D40] text-[8px] font-black px-2 py-0.5 rounded-full uppercase">{a.paymentStatus}</span>
                      </div>
                      <div className="flex items-center gap-4 text-slate-500 font-bold text-xs">
                        <div className="flex items-center gap-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                          <span>{a.date}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                          <span>{a.time}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="py-20 text-center bg-slate-50 rounded-[40px] border-2 border-dashed border-slate-200">
            <svg className="w-16 h-16 text-slate-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
            <p className="text-slate-400 font-medium italic">Please select a patient to view their vitals and medical history.</p>
          </div>
        )}
      </div>
      <NewPatientModal isOpen={isNewPatientModalOpen} onClose={() => setIsNewPatientModalOpen(false)} onAdd={handleAddDirectPatient} />
    </div>
  );
};

const NewPatientModal = ({ isOpen, onClose, onAdd }: { isOpen: boolean, onClose: () => void, onAdd: (email: string, details: any) => void }) => {
  const [step, setStep] = useState<'login' | 'onboarding'>('login');
  const [email, setEmail] = useState('');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200]">
      {step === 'login' ? (
        <LoginView role="patient" onLoginSuccess={(e) => {
          setEmail(e);
          const savedData = localStorage.getItem(`healthlink_data_patient_${e}`);
          if (savedData) {
            const parsed = JSON.parse(savedData);
            onAdd(e, parsed.details);
            setStep('login');
          } else {
            setStep('onboarding');
          }
        }} onBack={onClose} backText="← Cancel" />
      ) : (
        <div className="relative z-[201] w-full h-full bg-[#F8FAFC] overflow-y-auto">
          <button onClick={onClose} className="absolute top-8 right-8 z-[202] text-slate-400 hover:text-slate-900 font-bold text-xl">✕ Close</button>
          <OnboardingView role="patient" email={email} onComplete={(details) => { onAdd(email, details); setStep('login'); }} onBack={() => setStep('login')} />
        </div>
      )}
    </div>
  );
};

const WelcomeView = ({ onSelectRole }: { onSelectRole: (role: 'patient' | 'doctor') => void }) => (
  <div className="fixed inset-0 z-[150] flex flex-col items-center justify-center bg-gradient-to-br from-[#F8FAFC] via-[#E2E8F0] to-[#CBD5E1] p-6 overflow-hidden">
    <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-emerald-400 rounded-full blur-[140px] opacity-40 animate-pulse"></div>
    <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-500 rounded-full blur-[140px] opacity-30 animate-pulse"></div>

    <div className="relative z-10 flex flex-col items-center text-center animate-in fade-in slide-in-from-bottom-8 duration-1000 w-full max-w-4xl">
      <div className="w-24 h-24 bg-gradient-to-tr from-[#004D40] to-emerald-500 rounded-[32px] flex items-center justify-center mb-8 shadow-2xl ring-4 ring-white/50 ring-offset-4 ring-offset-[#F8FAFC]">
        <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
      </div>
      <h1 className="text-6xl font-black text-[#004D40] tracking-tighter mb-4">Health Link</h1>
      <p className="text-slate-500 text-xl font-medium max-w-lg mb-12">Bridging the gap between care and wellness for a healthier you.</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full">
        <button onClick={() => onSelectRole('patient')} className="group relative bg-white/80 backdrop-blur-xl p-10 rounded-[40px] border border-white/60 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] hover:shadow-[0_40px_60px_-15px_rgba(0,0,0,0.1)] hover:-translate-y-2 hover:border-emerald-200 transition-all text-left overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-emerald-100 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-bl-full"></div>
          <div className="relative z-10 w-16 h-16 bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-[20px] flex items-center justify-center mb-6 group-hover:from-emerald-500 group-hover:to-emerald-600 transition-colors shadow-inner">
            <svg className="w-8 h-8 text-emerald-600 group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
          </div>
          <h3 className="relative z-10 text-3xl font-black text-slate-900 mb-2">Patient Portal</h3>
          <p className="relative z-10 text-slate-500 font-medium">Book appointments and track your wellness journey seamlessly.</p>
        </button>
        <button onClick={() => onSelectRole('doctor')} className="group relative bg-white/80 backdrop-blur-xl p-10 rounded-[40px] border border-white/60 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] hover:shadow-[0_40px_60px_-15px_rgba(0,0,0,0.1)] hover:-translate-y-2 hover:border-blue-200 transition-all text-left overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-blue-100 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-bl-full"></div>
          <div className="relative z-10 w-16 h-16 bg-gradient-to-br from-blue-50 to-blue-100 rounded-[20px] flex items-center justify-center mb-6 group-hover:from-blue-500 group-hover:to-blue-600 transition-colors shadow-inner">
            <svg className="w-8 h-8 text-blue-600 group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
          </div>
          <h3 className="text-2xl font-black text-slate-900 mb-2">Doctor Portal</h3>
          <p className="text-slate-500 text-sm">Manage patients and your medical practice.</p>
        </button>
      </div>
    </div>
  </div>
);

const LoginView = ({ role, onLoginSuccess, onBack, backText = "← Back to Portal Selection" }: { role: 'patient' | 'doctor', onLoginSuccess: (email: string, password?: string, userData?: any) => void, onBack: () => void, backText?: string }) => {
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<1 | 2>(1);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidGmail(email)) {
      setError('Please enter a valid email address.');
      return;
    }
    setError('');
    setIsLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.toLowerCase().trim() })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to send OTP.');
      } else {
        setStep(2);
      }
    } catch (err) {
      setError('Server connection error. Is the backend running?');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6) {
      setError('Enter the 6-digit code sent to your email.');
      return;
    }
    setError('');
    setIsLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.toLowerCase().trim(), otp, role })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Invalid OTP.');
        setIsLoading(false);
        return;
      }

      // OTP verified successfully
      if (data.exists) {
        onLoginSuccess(email, otp, data.user); // Login
      } else {
        onLoginSuccess(email, otp, null); // Setup / Onboard
      }
    } catch (err) {
      setError('Server connection error.');
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#F8FAFC]">
      <button onClick={onBack} className="absolute top-8 left-8 md:top-12 md:left-12 text-slate-500 hover:text-slate-900 flex items-center gap-2 font-black text-sm transition-all bg-white px-5 py-3 rounded-2xl shadow-sm border border-slate-200 z-[150] hover:-translate-x-1">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
        {backText}
      </button>
      <div className="w-full max-w-md p-8 relative animate-in fade-in zoom-in duration-500">
        <div className="bg-white p-10 rounded-[40px] shadow-2xl border border-slate-100 text-center relative overflow-hidden">
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl transition-colors ${role === 'doctor' ? 'bg-blue-600' : 'bg-[#004D40]'}`}>
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          </div>
          <h2 className="text-3xl font-black text-slate-900 mb-2">Health Link</h2>
          <p className="text-slate-500 font-medium mb-8 capitalize">{role} Login</p>

          {step === 1 ? (
            <form onSubmit={handleSendOTP} className="space-y-4 animate-in slide-in-from-left duration-300">
              <input
                required
                type="email"
                placeholder="Email Address"
                value={email}
                onChange={e => { setEmail(e.target.value); setError(''); }}
                className={`w-full bg-slate-50 border-none rounded-2xl py-4 px-6 outline-none focus:ring-2 ${error ? 'focus:ring-red-500' : 'focus:ring-[#004D40]'}`}
              />
              {error && <p className="text-red-500 text-xs font-bold animate-pulse">{error}</p>}
              <button disabled={isLoading} type="submit" className={`w-full text-white font-bold py-4 rounded-2xl shadow-xl transition-all disabled:opacity-70 ${role === 'doctor' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-[#004D40] hover:bg-[#00382D]'}`}>
                {isLoading ? 'Sending Code...' : 'Send Login Code'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOTP} className="space-y-4 animate-in slide-in-from-right duration-300">
              <p className="text-sm text-slate-600 mb-2">We sent a 6-digit code to <b>{email}</b></p>
              <input
                required
                type="text"
                placeholder="Enter 6-digit Code"
                maxLength={6}
                value={otp}
                onChange={e => { setOtp(e.target.value.replace(/\D/g, '')); setError(''); }}
                className={`w-full bg-slate-50 border-none text-center tracking-[0.5em] font-black text-xl rounded-2xl py-4 px-6 outline-none focus:ring-2 ${error ? 'focus:ring-red-500' : 'focus:ring-[#004D40]'}`}
              />
              {error && <p className="text-red-500 text-xs font-bold animate-pulse">{error}</p>}
              <button disabled={isLoading} type="submit" className={`w-full text-white font-bold py-4 rounded-2xl shadow-xl transition-all disabled:opacity-70 ${role === 'doctor' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-[#004D40] hover:bg-[#00382D]'}`}>
                {isLoading ? 'Verifying...' : 'Verify & Login'}
              </button>
              <button type="button" onClick={() => setStep(1)} className="text-sm text-slate-500 hover:text-slate-800 mt-4 block w-full">Use a different email</button>
            </form>
          )}

        </div>
      </div>
    </div>
  );
};

const OnboardingView = ({ role, email, onComplete, onBack }: { role: 'patient' | 'doctor', email: string, onComplete: (details: any) => void, onBack: () => void }) => {
  const [patientData, setPatientData] = useState<PatientDetails>({
    fullName: '', phoneNumber: '', dateOfBirth: '', age: '', bloodGroup: '', height: '', weight: '', lastBloodTest: '',
    hasBloodPressure: false, hasBloodSugar: false, hasThyroid: false,
    recentSurgeries: '', previousFractures: '', previousDoctor: '', latestMedicines: [''], profilePicture: null,
    gender: ''
  });

  const [doctorData, setDoctorData] = useState<DoctorDetails>({
    fullName: '', phoneNumber: '', age: '', specialization: '', area: '', hospitalName: '', experienceYears: '', licenseNumber: '', consultationFee: '', profilePicture: null, email: email,
    availability: {}
  });

  const [nameConflictError, setNameConflictError] = useState('');

  const handleNameBlur = async (name: string) => {
    if (!name.trim()) return;
    try {
      const res = await fetch(`${API_BASE}/api/users/check-name?name=${encodeURIComponent(name.trim())}&role=${role}`);
      const data = await res.json();
      if (data.exists) {
        setNameConflictError('A user with this name already exists. Please include your surname as well.');
      } else {
        setNameConflictError('');
      }
    } catch (e) { }
  };

  const areas = MEDICAL_DATA.areas.map(a => a.name);
  const specializations = ['Cardiology', 'Neurology', 'Oncology', 'Pediatrics', 'Orthopedics', 'General Physician', 'Dermatology'];

  const handleAddMedicine = () => {
    setPatientData({ ...patientData, latestMedicines: [...patientData.latestMedicines, ''] });
  };

  const handleMedicineChange = (index: number, value: string) => {
    const updated = [...patientData.latestMedicines];
    updated[index] = value;
    setPatientData({ ...patientData, latestMedicines: updated });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const currentPhone = role === 'patient' ? patientData.phoneNumber : doctorData.phoneNumber;

    if (nameConflictError) {
      alert("Please resolve the name conflict by including your surname.");
      return;
    }
    if (!currentPhone || currentPhone.length !== 10) {
      alert("Please enter a valid 10-digit phone number.");
      return;
    }

    if (role === 'patient') {
      if (!patientData.gender) {
        alert('Please select your gender to complete your profile.');
        return;
      }
      onComplete({ ...patientData });
    } else {
      onComplete({ ...doctorData });
    }
  };

  const handleDobChange = (dob: string) => {
    const age = calculateAge(dob);
    if (role === 'patient') {
      setPatientData({ ...patientData, dateOfBirth: dob, age });
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] py-20 px-4">
      <div className="max-w-4xl mx-auto bg-white rounded-[40px] p-12 shadow-sm border border-slate-100 relative">
        <button type="button" onClick={onBack} className="absolute top-8 left-8 text-slate-400 font-bold text-sm hover:text-slate-900 transition-colors">← Back</button>
        <h2 className={`text-4xl font-black mt-4 mb-8 ${role === 'doctor' ? 'text-blue-600' : 'text-[#004D40]'}`}>Create Your {role} Profile</h2>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {role === 'patient' ? (
            <>
              <div className="space-y-6">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">1. Full Name</label>
                  <input required placeholder="Enter name" onBlur={() => handleNameBlur(patientData.fullName)} value={patientData.fullName} onChange={e => { setPatientData({ ...patientData, fullName: e.target.value }); setNameConflictError(''); }} className={`w-full bg-slate-50 border-none rounded-2xl py-3 px-4 outline-none ${nameConflictError ? 'ring-2 ring-red-500' : ''}`} />
                  {nameConflictError && <p className="text-red-500 text-xs font-bold mt-1 ml-1 animate-pulse">{nameConflictError}</p>}
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">2. Phone Number</label>
                  <input required placeholder="10-digit Phone" maxLength={10} value={patientData.phoneNumber} onChange={e => setPatientData({ ...patientData, phoneNumber: e.target.value.replace(/\D/g, '') })} className="w-full bg-slate-50 border-none rounded-2xl py-3 px-4 outline-none" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="text-[10px] font-bold text-slate-400 uppercase ml-1">3. DOB</label><input required type="date" value={patientData.dateOfBirth} onChange={e => handleDobChange(e.target.value)} className="w-full bg-slate-50 border-none rounded-2xl py-3 px-4 outline-none" /></div>
                  <div><label className="text-[10px] font-bold text-slate-400 uppercase ml-1">4. Age (Auto)</label><input readOnly placeholder="Age" value={patientData.age} className="w-full bg-slate-100 border-none rounded-2xl py-3 px-4 outline-none text-slate-400 cursor-not-allowed" /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">4. Blood Group</label>
                    <select required value={patientData.bloodGroup} onChange={e => setPatientData({ ...patientData, bloodGroup: e.target.value })} className="w-full bg-slate-50 border-none rounded-2xl py-3 px-4 outline-none text-slate-600 font-bold">
                      <option value="" disabled>Select</option>
                      <option value="A+">A+</option>
                      <option value="A-">A-</option>
                      <option value="B+">B+</option>
                      <option value="B-">B-</option>
                      <option value="AB+">AB+</option>
                      <option value="AB-">AB-</option>
                      <option value="O+">O+</option>
                      <option value="O-">O-</option>
                    </select>
                  </div>
                  <div><label className="text-[10px] font-bold text-slate-400 uppercase ml-1">5. Height (cm)</label><input required placeholder="cm" value={patientData.height} onChange={e => setPatientData({ ...patientData, height: e.target.value })} className="w-full bg-slate-50 border-none rounded-2xl py-3 px-4 outline-none" /></div>
                </div>
                <div><label className="text-[10px] font-bold text-slate-400 uppercase ml-1">6. Weight (kg)</label><input required placeholder="kg" value={patientData.weight} onChange={e => setPatientData({ ...patientData, weight: e.target.value })} className="w-full bg-slate-50 border-none rounded-2xl py-3 px-4 outline-none" /></div>
              </div>
              <div className="space-y-6">
                <div className="flex flex-wrap gap-4 p-4 bg-slate-50 rounded-2xl">
                  <label className="flex items-center gap-2 text-xs font-bold cursor-pointer"><input type="checkbox" checked={patientData.hasBloodPressure} onChange={e => setPatientData({ ...patientData, hasBloodPressure: e.target.checked })} /> BP</label>
                  <label className="flex items-center gap-2 text-xs font-bold cursor-pointer"><input type="checkbox" checked={patientData.hasBloodSugar} onChange={e => setPatientData({ ...patientData, hasBloodSugar: e.target.checked })} /> Sugar</label>
                  <label className="flex items-center gap-2 text-xs font-bold cursor-pointer"><input type="checkbox" checked={patientData.hasThyroid} onChange={e => setPatientData({ ...patientData, hasThyroid: e.target.checked })} /> Thyroid</label>
                </div>
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">8. Gender</label>
                    <span className="text-[8px] font-black text-red-500 uppercase tracking-widest bg-red-50 px-2 py-0.5 rounded-full ring-1 ring-red-100">Required</span>
                  </div>
                  <div className={`flex gap-4 p-4 rounded-2xl transition-all ${!patientData.gender ? 'bg-red-50/50 ring-1 ring-red-100' : 'bg-slate-50'}`}>
                    <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
                      <input type="checkbox" checked={patientData.gender === 'male'} onChange={() => setPatientData({ ...patientData, gender: 'male' })} /> Male
                    </label>
                    <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
                      <input type="checkbox" checked={patientData.gender === 'female'} onChange={() => setPatientData({ ...patientData, gender: 'female' })} /> Female
                    </label>
                    <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
                      <input type="checkbox" checked={patientData.gender === 'other'} onChange={() => setPatientData({ ...patientData, gender: 'other' })} /> Other
                    </label>
                  </div>
                </div>
                <div><label className="text-[10px] font-bold text-slate-400 uppercase ml-1">9. Recent Surgeries</label><input placeholder="List any recent surgeries" value={patientData.recentSurgeries} onChange={e => setPatientData({ ...patientData, recentSurgeries: e.target.value })} className="w-full bg-slate-50 border-none rounded-2xl py-3 px-4 outline-none" /></div>
                <div><label className="text-[10px] font-bold text-slate-400 uppercase ml-1">10. Previous Fractures</label><input placeholder="List any previous fractures" value={patientData.previousFractures} onChange={e => setPatientData({ ...patientData, previousFractures: e.target.value })} className="w-full bg-slate-50 border-none rounded-2xl py-3 px-4 outline-none" /></div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase ml-1 mb-2 block">12. Prescribed Medicines</label>
                  <div className="space-y-3">
                    {patientData.latestMedicines.map((med, idx) => (
                      <input
                        key={idx}
                        placeholder={`Medicine #${idx + 1}`}
                        value={med}
                        onChange={e => handleMedicineChange(idx, e.target.value)}
                        className="w-full bg-slate-50 border-none rounded-2xl py-3 px-4 outline-none"
                      />
                    ))}
                    <button type="button" onClick={handleAddMedicine} className="w-full border-2 border-dashed border-slate-200 rounded-2xl py-3 text-slate-400 text-xs font-bold hover:border-[#004D40] hover:text-[#004D40] transition-all">
                      + Add Another Medicine
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-6">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Full Name</label>
                  <input required placeholder="Enter name (Dr. will be prepended automatically)" onBlur={() => handleNameBlur(doctorData.fullName)} value={doctorData.fullName} onChange={e => { setDoctorData({ ...doctorData, fullName: e.target.value }); setNameConflictError(''); }} className={`w-full bg-slate-50 border-none rounded-2xl py-3 px-4 outline-none ${nameConflictError ? 'ring-2 ring-red-500' : ''}`} />
                  {nameConflictError && <p className="text-red-500 text-xs font-bold mt-1 ml-1 animate-pulse">{nameConflictError}</p>}
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Phone Number</label>
                  <input required placeholder="10-digit Phone" maxLength={10} value={doctorData.phoneNumber} onChange={e => setDoctorData({ ...doctorData, phoneNumber: e.target.value.replace(/\D/g, '') })} className="w-full bg-slate-50 border-none rounded-2xl py-3 px-4 outline-none" />
                </div>
                <div><label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Specialization</label>
                  <select required value={doctorData.specialization} onChange={e => setDoctorData({ ...doctorData, specialization: e.target.value })} className="w-full bg-slate-50 border-none rounded-2xl py-3 px-4 outline-none">
                    <option value="">Select Specialty</option>
                    {specializations.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div><label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Select Area</label>
                  <select required value={doctorData.area} onChange={e => { setDoctorData({ ...doctorData, area: e.target.value, hospitalName: '' }) }} className="w-full bg-slate-50 border-none rounded-2xl py-4 px-6 outline-none">
                    <option value="">Select Area</option>
                    {areas.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
                <div><label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Current Hospital</label>
                  <select required disabled={!doctorData.area} value={doctorData.hospitalName} onChange={e => setDoctorData({ ...doctorData, hospitalName: e.target.value })} className="w-full bg-slate-50 border-none rounded-2xl py-4 px-6 outline-none disabled:opacity-50">
                    <option value="">Select Hospital</option>
                    {MEDICAL_DATA.areas.find(a => a.name === doctorData.area)?.hospitals.map(h => <option key={h.name} value={h.name}>{h.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Age</label><input required placeholder="Years" type="number" value={doctorData.age} onChange={e => setDoctorData({ ...doctorData, age: e.target.value })} className="w-full bg-slate-50 border-none rounded-2xl py-3 px-4 outline-none" /></div>
                  <div><label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Experience</label><input required placeholder="Yrs Exp" type="number" value={doctorData.experienceYears} onChange={e => setDoctorData({ ...doctorData, experienceYears: e.target.value })} className="w-full bg-slate-50 border-none rounded-2xl py-3 px-4 outline-none" /></div>
                </div>
                <input required placeholder="Medical License Number" value={doctorData.licenseNumber} onChange={e => setDoctorData({ ...doctorData, licenseNumber: e.target.value })} className="w-full bg-slate-50 border-none rounded-2xl py-3 px-4 outline-none" />
                <input required placeholder="Consultation Fee (INR)" type="number" value={doctorData.consultationFee} onChange={e => setDoctorData({ ...doctorData, consultationFee: e.target.value })} className="w-full bg-slate-50 border-none rounded-2xl py-3 px-4 outline-none" />
              </div>
            </>
          )}
          <button type="submit" className={`md:col-span-2 w-full text-white font-bold py-4 rounded-2xl shadow-xl transition-all ${role === 'doctor' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-[#004D40] hover:bg-[#00382D]'}`}>Finish Registration</button>
        </form>
      </div>
    </div>
  );
};

const DashboardView = ({ details, appointments, onOpenBooking, email }: { details: PatientDetails, appointments: BookedAppointment[], onOpenBooking: () => void, email: string }) => {
  const [insight, setInsight] = useState("Analyzing your vitals for today...");
  const [showQR, setShowQR] = useState(false);

  useEffect(() => {
    getHealthInsight({ bp: "120/80", hr: "72bpm" }).then(setInsight);
  }, []);

  const getSafeQRUrl = () => {
    const base = typeof window !== 'undefined' ? `${window.location.protocol}//192.168.0.211:3000?mobileLogin=${encodeURIComponent(email)}&role=patient` : '';
    try {
      const qrApptsString = JSON.stringify(appointments.slice(0, 5));
      const exportDetails = { ...details, profilePicture: null };
      const qrData = btoa(unescape(encodeURIComponent(JSON.stringify(exportDetails))));
      const qrAppts = btoa(unescape(encodeURIComponent(qrApptsString)));
      const full = `${base}&d=${encodeURIComponent(qrData)}&a=${encodeURIComponent(qrAppts)}`;
      if (full.length < 2500) return full;
      const lessApptsUrl = `${base}&d=${encodeURIComponent(qrData)}`;
      if (lessApptsUrl.length < 2500) return lessApptsUrl;
    } catch (e) { }
    return base;
  };
  const qrUrl = getSafeQRUrl();

  return (
    <div className="space-y-8 animate-in fade-in duration-700 relative">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <h2 className="text-3xl font-black text-slate-900">Health Overview</h2>
          <LiveClock />
        </div>
        <div className="flex gap-4">
          <button onClick={() => setShowQR(true)} className="bg-white text-slate-700 border border-slate-200 px-6 py-3 rounded-2xl font-bold hover:bg-slate-50 transition-all flex items-center gap-2 shadow-sm">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
            View on Mobile
          </button>
          <button onClick={onOpenBooking} className="bg-[#004D40] text-white px-8 py-3 rounded-2xl font-bold shadow-xl shadow-emerald-900/10 hover:scale-105 transition-all">Book Appointment</button>
        </div>
      </div>

      {showQR && (
        <div className="fixed inset-0 z-[300] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-[40px] p-10 max-w-sm w-full text-center relative animate-in zoom-in duration-300 shadow-2xl">
            <button onClick={() => setShowQR(false)} className="absolute top-6 right-6 text-slate-400 hover:text-slate-900 text-xl font-bold">✕</button>
            <div className="w-16 h-16 bg-emerald-50 text-[#004D40] rounded-2xl flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
            </div>
            <h3 className="text-2xl font-black text-slate-900 mb-2">Scan to View</h3>
            <p className="text-sm text-slate-500 font-medium mb-8">Point your phone's camera at this QR code to instantly track your vitals on the go.</p>
            <div className="bg-slate-50 p-4 rounded-3xl mx-auto mb-6 border border-slate-100 w-48 h-48 flex items-center justify-center">
              <QRCode value={qrUrl} size={192} style={{ height: "auto", maxWidth: "100%", width: "100%" }} />
            </div>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Secure Local Connection</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white/90 backdrop-blur-sm p-6 rounded-[32px] border border-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)] transition-shadow">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Weight</p>
          <p className="text-3xl font-black bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">{details.weight} <span className="text-lg text-slate-400 font-bold">kg</span></p>
        </div>
        <div className="bg-white/90 backdrop-blur-sm p-6 rounded-[32px] border border-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)] transition-shadow">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Blood Group</p>
          <p className="text-3xl font-black text-red-500">{details.bloodGroup}</p>
        </div>
        <div className="bg-white/90 backdrop-blur-sm p-6 rounded-[32px] border border-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)] transition-shadow">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Age</p>
          <p className="text-3xl font-black bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">{details.age} <span className="text-lg text-slate-400 font-bold">yrs</span></p>
        </div>
        <div className="bg-white/90 backdrop-blur-sm p-6 rounded-[32px] border border-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)] transition-shadow">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Height</p>
          <p className="text-3xl font-black bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">{details.height} <span className="text-lg text-slate-400 font-bold">cm</span></p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-gradient-to-br from-[#004D40] to-emerald-800 p-8 rounded-[40px] text-white shadow-[0_20px_40px_-15px_rgba(0,77,64,0.4)] relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2"></div>
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-400 opacity-10 rounded-full blur-3xl transform -translate-x-1/2 translate-y-1/2"></div>
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-white/10 backdrop-blur-md rounded-xl flex items-center justify-center border border-white/20">
                  <svg className="w-5 h-5 text-emerald-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                </div>
                <span className="font-bold text-sm tracking-widest text-emerald-100 uppercase">AI Health Insight</span>
              </div>
              <p className="text-2xl font-medium leading-relaxed">"{insight}"</p>
            </div>
          </div>
          <div className="bg-white/90 backdrop-blur-sm p-8 rounded-[40px] border border-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)] transition-shadow">
            <h3 className="text-xl font-black text-slate-900 mb-6 flex items-center gap-3">
              <span className="w-2 h-8 rounded-full bg-emerald-500 block"></span>
              Activity History
            </h3>
            <HealthChart />
          </div>
        </div>
        <div className="space-y-8">
          <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm">
            <h3 className="font-black text-slate-900 mb-6">Upcoming Appointments</h3>
            <div className="space-y-4">
              {appointments.slice(0, 3).map(a => (
                <div key={a.id} className="p-4 bg-slate-50 rounded-2xl border border-transparent hover:border-emerald-100 transition-all">
                  <p className="font-black text-slate-900 text-sm">{a.doctor}</p>
                  <p className="text-xs text-slate-500">{a.hospital}</p>
                  <p className="text-[10px] font-black text-[#004D40] mt-2 uppercase tracking-wider">{a.date} @ {a.time}</p>
                </div>
              ))}
              {appointments.length === 0 && <p className="text-xs text-slate-400 italic">No bookings found.</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const DoctorDashboard = ({ details, appointments, onSaveAvailability, email }: { details: DoctorDetails, appointments: BookedAppointment[], onSaveAvailability: (date: string, slots: string[]) => void, email: string }) => {
  const [viewingPatient, setViewingPatient] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedSlots, setSelectedSlots] = useState<string[]>([]);
  const [showQR, setShowQR] = useState(false);

  useEffect(() => {
    if (selectedDate && details.availability && details.availability[selectedDate]) {
      setSelectedSlots(details.availability[selectedDate]);
    } else {
      setSelectedSlots([]);
    }
  }, [selectedDate, details.availability]);

  const myQueue = appointments.filter(a => a.doctorEmail === details.email);
  const getSafeQRUrl = () => {
    const base = typeof window !== 'undefined' ? `${window.location.protocol}//192.168.0.211:3000?mobileLogin=${encodeURIComponent(email)}&role=doctor` : '';
    try {
      const qrApptsString = JSON.stringify(myQueue.slice(0, 5));
      const exportDetails = { ...details, profilePicture: null };
      const qrData = btoa(unescape(encodeURIComponent(JSON.stringify(exportDetails))));
      const qrAppts = btoa(unescape(encodeURIComponent(qrApptsString)));
      const full = `${base}&d=${encodeURIComponent(qrData)}&a=${encodeURIComponent(qrAppts)}`;
      if (full.length < 2500) return full;

      const smallDetails = { ...details, profilePicture: null, availability: {} };
      const smallData = btoa(unescape(encodeURIComponent(JSON.stringify(smallDetails))));
      const med = `${base}&d=${encodeURIComponent(smallData)}&a=${encodeURIComponent(qrAppts)}`;
      if (med.length < 2500) return med;

      const min = `${base}&d=${encodeURIComponent(smallData)}`;
      if (min.length < 2500) return min;
    } catch (e) { }
    return base;
  };
  const qrUrl = getSafeQRUrl();

  return (
    <div className="space-y-8 animate-in fade-in duration-500 relative">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
        <div className="flex items-center gap-4">
          <h2 className="text-3xl font-black text-slate-900">Doctor Dashboard</h2>
          <LiveClock />
        </div>
        <button onClick={() => setShowQR(true)} className="bg-white text-slate-700 border border-slate-200 px-6 py-3 rounded-2xl font-bold hover:bg-slate-50 transition-all flex items-center gap-2 shadow-sm">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
          View on Mobile
        </button>
      </div>

      {showQR && (
        <div className="fixed inset-0 z-[300] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-[40px] p-10 max-w-sm w-full text-center relative animate-in zoom-in duration-300 shadow-2xl">
            <button onClick={() => setShowQR(false)} className="absolute top-6 right-6 text-slate-400 hover:text-slate-900 text-xl font-bold">✕</button>
            <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
            </div>
            <h3 className="text-2xl font-black text-slate-900 mb-2">Scan to View</h3>
            <p className="text-sm text-slate-500 font-medium mb-8">Point your phone's camera at this QR code to manage your clinic on the go.</p>
            <div className="bg-slate-50 p-4 rounded-3xl mx-auto mb-6 border border-slate-100 w-48 h-48 flex items-center justify-center">
              <QRCode value={qrUrl} size={192} style={{ height: "auto", maxWidth: "100%", width: "100%" }} />
            </div>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Secure Local Connection</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white/90 backdrop-blur-sm p-8 rounded-[40px] border border-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)] transition-shadow">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Consultations</p>
          <p className="text-4xl font-black bg-gradient-to-r from-blue-700 to-blue-500 bg-clip-text text-transparent">{myQueue.length}</p>
        </div>
        <div className="bg-white/90 backdrop-blur-sm p-8 rounded-[40px] border border-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)] transition-shadow">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Clinic Fee</p>
          <p className="text-4xl font-black bg-gradient-to-r from-emerald-600 to-emerald-400 bg-clip-text text-transparent">₹{details.consultationFee}</p>
        </div>
        <div className="bg-white/90 backdrop-blur-sm p-8 rounded-[40px] border border-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)] transition-shadow">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Practice</p>
          <p className="text-2xl font-black text-slate-800 truncate">{details.hospitalName}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white/90 backdrop-blur-sm p-8 rounded-[40px] border border-white shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
          <h3 className="text-2xl font-black text-slate-900 mb-6 flex items-center gap-3">
            <span className="w-2 h-8 rounded-full bg-blue-500 block"></span>
            Manage Your Availability
          </h3>
          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase ml-1 block mb-2">1. Select Date</label>
              <input
                type="date"
                min={new Date().toISOString().split('T')[0]}
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                className="w-full bg-slate-50 border-none rounded-2xl py-4 px-6 outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            {selectedDate && (
              <div className="animate-in fade-in slide-in-from-top-2 mt-6">
                <label className="text-[10px] font-bold text-slate-400 uppercase ml-1 block mb-2">2. Select Timings for {selectedDate}</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-64 overflow-y-auto p-5 bg-slate-50/80 rounded-3xl border border-slate-100">
                  {AVAILABLE_TIME_SLOTS.map(slot => {
                    const isBooked = myQueue.some(a => a.date === selectedDate && a.time === slot);
                    return (
                      <label key={slot} className={`flex items-center gap-2 text-[10px] font-bold text-slate-600 bg-white p-3 rounded-xl border border-slate-100 transition-all ${isBooked && selectedSlots.includes(slot) ? 'opacity-60 cursor-not-allowed bg-slate-50' : 'cursor-pointer hover:border-blue-200'}`}>
                        <input
                          type="checkbox"
                          checked={selectedSlots.includes(slot)}
                          disabled={isBooked && selectedSlots.includes(slot)}
                          onChange={e => {
                            if (e.target.checked) setSelectedSlots([...selectedSlots, slot]);
                            else setSelectedSlots(selectedSlots.filter(s => s !== slot));
                          }}
                        />
                        <span className="truncate">{slot}</span>
                        {isBooked && selectedSlots.includes(slot) && (
                          <span className="ml-auto flex items-center gap-1 text-[8px] text-red-500 font-black uppercase tracking-tighter">
                            <svg className="w-2 h-2" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" /></svg>
                            Locked
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>
                <button
                  onClick={() => {
                    if (selectedSlots.length === 0) return alert('Please select at least one time slot');
                    onSaveAvailability(selectedDate, selectedSlots);
                    alert(`Availability saved for ${selectedDate}`);
                  }}
                  className="w-full mt-6 bg-blue-600 text-white font-bold py-4 rounded-2xl shadow-xl hover:bg-blue-700 transition-all"
                >
                  Submit Timings for this Date
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white/90 backdrop-blur-sm rounded-[40px] border border-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden flex flex-col">
          <div className="p-8 border-b border-slate-50">
            <h3 className="text-2xl font-black text-slate-900 flex items-center gap-3">
              <span className="w-2 h-8 rounded-full bg-emerald-500 block"></span>
              Patient Queue
            </h3>
          </div>
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left">
              <thead className="bg-slate-50/50 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                <tr>
                  <th className="px-8 py-4">Patient</th>
                  <th className="px-8 py-4">Schedule</th>
                  <th className="px-8 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {myQueue.map(appt => (
                  <tr key={appt.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-8 py-6"><span className="font-bold text-slate-900">{appt.patientName}</span></td>
                    <td className="px-8 py-6 font-bold text-slate-600 text-[10px]">{appt.date} • {appt.time}</td>
                    <td className="px-8 py-6 text-right"><button onClick={() => setViewingPatient(appt.patientEmail)} className="text-blue-600 text-[10px] font-bold hover:underline">Medical Record</button></td>
                  </tr>
                ))}
                {myQueue.length === 0 && <tr><td colSpan={3} className="px-8 py-20 text-center text-slate-400 italic">Queue is empty.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {selectedDate && details.availability && details.availability[selectedDate] && (
        <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm animate-in fade-in slide-in-from-bottom-2">
          <h3 className="text-xl font-black text-slate-900 mb-6">Slot Booking Status for {selectedDate}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {details.availability[selectedDate].map(slot => {
              const bookedForSlot = myQueue.filter(a => a.date === selectedDate && a.time === slot).length;
              const remaining = MAX_APPOINTMENTS_PER_SLOT - bookedForSlot;
              return (
                <div key={slot} className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col justify-between">
                  <p className="text-xs font-black text-slate-900 mb-2">{slot}</p>
                  <div className="flex justify-between items-end">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Booked</p>
                      <p className={`text-lg font-black ${bookedForSlot >= MAX_APPOINTMENTS_PER_SLOT ? 'text-red-500' : 'text-blue-600'}`}>{bookedForSlot}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Remaining</p>
                      <p className={`text-lg font-black ${remaining === 0 ? 'text-red-500' : 'text-emerald-600'}`}>{remaining}</p>
                    </div>
                  </div>
                  <div className="mt-3 h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${bookedForSlot >= MAX_APPOINTMENTS_PER_SLOT ? 'bg-red-500' : 'bg-blue-600'}`}
                      style={{ width: `${(bookedForSlot / MAX_APPOINTMENTS_PER_SLOT) * 100}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

const BookingModal = ({ isOpen, onClose, onBook, patientName, patientEmail }: { isOpen: boolean, onClose: () => void, onBook: (appt: BookedAppointment) => void, patientName: string, patientEmail: string }) => {
  const [selectedArea, setSelectedArea] = useState('');
  const [selectedHospital, setSelectedHospital] = useState('');
  const [selectedSpecialization, setSelectedSpecialization] = useState('');
  const [selectedDoctor, setSelectedDoctor] = useState<{ name: string, email?: string, specialization?: string, fee?: string } | null>(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [showPayment, setShowPayment] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => setCurrentTime(Date.now()), 10000); // Update every 10s
    return () => clearInterval(interval);
  }, [isOpen]);

  const appointments = useMemo(() => getGlobalAppointments(), [isOpen]);

  const [registeredDoctors, setRegisteredDoctors] = useState<{ name: string, email?: string, specialization?: string, fee?: string, hospitalName?: string, area?: string, availability?: any }[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    fetch(`${API_BASE}/api/doctors`)
      .then(res => res.json())
      .then(data => {
        const remote = data.map((d: any) => ({ ...d, name: `Dr. ${d.fullName}`, fee: d.consultationFee }));
        const local = getGlobalDoctors();
        const merged = [...local];
        remote.forEach((r: any) => { if (!merged.find(m => m.email === r.email)) merged.push(r); });
        setRegisteredDoctors(merged);
      })
      .catch(() => setRegisteredDoctors(getGlobalDoctors()));
  }, [isOpen]);
  const specializations = ['Cardiology', 'Neurology', 'Oncology', 'Pediatrics', 'Orthopedics', 'General Physician', 'Dermatology'];

  const doctorsList = useMemo<{ name: string, email?: string, specialization?: string, fee?: string }[]>(() => {
    if (!selectedHospital || !selectedSpecialization) return [];

    // Filter dynamically registered doctors by specialty and area/hospital
    const filteredRegistered = registeredDoctors
      .filter(d =>
        d.hospitalName === selectedHospital &&
        d.area === selectedArea &&
        d.specialization === selectedSpecialization
      )
      .map(d => ({
        name: `Dr. ${d.fullName}`,
        email: d.email,
        specialization: d.specialization,
        fee: d.consultationFee
      }));

    return filteredRegistered;
  }, [selectedArea, selectedHospital, selectedSpecialization, registeredDoctors]);

  const availableSlotsForDoctorAndDate = useMemo(() => {
    if (!selectedDoctor || !selectedDate) return [];

    const registered = registeredDoctors.find(d => `Dr. ${d.fullName}` === selectedDoctor.name);
    if (registered && registered.availability && registered.availability[selectedDate]) {
      return registered.availability[selectedDate].filter(slot => !isTimePassed(slot, selectedDate));
    }

    return [];
  }, [selectedDoctor, selectedDate, registeredDoctors, currentTime]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white w-full max-w-xl rounded-[40px] p-10 shadow-2xl relative animate-in zoom-in duration-300">
        <button onClick={onClose} className="absolute top-8 right-8 text-slate-400 hover:text-slate-900 transition-colors">✕</button>

        {showPayment ? (
          <div>
            <button onClick={() => setShowPayment(false)} className="text-slate-400 hover:text-slate-900 font-bold text-sm mb-6 flex items-center gap-2">← Back to Details</button>
            <h2 className="text-3xl font-black text-slate-900 mb-2">Complete Payment</h2>
            <p className="text-slate-500 font-medium mb-8">Securely pay the consultation fee to confirm.</p>

            <div className="bg-slate-50 rounded-3xl p-6 mb-8 border border-slate-100">
              <div className="flex justify-between items-center mb-4">
                <span className="text-slate-500 font-bold uppercase tracking-widest text-xs">Consultation with</span>
                <span className="font-black text-slate-900">{selectedDoctor?.name}</span>
              </div>
              <div className="flex justify-between items-center mb-4 pb-4 border-b border-slate-200">
                <span className="text-slate-500 font-bold uppercase tracking-widest text-xs">Date & Time</span>
                <span className="font-black text-slate-900 text-right">{selectedDate}<br />{selectedTime}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-900 font-black uppercase tracking-widest text-sm">Amount to Pay</span>
                <span className="text-3xl font-black text-emerald-600">₹{selectedDoctor?.fee}</span>
              </div>
            </div>

            <div className="space-y-4 mb-8">
              <label className="flex items-center justify-between p-4 rounded-2xl border-2 border-[#004D40] bg-emerald-50/30 cursor-pointer">
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded-full bg-[#004D40] ring-4 ring-emerald-100 flex-shrink-0"></div>
                  <span className="font-bold text-slate-900">UPI / QR Code</span>
                </div>
                <span className="text-xs bg-emerald-100 text-[#004D40] font-bold px-2 py-1 rounded-md">Fastest</span>
              </label>
              <label className="flex items-center justify-between p-4 rounded-2xl border-2 border-slate-100 opacity-50 cursor-not-allowed">
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded-full border-2 border-slate-300 flex-shrink-0"></div>
                  <span className="font-bold text-slate-400">Credit / Debit Card</span>
                </div>
              </label>
            </div>

            <button disabled={isProcessing} onClick={() => {
              setIsProcessing(true);
              setTimeout(() => {
                onBook({
                  id: Math.random().toString(),
                  bookingId: 'HL-' + Math.random().toString(36).substr(2, 6).toUpperCase(),
                  date: selectedDate,
                  time: selectedTime,
                  area: selectedArea,
                  hospital: selectedHospital,
                  doctor: selectedDoctor!.name,
                  doctorEmail: selectedDoctor!.email,
                  patientEmail,
                  patientName,
                  paymentStatus: 'Paid'
                });
                setIsProcessing(false);
                alert('Payment Successful! Your appointment is confirmed.');
                onClose();
              }, 1500);
            }} className="w-full bg-[#004D40] text-white font-bold py-4 rounded-2xl shadow-xl hover:scale-[1.02] transition-all flex justify-center items-center gap-2">
              {isProcessing ? 'Processing Payment...' : `Pay ₹${selectedDoctor?.fee} & Confirm`}
            </button>
          </div>
        ) : (
          <>
            <h2 className="text-3xl font-black text-slate-900 mb-8">Book Appointment</h2>
            <div className="space-y-6">
              <select value={selectedArea} onChange={e => { setSelectedArea(e.target.value); setSelectedHospital(''); }} className="w-full bg-slate-50 border-none rounded-2xl py-4 px-6 outline-none focus:ring-2 focus:ring-[#004D40]">
                <option value="">Select Area</option>
                {MEDICAL_DATA.areas.map(a => <option key={a.name} value={a.name}>{a.name}</option>)}
              </select>
              <select disabled={!selectedArea} value={selectedHospital} onChange={e => setSelectedHospital(e.target.value)} className="w-full bg-slate-50 border-none rounded-2xl py-4 px-6 outline-none disabled:opacity-50 focus:ring-2 focus:ring-[#004D40]">
                <option value="">Select Hospital</option>
                {MEDICAL_DATA.areas.find(a => a.name === selectedArea)?.hospitals.map(h => <option key={h.name} value={h.name}>{h.name}</option>)}
              </select>
              <select disabled={!selectedHospital} value={selectedSpecialization} onChange={e => { setSelectedSpecialization(e.target.value); setSelectedDoctor(null); }} className="w-full bg-slate-50 border-none rounded-2xl py-4 px-6 outline-none disabled:opacity-50 focus:ring-2 focus:ring-[#004D40]">
                <option value="">Select Specialization</option>
                {specializations.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <select disabled={!selectedSpecialization} value={selectedDoctor?.name || ''} onChange={e => {
                const doc = doctorsList.find(d => d.name === e.target.value);
                if (doc) setSelectedDoctor(doc);
              }} className="w-full bg-slate-50 border-none rounded-2xl py-4 px-6 outline-none disabled:opacity-50 focus:ring-2 focus:ring-[#004D40]">
                <option value="">Select Doctor</option>
                {doctorsList.map(d => <option key={d.name} value={d.name}>{d.name}</option>)}
              </select>

              {selectedDoctor && (
                <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100 flex justify-between items-center animate-in fade-in slide-in-from-top-2">
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Selected Expert</p>
                    <p className="text-sm font-black text-[#004D40]">{selectedDoctor.name}</p>
                    <p className="text-[9px] font-bold text-slate-500 uppercase">{selectedDoctor.specialization}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Consultation Fee</p>
                    <p className="text-lg font-black text-emerald-600">₹{selectedDoctor.fee}</p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <input
                  type="date"
                  min={new Date().toISOString().split('T')[0]}
                  value={selectedDate}
                  onChange={e => setSelectedDate(e.target.value)}
                  className="w-full bg-slate-50 border-none rounded-2xl py-4 px-6 outline-none focus:ring-2 focus:ring-[#004D40]"
                />
                <select disabled={!selectedDate || !selectedDoctor} value={selectedTime} onChange={e => setSelectedTime(e.target.value)} className="w-full bg-slate-50 border-none rounded-2xl py-4 px-6 outline-none disabled:opacity-50">
                  <option value="">Select Time Slot</option>
                  {availableSlotsForDoctorAndDate.map(t => {
                    const bookedCount = appointments.filter(a => a.doctorEmail === selectedDoctor?.email && a.date === selectedDate && a.time === t).length;
                    const isFull = bookedCount >= MAX_APPOINTMENTS_PER_SLOT;
                    return (
                      <option key={t} value={t} disabled={isFull}>
                        {t} {isFull ? '(FULL)' : `(${MAX_APPOINTMENTS_PER_SLOT - bookedCount} left)`}
                      </option>
                    );
                  })}
                  {selectedDate && selectedDoctor && availableSlotsForDoctorAndDate.length === 0 && <option disabled>No slots for this date</option>}
                </select>
              </div>
              <button onClick={() => {
                if (!selectedDoctor || !selectedDate || !selectedTime) return alert('Fill all fields');

                const now = new Date();
                const today = [
                  now.getFullYear(),
                  String(now.getMonth() + 1).padStart(2, '0'),
                  String(now.getDate()).padStart(2, '0')
                ].join('-');

                if (selectedDate < today) return alert('You cannot book an appointment for a past date.');
                if (selectedDate === today && isTimePassed(selectedTime, selectedDate)) {
                  return alert('This time slot has already passed. Please select a future time.');
                }

                const bookedCount = appointments.filter(a => a.doctorEmail === selectedDoctor?.email && a.date === selectedDate && a.time === selectedTime).length;
                if (bookedCount >= MAX_APPOINTMENTS_PER_SLOT) return alert('This slot is now full. Please select another time.');

                setShowPayment(true);
              }} className="w-full bg-[#004D40] text-white font-bold py-4 rounded-2xl shadow-[0_8px_30px_rgb(0,77,64,0.3)] hover:scale-105 transition-all text-lg tracking-wide uppercase">Proceed to Payment</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// --- APP COMPONENT ---

const App = () => {
  const [role, setRole] = useState<'patient' | 'doctor'>('patient');
  const [view, setView] = useState<'welcome' | 'login' | 'onboarding' | 'home' | 'dashboard' | 'prescriptions' | 'settings' | 'appointments' | 'vitals'>('welcome');
  const [userEmail, setUserEmail] = useState('');
  const [userPassword, setUserPassword] = useState('');
  const [patientDetails, setPatientDetails] = useState<PatientDetails | null>(null);
  const [doctorDetails, setDoctorDetails] = useState<DoctorDetails | null>(null);
  const [appointments, setAppointments] = useState<BookedAppointment[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [showBooking, setShowBooking] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);

  useEffect(() => {
    setAppointments(getGlobalAppointments());
    setNotifications(getGlobalNotifications());

    // Check for mobile auto-login from QR code
    const params = new URLSearchParams(window.location.search);
    const mobileLogin = params.get('mobileLogin');
    const mobileRole = params.get('role');
    const mobileData = params.get('d');
    const mobileAppts = params.get('a');

    if (mobileLogin) {
      const normalizedEmail = mobileLogin.toLowerCase().trim();
      const resolvedRole = (mobileRole === 'doctor' ? 'doctor' : 'patient') as 'patient' | 'doctor';

      setRole(resolvedRole);
      setUserEmail(normalizedEmail);

      if (mobileData) {
        try {
          const parsedDetails = JSON.parse(decodeURIComponent(escape(atob(mobileData))));
          localStorage.setItem(`healthlink_data_${resolvedRole}_${normalizedEmail}`, JSON.stringify({ details: parsedDetails }));
        } catch (e) {
          console.error("Failed to parse mobile details");
        }
      }

      if (mobileAppts) {
        try {
          const parsedAppts = JSON.parse(decodeURIComponent(escape(atob(mobileAppts))));
          const existingList = JSON.parse(localStorage.getItem('healthlink_appointments') || '[]');
          const allAppts = [...existingList, ...parsedAppts];
          const uniqueAppts = Array.from(new Map(allAppts.map((item: any) => [item.id, item])).values()) as BookedAppointment[];
          localStorage.setItem('healthlink_appointments', JSON.stringify(uniqueAppts));
          setAppointments(uniqueAppts);
        } catch (e) {
          console.error("Failed to parse mobile appointments");
        }
      }

      const saved = localStorage.getItem(`healthlink_data_${resolvedRole}_${normalizedEmail}`);
      if (saved) {
        if (resolvedRole === 'patient') {
          setPatientDetails(JSON.parse(saved).details);
        } else {
          setDoctorDetails(JSON.parse(saved).details);
        }
        setView('dashboard');
      }
      // Clean up URL without reloading
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [view, showBooking]);

  const fetchAppointments = async (email: string, userRole: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/appointments?role=${userRole}&email=${email}`);
      const data = await res.json();
      if (Array.isArray(data)) setAppointments(data);
    } catch (e) { }
  };

  const handleLoginSuccess = async (email: string, password?: string, userData?: any) => {
    const normalizedEmail = email.toLowerCase().trim();
    setUserEmail(normalizedEmail);
    if (password) setUserPassword(password);

    if (userData) {
      if (role === 'patient') setPatientDetails(userData);
      else setDoctorDetails(userData);
      setView('home');
      fetchAppointments(normalizedEmail, role);
    } else {
      if (!password) {
        try {
          const res = await fetch(`${API_BASE}/api/users/${normalizedEmail}?role=${role}`);
          if (res.ok) {
            const data = await res.json();
            if (role === 'patient') setPatientDetails(data); else setDoctorDetails(data);
            setView('home');
            fetchAppointments(normalizedEmail, role);
            return;
          }
        } catch (e) { }
      }
      setView('onboarding');
    }
  };

  const handleOnboardingComplete = async (details: any) => {
    const normalizedEmail = userEmail.toLowerCase().trim();
    const payload = { ...details, email: normalizedEmail, pin: userPassword || '000000', role };
    try {
      const res = await fetch(`${API_BASE}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const d = await res.json();
        alert(d.error || 'Registration failed');
        return;
      }
      if (role === 'patient') setPatientDetails(payload);
      else setDoctorDetails(payload);
      setView('home');
      fetchAppointments(normalizedEmail, role);
    } catch (e) {
      alert("Registration failed");
    }
  };

  const handleUpdateDetails = async (newDetails: any) => {
    const normalizedEmail = userEmail.toLowerCase().trim();
    try {
      const res = await fetch(`${API_BASE}/api/users/${normalizedEmail}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newDetails)
      });
      if (res.ok) {
        if (role === 'patient') setPatientDetails(newDetails);
        else setDoctorDetails(newDetails);
      } else alert("Failed to update profile to database");
    } catch (e) {
      alert("Server error during update");
    }
  };

  const handleBooking = async (a: BookedAppointment) => {
    try {
      const res = await fetch(`${API_BASE}/api/appointments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(a)
      });
      if (res.ok) setAppointments(prev => [...prev, a]);
      else return alert("Failed to book appointment");
    } catch (e) { return alert("Server error"); }

    saveGlobalAppointment(a);

    // Create notifications
    const now = new Date().toLocaleString();

    // Notification for patient
    const patientNotif: AppNotification = {
      id: Math.random().toString(),
      recipientEmail: a.patientEmail,
      title: 'Appointment Confirmed',
      message: `Your appointment with ${a.doctor} at ${a.hospital} is scheduled for ${a.date} at ${a.time}. Booking ID: ${a.bookingId}`,
      date: now,
      isRead: false,
      type: 'appointment_booked',
      bookingId: a.bookingId
    };
    saveGlobalNotification(patientNotif);

    // Notification for doctor
    if (a.doctorEmail) {
      const doctorNotif: AppNotification = {
        id: Math.random().toString(),
        recipientEmail: a.doctorEmail,
        title: 'New Booking Received',
        message: `Patient ${a.patientName} has booked an appointment for ${a.date} at ${a.time}.`,
        date: now,
        isRead: false,
        type: 'appointment_booked'
      };
      saveGlobalNotification(doctorNotif);
    }

    setNotifications(getGlobalNotifications());
  };

  const handleMarkAsRead = (id: string | 'all') => {
    let updatedNotifs;
    if (id === 'all') {
      updatedNotifs = notifications.map(n => n.recipientEmail === userEmail ? { ...n, isRead: true } : n);
    } else {
      updatedNotifs = notifications.map(n => n.id === id ? { ...n, isRead: true } : n);
    }
    setNotifications(updatedNotifs);
    updateGlobalNotifications(updatedNotifs);
  };

  const handleSaveAvailability = (date: string, slots: string[]) => {
    if (!doctorDetails) return;
    const newDetails = {
      ...doctorDetails,
      availability: { ...doctorDetails.availability, [date]: slots }
    };
    handleUpdateDetails(newDetails);
  };

  const handleLogout = () => { setView('welcome'); setUserEmail(''); setPatientDetails(null); setDoctorDetails(null); setShowProfileModal(false); };

  if (view === 'welcome') return <WelcomeView onSelectRole={r => { setRole(r); setView('login'); }} />;
  if (view === 'login') return <LoginView role={role} onLoginSuccess={handleLoginSuccess} onBack={() => setView('welcome')} />;
  if (view === 'onboarding') return <OnboardingView role={role} email={userEmail} onComplete={handleOnboardingComplete} onBack={() => setView('login')} />;

  const displayName = role === 'patient' ? patientDetails?.fullName : doctorDetails?.fullName;
  const filteredAppointments = appointments.filter(a => role === 'patient' ? a.patientEmail === userEmail : a.doctorEmail === userEmail);
  const userNotifications = notifications.filter(n => n.recipientEmail === userEmail);

  return (
    <div className="flex min-h-screen bg-[#F8FAFC]">
      <Sidebar
        activeView={view}
        onViewChange={v => v === 'logout' ? handleLogout() : setView(v as any)}
        role={role}
        appointmentBadge={filteredAppointments.length}
      />
      <main className="flex-1 ml-64 p-8 transition-all duration-500">
        <TopBar
          userName={displayName || 'User'}
          userEmail={userEmail}
          profilePic={role === 'patient' ? patientDetails?.profilePicture : doctorDetails?.profilePicture}
          notifications={userNotifications}
          onProfileClick={() => setShowProfileModal(true)}
          onMarkAsRead={handleMarkAsRead}
        />

        {view === 'home' && (
          <div className="flex flex-col items-center justify-center min-h-[70vh] text-center animate-in fade-in zoom-in-95 duration-500">
            <div className={`w-24 h-24 rounded-3xl flex items-center justify-center mb-8 shadow-2xl text-white ${role === 'doctor' ? 'bg-blue-600' : 'bg-[#004D40]'}`}>
              <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            </div>
            <h1 className={`text-6xl font-black mb-6 ${role === 'doctor' ? 'text-blue-600' : 'text-[#004D40]'}`}>Hello, {displayName?.split(' ')[0]}!</h1>
            <p className="text-slate-500 mb-10 max-w-lg">Your health journey, unified. Access your medical records, care team, and wellness plan below.</p>
            <button onClick={() => setView('dashboard')} className={`text-white text-lg font-bold py-4 px-12 rounded-2xl shadow-xl hover:scale-105 transition-all ${role === 'doctor' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-[#004D40] hover:bg-[#00382D]'}`}>Open Your Dashboard</button>
          </div>
        )}

        {view === 'dashboard' && role === 'patient' && patientDetails && <DashboardView details={patientDetails} appointments={filteredAppointments} onOpenBooking={() => setShowBooking(true)} email={userEmail} />}
        {view === 'dashboard' && role === 'doctor' && doctorDetails && <DoctorDashboard details={doctorDetails} appointments={appointments} onSaveAvailability={handleSaveAvailability} email={userEmail} />}

        {view === 'appointments' && <AppointmentsView appointments={filteredAppointments} role={role} />}
        {view === 'prescriptions' && role === 'patient' && <PrescriptionsView medicines={patientDetails?.latestMedicines || []} />}
        {view === 'vitals' && role === 'doctor' && <VitalsView appointments={appointments} doctorEmail={userEmail} />}

        {view === 'settings' && <SettingsView details={role === 'patient' ? patientDetails : doctorDetails} role={role} email={userEmail} onUpdate={handleUpdateDetails} />}
      </main>

      <BookingModal isOpen={showBooking} onClose={() => setShowBooking(false)} onBook={handleBooking} patientName={patientDetails?.fullName || ''} patientEmail={userEmail} />
      <ProfileModal isOpen={showProfileModal} onClose={() => setShowProfileModal(false)} details={role === 'patient' ? patientDetails : doctorDetails} role={role} email={userEmail} />
    </div>
  );
};

export default App;
