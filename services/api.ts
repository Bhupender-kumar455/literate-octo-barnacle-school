// src/services/api.ts
import axios from "axios";

export const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
const API_URL = `${API_BASE_URL}/api`;

const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Add token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      localStorage.removeItem("token");
    }
    return Promise.reject(error);
  }
);

export interface LoginResponse {
  token: string;
  user: {
    id: number;
    name: string;
    email: string;
    role: string;
    school_id: number | null;
  };
}

export const login = async (
  email: string,
  password: string,
  role: string
): Promise<LoginResponse> => {
  const res = await api.post("/auth/login", { email, password, role });
  return res.data;
};

export const getCurrentUser = async () => {
  const res = await api.get("/auth/me");
  return res.data;
};
export const getSchools = async () => {
  const res = await api.get("/superadmin/schools/all");
  return res.data;
};

export const getSuperAdminStats = async () => {
  const res = await api.get("/superadmin/stats");
  return res.data;
};

export const getAdminStats = async () => {
  const res = await api.get("/admin/stats");
  return res.data;
};

export const onboardSchool = async (payload: any) => {
  const res = await api.post("/superadmin/schools/onboard", payload);
  return res.data;
};

export const updateSchool = async (id: number | string, payload: any) => {
  const res = await api.put(`/superadmin/schools/${id}`, payload);
  return res.data;
};

export const getTeachers = async () => {
  const res = await api.get("/admin/teachers");
  return res.data;
};

export const createTeacher = async (payload: any) => {
  const res = await api.post("/admin/teachers", payload);
  return res.data;
};

export const updateTeacher = async (id: number | string, payload: any) => {
  const res = await api.put(`/admin/teachers/${id}`, payload);
  return res.data;
};

export const deleteTeacher = async (id: number | string) => {
  const res = await api.delete(`/admin/teachers/${id}`);
  return res.data;
};

export const getClasses = async () => {
  const res = await api.get("/admin/classes");
  return res.data;
};

export const createClass = async (payload: any) => {
  const res = await api.post("/admin/classes", payload);
  return res.data;
};

export const getStudents = async () => {
  const res = await api.get("/admin/students");
  return res.data;
};

export const createStudent = async (payload: any) => {
  const res = await api.post("/admin/students", payload);
  return res.data;
};

export const updateStudent = async (id: number | string, payload: any) => {
  const res = await api.put(`/admin/students/${id}`, payload);
  return res.data;
};

export const createStudentPortalUser = async (id: number | string, payload: { email: string; password: string }) => {
  const res = await api.post(`/admin/students/${id}/create-user`, payload);
  return res.data;
};

export const deleteStudent = async (id: number | string) => {
  const res = await api.delete(`/admin/students/${id}`);
  return res.data;
};

