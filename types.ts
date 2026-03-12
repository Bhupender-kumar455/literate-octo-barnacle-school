export enum UserRole {
  SUPER_ADMIN = "superadmin",
  ADMIN = "admin",
  TEACHER = "teacher",
  STUDENT = "student",
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  phone?: string;
  school_id?: number | string | null;
}

export interface Teacher extends User {
  department?: string;
  logo?: string;
  address?: string;
  joinDate?: string;
  is_active?: boolean;
  employee_id?: string;
}

export interface Student {
  id: string;
  school_id: string;
  class_id: string;
  admission_no: string;
  roll_number: number | string;
  name: string;
  logo?: string;
  gender?: "male" | "female" | "other" | string;
  dob?: string;
  guardian_name?: string;
  guardian_phone?: string;
  fees_status?: "Paid" | "Pending" | "Overdue" | string;
  class_name?: string;
}

export interface School {
  id?: string;
  school_id?: string;
  name?: string;
  school_name?: string;
  address?: string;
  phone?: string;
  logo?: string;
  created_by?: string;
  studentCount?: number;
  student_count?: number;
  principalName?: string;
  principal_name?: string;
  principal_email?: string;
  status?: number;
  plan_type?: string;
  subscription_end?: string;
  storage_limit_gb?: number;
  user_id?: number | string;
}

export interface ClassGroup {
  id: string;
  school_id: string;
  grade: string;
  section: string;
  academic_year: string;
  class_teacher_id?: string;
  teacher_name?: string;
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

export interface AttendanceRecord {
  id: string;
  student_id: string;
  date: string;
  status: "present" | "absent" | "late" | "half_day" | string;
  marked_by: string;
  remarks?: string;
}

export interface Announcement {
  id: string;
  title: string;
  message: string;
  date: string;
  type: "info" | "alert" | "success";
}

export interface NotificationTemplate {
  id: string;
  school_id?: string;
  name: string;
  channel: "in_app" | "email" | "sms" | "whatsapp" | string;
  title_template?: string;
  message_template: string;
  is_active?: boolean;
  created_at?: string;
}

export interface NotificationItem {
  id: string;
  recipient_type: "school" | "student" | "teacher" | "admin" | string;
  recipient_id?: string | number | null;
  channel: "in_app" | "email" | "sms" | "whatsapp" | string;
  title?: string;
  message: string;
  status: "queued" | "sent" | "failed" | "cancelled" | "read" | string;
  template_id?: string | number | null;
  scheduled_at?: string | null;
  sent_at?: string | null;
  read_at?: string | null;
  attempts?: number;
  last_attempt_at?: string | null;
  next_retry_at?: string | null;
  provider_message_id?: string | null;
  error_message?: string | null;
  metadata?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ChatConversation {
  id: string | number;
  school_id: string | number;
  parent_user_id: string | number | null;
  teacher_id: string | number;
  teacher_user_id?: string | number;
  student_id: string | number;
  student_name?: string;
  grade?: string;
  section?: string;
  parent_name?: string;
  parent_phone?: string;
  teacher_name?: string;
  teacher_phone?: string;
  unread_count?: number;
  last_message_id?: string | number | null;
  last_message_type?: "text" | "file" | string | null;
  last_message_text?: string | null;
  last_message_file_url?: string | null;
  last_message_file_name?: string | null;
  last_message_sender_role?: "parent" | "teacher" | string | null;
  last_message_created_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ChatMessage {
  id: string | number;
  conversation_id: string | number;
  school_id: string | number;
  sender_user_id: string | number;
  sender_role: "parent" | "teacher" | string;
  sender_name?: string;
  message_type: "text" | "file" | string;
  message_text?: string | null;
  file_url?: string | null;
  file_name?: string | null;
  file_mime_type?: string | null;
  file_size_bytes?: number | null;
  read_at?: string | null;
  created_at?: string;
}

export interface ReportCardSubject {
  subject: string;
  term: string;
  score: number;
  max_score: number;
  percentage: number;
  band: string;
}

export interface ReportCardSummary {
  total_subjects: number;
  total_score: number;
  total_max_score: number;
  percentage: number;
  grade: string;
  pass: boolean;
}

export interface StudentReportCard {
  student: {
    id: string | number;
    name: string;
    admission_no: string;
    roll_number: string | number;
    guardian_name?: string;
    guardian_phone?: string;
    class_name: string;
  };
  term?: string | null;
  subjects: ReportCardSubject[];
  summary: ReportCardSummary;
}

export interface NavItem {
  label: string;
  icon: any;
  view: string;
}

