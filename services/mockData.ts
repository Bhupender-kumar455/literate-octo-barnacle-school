import { User, School, UserRole, Student, ClassGroup, Subject, AttendanceRecord, Announcement } from '../types';

// --- Constants ---
export const CURRENT_DATE = new Date().toISOString().split('T')[0];

// --- Mock Data ---

export const mockUsers: User[] = [
  {
    id: 'u1',
    name: 'Eleanor Rigby',
    email: 'super@systema.com',
    role: UserRole.SUPER_ADMIN,
    avatar: 'https://picsum.photos/200',
  },
  {
    id: 'u2',
    name: 'Albus Dumbledore',
    email: 'admin@hogwarts.edu',
    role: UserRole.ADMIN,
    avatar: 'https://picsum.photos/201',
    phone: '+1 555 0101'
  },
  {
    id: 'u3',
    name: 'Minerva McGonagall',
    email: 'teacher@hogwarts.edu',
    role: UserRole.TEACHER,
    avatar: 'https://picsum.photos/202',
    phone: '+1 555 0102'
  },
  {
    id: 'u4',
    name: 'Severus Snape',
    email: 'snape@hogwarts.edu',
    role: UserRole.TEACHER,
    avatar: 'https://picsum.photos/203',
    phone: '+1 555 0103'
  }
];

export const mockSchools: School[] = [
  {
    id: 's1',
    name: 'Hogwarts Academy',
    address: 'Highlands, Scotland',
    phone: '555-1234',
    logo: 'https://picsum.photos/seed/hogwarts/100',
    created_by: 'u1',
    studentCount: 450,
    principalName: 'Albus Dumbledore'
  },
  {
    id: 's2',
    name: 'Midtown Science High',
    address: 'Queens, New York',
    phone: '555-5678',
    logo: 'https://picsum.photos/seed/midtown/100',
    created_by: 'u1',
    studentCount: 1200,
    principalName: 'Morita'
  },
  {
    id: 's3',
    name: 'Xavier Institute',
    address: 'Westchester, New York',
    phone: '555-9999',
    logo: 'https://picsum.photos/seed/xavier/100',
    created_by: 'u1',
    studentCount: 85,
    principalName: 'Charles Xavier'
  }
];

export const mockClasses: ClassGroup[] = [
  { id: 'c1', school_id: 's1', grade: '10', section: 'A', academic_year: '2025-2026', class_teacher_id: 'u3' },
  { id: 'c2', school_id: 's1', grade: '10', section: 'B', academic_year: '2025-2026', class_teacher_id: 'u4' },
  { id: 'c3', school_id: 's1', grade: '11', section: 'A', academic_year: '2025-2026', class_teacher_id: 'u3' },
];

export const mockSubjects: Subject[] = [
  { id: 'sub1', school_id: 's1', name: 'Transfiguration', code: 'TRN101' },
  { id: 'sub2', school_id: 's1', name: 'Potions', code: 'POT101' },
  { id: 'sub3', school_id: 's1', name: 'Defense Against Dark Arts', code: 'DADA' },
];

export const mockStudents: Student[] = [
  { id: 'st1', school_id: 's1', class_id: 'c1', admission_no: 'A001', roll_number: '1', name: 'Harry Potter', gender: 'Male', dob: '1980-07-31', guardian_name: 'Vernon Dursley', guardian_phone: '555-0001', fees_status: 'Paid' },
  { id: 'st2', school_id: 's1', class_id: 'c1', admission_no: 'A002', roll_number: '2', name: 'Hermione Granger', gender: 'Female', dob: '1979-09-19', guardian_name: 'Mr. Granger', guardian_phone: '555-0002', fees_status: 'Paid' },
  { id: 'st3', school_id: 's1', class_id: 'c1', admission_no: 'A003', roll_number: '3', name: 'Ron Weasley', gender: 'Male', dob: '1980-03-01', guardian_name: 'Molly Weasley', guardian_phone: '555-0003', fees_status: 'Pending' },
  { id: 'st4', school_id: 's1', class_id: 'c1', admission_no: 'A004', roll_number: '4', name: 'Draco Malfoy', gender: 'Male', dob: '1980-06-05', guardian_name: 'Lucius Malfoy', guardian_phone: '555-0004', fees_status: 'Paid' },
  { id: 'st5', school_id: 's1', class_id: 'c1', admission_no: 'A005', roll_number: '5', name: 'Neville Longbottom', gender: 'Male', dob: '1980-07-30', guardian_name: 'Augusta', guardian_phone: '555-0005', fees_status: 'Overdue' },
];

export const mockAnnouncements: Announcement[] = [
  { id: 'an1', title: 'Exam Schedule Released', message: 'Final exams start next Monday. Please check the timetable.', date: '2025-05-10', type: 'alert' },
  { id: 'an2', title: 'Sports Day Winner', message: 'Gryffindor wins the house cup!', date: '2025-05-01', type: 'success' },
];

// Helper to get simulated stats for dashboards
export const getAdminStats = () => ({
  totalStudents: 450,
  totalTeachers: 24,
  attendanceRate: 92.5,
  pendingFees: '$12,450'
});

export const getSuperAdminStats = () => ({
  totalSchools: 3,
  totalStudents: 1735,
  totalRevenue: '$173,500/mo',
  activeToday: 1560
});