export const bulkUploadStudents = async (formData: FormData) => {
  const res = await api.post("/admin/students-bulk/bulk", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
};

export const getAnnouncements = async () => {
  const res = await api.get("/admin/announcements");
  return res.data;
};

export const createAnnouncement = async (payload: any) => {
  const res = await api.post("/admin/announcements", payload);
  return res.data;
};

export const createInvoice = async (payload: any) => {
  const res = await api.post("/admin/fees/invoices", payload);
  return res.data;
};

export const getFeesStats = async () => {
  const res = await api.get("/admin/fees/stats");
  return res.data;
};

export const getInvoices = async () => {
  const res = await api.get("/admin/fees/invoices");
  return res.data;
};

export const updateInvoiceStatus = async (id: number | string, status: string) => {
  const res = await api.put(`/admin/fees/invoices/${id}/status`, { status });
  return res.data;
};

export const getAttendanceReport = async (from?: string, to?: string) => {
  const res = await api.get("/admin/reports/attendance-summary", { params: { from, to } });
  return res.data;
};

export const getFeeReport = async (from?: string, to?: string) => {
  const res = await api.get("/admin/reports/fee-collection", { params: { from, to } });
  return res.data;
};

export const getReportDownloads = async () => {
  const res = await api.get("/admin/reports/downloads");
  return res.data;
};

export const logReportDownload = async (payload: { report_type: string; file_name: string }) => {
  const res = await api.post("/admin/reports/downloads", payload);
  return res.data;
};

export const getStudentReportCardTerms = async (studentId: number | string) => {
  const res = await api.get(`/admin/report-cards/students/${studentId}/terms`);
  return res.data;
};

export const getStudentReportCard = async (studentId: number | string, term?: string) => {
  const res = await api.get(`/admin/report-cards/students/${studentId}`, {
    params: { term },
  });
  return res.data;
};

export const downloadStudentReportCardPdf = async (studentId: number | string, term?: string) => {
  const res = await api.get(`/admin/report-cards/students/${studentId}/pdf`, {
    params: { term },
    responseType: "blob",
  });
  return res.data;
};

export const getNotificationTemplates = async () => {
  const res = await api.get("/admin/notifications/templates");
  return res.data;
};

export const createNotificationTemplate = async (payload: any) => {
  const res = await api.post("/admin/notifications/templates", payload);
  return res.data;
};

export const getNotifications = async (params?: { status?: string; channel?: string; limit?: number }) => {
  const res = await api.get("/admin/notifications", { params });
  return res.data;
};

export const queueNotification = async (payload: any) => {
  const res = await api.post("/admin/notifications", payload);
  return res.data;
};

export const triggerFeeDueNotifications = async (days_ahead?: number) => {
  const res = await api.post("/admin/notifications/trigger/fees-due", { days_ahead });
  return res.data;
};

export const updateNotificationStatus = async (id: number | string, status: string, error_message?: string) => {
  const res = await api.put(`/admin/notifications/${id}/status`, { status, error_message });
  return res.data;
};

export const runNotificationDispatchNow = async () => {
  const res = await api.post("/admin/notifications/dispatch/run-now");
  return res.data;
};

// Student portal
export const getStudentPortalProfile = async () => {
  const res = await api.get("/student/portal/me");
  return res.data;
};

export const getStudentPortalAttendance = async () => {
  const res = await api.get("/student/portal/attendance");
  return res.data;
};

export const getStudentPortalFees = async () => {
  const res = await api.get("/student/portal/fees");
  return res.data;
};

export const getStudentPortalGrades = async () => {
  const res = await api.get("/student/portal/grades");
  return res.data;
};

export const getStudentPortalAnnouncements = async () => {
  const res = await api.get("/student/portal/announcements");
  return res.data;
};

export const getStudentPortalNotifications = async (limit?: number) => {
  const res = await api.get("/student/portal/notifications", { params: { limit } });
  return res.data;
};

export const markStudentPortalNotificationRead = async (id: number | string) => {
  const res = await api.put(`/student/portal/notifications/${id}/read`);
  return res.data;
};

export const getStudentPortalReportCard = async (term?: string) => {
  const res = await api.get("/student/portal/report-card", { params: { term } });
  return res.data;
};

export const downloadStudentPortalReportCardPdf = async (term?: string) => {
  const res = await api.get("/student/portal/report-card/pdf", {
    params: { term },
    responseType: "blob",
  });
  return res.data;
};

export const getStudentPortalSchedule = async () => {
  const res = await api.get("/student/portal/schedule");
  return res.data;
};

export const getTeacherScheduleToday = async () => {
  const res = await api.get("/teacher/schedule/today");
  return res.data;
};

export const getTeacherStudents = async () => {
  const res = await api.get("/teacher/students");
  return res.data;
};

export const submitAttendanceBulk = async (payload: { date: string; records: any[] }) => {
  const res = await api.post("/teacher/attendance/bulk", payload);
  return res.data;
};

export const getAcademicReport = async () => {
  const res = await api.get("/admin/reports/academic-performance");
  return res.data;
};

export const downloadAttendanceCsv = async () => {
  const res = await api.get("/admin/reports/attendance-summary.csv", { responseType: "blob" });
  return res.data;
};

export const downloadFeeCsv = async () => {
  const res = await api.get("/admin/reports/fee-collection.csv", { responseType: "blob" });
  return res.data;
};

export const downloadAcademicCsv = async () => {
  const res = await api.get("/admin/reports/academic-performance.csv", { responseType: "blob" });
  return res.data;
};

export const downloadStudentsCsv = async () => {
  const res = await api.get("/admin/students/export.csv", { responseType: "blob" });
  return res.data;
};

export const downloadInvoicesCsv = async () => {
  const res = await api.get("/admin/fees/invoices.csv", { responseType: "blob" });
  return res.data;
};

export const downloadStudentsPdf = async () => {
  const res = await api.get("/admin/students/export.pdf", { responseType: "blob" });
  return res.data;
};

export const downloadInvoicesPdf = async () => {
  const res = await api.get("/admin/fees/invoices.pdf", { responseType: "blob" });
  return res.data;
};

export const downloadAttendancePdf = async () => {
  const res = await api.get("/admin/reports/attendance-summary.pdf", { responseType: "blob" });
  return res.data;
};

export const downloadFeePdf = async () => {
  const res = await api.get("/admin/reports/fee-collection.pdf", { responseType: "blob" });
  return res.data;
};

export const downloadAcademicPdf = async () => {
  const res = await api.get("/admin/reports/academic-performance.pdf", { responseType: "blob" });
  return res.data;
};

export const getScheduleEntries = async () => {
  const res = await api.get("/admin/schedule");
  return res.data;
};

export const createScheduleEntry = async (payload: any) => {
  const res = await api.post("/admin/schedule", payload);
  return res.data;
};

export const deleteScheduleEntry = async (id: number | string) => {
  const res = await api.delete(`/admin/schedule/${id}`);
  return res.data;
};

export const getSuperAdminUsers = async () => {
  const res = await api.get("/superadmin/users");
  return res.data;
};

export const updateSuperAdminUser = async (id: number | string, payload: any) => {
  const res = await api.put(`/superadmin/users/${id}`, payload);
  return res.data;
};

export const getGrades = async () => {
  const res = await api.get("/admin/grades");
  return res.data;
};

export const createGrade = async (payload: any) => {
  const res = await api.post("/admin/grades", payload);
  return res.data;
};

export const getSubjects = async () => {
  const res = await api.get("/admin/subjects");
  return res.data;
};

export const createSubject = async (payload: any) => {
  const res = await api.post("/admin/subjects", payload);
  return res.data;
};

export const getClassSubjects = async () => {
  const res = await api.get("/admin/class-subjects");
  return res.data;
};

export const createClassSubject = async (payload: any) => {
  const res = await api.post("/admin/class-subjects", payload);
  return res.data;
};

export const getTeacherAttendanceHistory = async (from?: string, to?: string) => {
  const res = await api.get("/teacher/attendance/history", { params: { from, to } });
  return res.data;
};

export const getTeacherGrades = async () => {
  const res = await api.get("/teacher/grades");
  return res.data;
};

export const addTeacherGrade = async (payload: any) => {
  const res = await api.post("/teacher/grades", payload);
  return res.data;
};

export const getTeacherAssignments = async () => {
  const res = await api.get("/teacher/assignments");
  return res.data;
};

export const createTeacherAssignment = async (payload: any) => {
  const res = await api.post("/teacher/assignments", payload);
  return res.data;
};

export const getTeacherAssignmentSubmissions = async (assignmentId: number) => {
  const res = await api.get(`/teacher/assignments/${assignmentId}/submissions`);
  return res.data;
};

export const gradeTeacherAssignmentSubmission = async (submissionId: number, payload: any) => {
  const res = await api.put(`/teacher/assignments/submissions/${submissionId}`, payload);
  return res.data;
};

export const getStudentAssignments = async () => {
  const res = await api.get("/student/portal/assignments");
  return res.data;
};

export const submitStudentAssignment = async (assignmentId: number, payload: any) => {
  const res = await api.post(`/student/portal/assignments/${assignmentId}/submit`, payload);
  return res.data;
};

export const getTeacherLeaves = async () => {
  const res = await api.get("/teacher/leaves");
  return res.data;
};

export const submitTeacherLeave = async (payload: any) => {
  const res = await api.post("/teacher/leaves", payload);
  return res.data;
};

export const getStudentLeaves = async () => {
  const res = await api.get("/student/portal/leaves");
  return res.data;
};

export const submitStudentLeave = async (payload: any) => {
  const res = await api.post("/student/portal/leaves", payload);
  return res.data;
};

export const getAdminLeaves = async (params?: any) => {
  const res = await api.get("/admin/leaves", { params });
  return res.data;
};

export const updateAdminLeaveStatus = async (id: number, payload: any) => {
  const res = await api.put(`/admin/leaves/${id}`, payload);
  return res.data;
};

export const createStripeCustomer = async (payload: any) => {
  const res = await api.post("/billing/create-customer", payload);
  return res.data;
};

export const createStripeSubscription = async (payload: any) => {
  const res = await api.post("/billing/create-subscription", payload);
  return res.data;
};

export const createBillingPortal = async (payload: any) => {
  const res = await api.post("/billing/portal", payload);
  return res.data;
};

export const getAuditLogs = async (limit?: number) => {
  const res = await api.get("/superadmin/audit", { params: { limit } });
  return res.data;
};

export const impersonateSchool = async (schoolId: number | string) => {
  const res = await api.post(`/superadmin/schools/impersonate/${schoolId}`);
  return res.data;
};

export default api;
