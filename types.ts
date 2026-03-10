
export interface StatData {
  label: string;
  value: string | number;
  trend: string;
  trendUp: boolean;
  color: 'emerald' | 'slate' | 'blue' | 'amber';
}

export interface Appointment {
  id: string;
  doctorName: string;
  specialty: string;
  date: string;
  time: string;
  status: 'Upcoming' | 'Completed' | 'Cancelled';
  avatar: string;
}

export interface Prescription {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  refills: number;
  lastFilled: string;
}

export interface CareTeamMember {
  id: string;
  name: string;
  role: string;
  status: 'Online' | 'Offline' | 'On Break';
  avatar: string;
}

export interface WellnessData {
  day: string;
  activityScore: number;
  hydrationLevel: number;
}

export interface PatientDetails {
  fullName: string;
  phoneNumber?: string;
  dateOfBirth: string;
  age: string;
  bloodGroup: string;
  height: string;
  weight: string;
  lastBloodTest: string;
  hasBloodPressure: boolean;
  hasBloodSugar: boolean;
  hasThyroid: boolean;
  recentSurgeries: string;
  previousFractures: string;
  previousDoctor: string;
  latestMedicines: string[];
  profilePicture: string | null;
  gender: string;
}

export interface DoctorDetails {
  email?: string;
  fullName: string;
  phoneNumber?: string;
  age: string;
  specialization: string;
  area: string;
  hospitalName: string;
  experienceYears: string;
  licenseNumber: string;
  consultationFee: string;
  profilePicture: string | null;
  availability: { [date: string]: string[] };
}

export interface BookedAppointment {
  id: string;
  bookingId: string;
  date: string;
  area: string;
  hospital: string;
  doctor: string;
  doctorEmail?: string; // To identify which doctor's dashboard to show this in
  time: string;
  patientEmail: string;
  patientName: string;
  paymentStatus: 'Paid' | 'Pending' | 'Refunded';
  amountPaid?: string;
}

export interface AppNotification {
  id: string;
  recipientEmail: string;
  title: string;
  message: string;
  date: string;
  isRead: boolean;
  type: 'appointment_booked' | 'other';
  bookingId?: string;
}
