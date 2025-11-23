export enum UserRole {
  SUPER_ADMIN = 'superadmin',
  ADMIN = 'admin', // Principal
  TEACHER = 'teacher'
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  phone?: string;
}

export interface School {
  id: string;
  name: string;
  address: string;
  phone: string;
  logo: string;
  created_by: string; // user.id
  studentCount: number;
  principalName: string;
}

export interface ClassGroup {
  id: string;
  school_id: string;
  grade: string;
  section: string; // "A", "B"
  academic_year: string;
  class_teacher_id?: string;
}

export interface Subject {
  id: string;
  school_id: string;
  name: string;
  code: string;
}

export interface ClassSubject {
  id: string;
  class_id: string;
  subject_id: string;
  teacher_id: string;
}

export interface Student {
  id: string;
  school_id: string;
  class_id: string;
  admission_no: string;
  roll_number: string;
  name: string;
  gender: 'Male' | 'Female' | 'Other';
  dob: string;
  guardian_name: string;
  guardian_phone: string;
  fees_status: 'Paid' | 'Pending' | 'Overdue';
}

export interface AttendanceRecord {
  id: string;
  student_id: string;
  date: string;
  status: 'Present' | 'Absent' | 'Late';
  marked_by: string; // teacher.id
  remarks?: string;
}

export interface Announcement {
  id: string;
  title: string;
  message: string;
  date: string;
  type: 'info' | 'alert' | 'success';
}

// For the UI flow
export interface NavItem {
  label: string;
  icon: any;
  view: string;
}