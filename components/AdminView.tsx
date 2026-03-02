import React, { useState, useEffect, useRef } from 'react';
import { API_BASE_URL, getAdminStats, getTeachers, getClasses, getStudents, getAnnouncements, getFeesStats, getInvoices, getReportDownloads, logReportDownload, getAttendanceReport, getFeeReport, getAcademicReport, downloadAttendanceCsv, downloadFeeCsv, downloadAcademicCsv, downloadStudentsCsv, downloadInvoicesCsv, downloadStudentsPdf, downloadInvoicesPdf, downloadAttendancePdf, downloadFeePdf, downloadAcademicPdf, getGrades, createGrade, createStudent, createAnnouncement, createInvoice, updateInvoiceStatus, getSubjects, createSubject, getClassSubjects, createClassSubject, getScheduleEntries, createScheduleEntry, deleteScheduleEntry, updateTeacher, deleteTeacher, updateStudent, getStudentReportCardTerms, getStudentReportCard, downloadStudentReportCardPdf, getNotificationTemplates, createNotificationTemplate, getNotifications, queueNotification, triggerFeeDueNotifications, updateNotificationStatus, runNotificationDispatchNow, getAdminLeaves, updateAdminLeaveStatus } from '../services/api';
import { Card, Button, StatCard, Badge, Input } from './UIComponents';
import {
    Users,
    GraduationCap,
    DollarSign,
    PieChart,
    Plus,
    Search,
    FileSpreadsheet,
    MoreHorizontal,
    BookOpen,
    UploadCloud,
    X,
    FileText,
    Mail,
    Phone,
    Calendar,
    CheckCircle,
    AlertTriangle,
    Download,
    Printer,
    Filter,
    ArrowUpRight,
    CalendarDays,
    Pencil,
    Save,
    Eye,
    Bell,
    Send
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { toast } from 'sonner';
import { User, Teacher, Student, NotificationItem, NotificationTemplate, StudentReportCard } from '../types';

// Chart Data (loaded from API)
const emptyAttendanceData: any[] = [];

// Mock Data for Reports
const reportTypes = [
    { id: 1, title: 'Academic Performance', description: 'Term-wise student marks and grading analysis.', icon: GraduationCap, color: 'text-blue-600', bg: 'bg-blue-100' },
    { id: 2, title: 'Attendance Summary', description: 'Monthly attendance logs for students and staff.', icon: CalendarDays, color: 'text-emerald-600', bg: 'bg-emerald-100' },
    { id: 3, title: 'Fee Collection', description: 'Revenue reports, pending dues and invoice history.', icon: DollarSign, color: 'text-amber-600', bg: 'bg-amber-100' },
    { id: 4, title: 'Student Behaviour', description: 'Disciplinary records and merit points log.', icon: Users, color: 'text-purple-600', bg: 'bg-purple-100' },
];

const AdminView: React.FC<{ currentView: string; user: User }> = ({ currentView, user }) => {
    const [stats, setStats] = useState({
        totalStudents: 0,
        totalTeachers: 0,
        attendanceRate: 0,
        pendingFees: 0,
    });

    const [logoUrl, setLogoUrl] = useState("");
    const [showAddStudentModal, setShowAddStudentModal] = useState(false);
    const [showBulkImportModal, setShowBulkImportModal] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isStudentLogoUploading, setIsStudentLogoUploading] = useState(false);
    const [studentLogoPreview, setStudentLogoPreview] = useState('');
    const [studentLogoUploadName, setStudentLogoUploadName] = useState('');
    const [showBulkTeacherImportModal, setShowBulkTeacherImportModal] = useState(false);
    const [isTeacherUploading, setIsTeacherUploading] = useState(false);
    const [selectedTeacherFile, setSelectedTeacherFile] = useState<File | null>(null);
    const [isTeacherLogoUploading, setIsTeacherLogoUploading] = useState(false);
    const [teacherLogoPreview, setTeacherLogoPreview] = useState('');
    const [teacherLogoUploadName, setTeacherLogoUploadName] = useState('');
    const [showAddTeacherModal, setShowAddTeacherModal] = useState(false);
    const [showCreateClassModal, setShowCreateClassModal] = useState(false);
    const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
    const [showInvoiceModal, setShowInvoiceModal] = useState(false);
    const [showGradeModal, setShowGradeModal] = useState(false);
    const [showReportModal, setShowReportModal] = useState(false);
    const [reportData, setReportData] = useState<any[]>([]);
    const [reportTitle, setReportTitle] = useState("");
    const [showSubjectModal, setShowSubjectModal] = useState(false);
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [teachers, setTeachers] = useState<Teacher[]>([]);
    const [classes, setClasses] = useState<any[]>([]);
    const [isEditingStudent, setIsEditingStudent] = useState(false);
    const [studentForm, setStudentForm] = useState<Student | null>(null);
    const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
    const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);
    const [isEditingTeacher, setIsEditingTeacher] = useState(false);
    const [editForm, setEditForm] = useState({
        name: '',
        email: '',
        phone: '',
        subject: '',
        status: 'Active',
        joinDate: '',
    });
    const [students, setStudents] = useState<Student[]>([]);
    const [announcements, setAnnouncements] = useState<any[]>([]);
    const [feesStats, setFeesStats] = useState<{ total_students: number; collected: number; pending: number } | null>(null);
    const [attendanceData, setAttendanceData] = useState<any[]>(emptyAttendanceData);
    const [newClass, setNewClass] = useState({
        grade: '',
        section: '',
        academicYear: '',
        teacherId: '',
        roomNumber: ''
    });
    const [schoolNameForCodes, setSchoolNameForCodes] = useState('');
    const [newTeacher, setNewTeacher] = useState({
        name: '',
        email: '',
        password: '',
        phone: '',
        department: '',
        address: '',
        joinDate: '',
        status: 'Active'
    });
    const [newStudent, setNewStudent] = useState({
        class_id: '',
        admission_no: '',
        roll_number: '',
        name: '',
        gender: 'male',
        dob: '',
        guardian_name: '',
        guardian_phone: '',
    });
    const [newAnnouncement, setNewAnnouncement] = useState({
        title: '',
        message: '',
        type: 'info',
    });
    const [newInvoice, setNewInvoice] = useState({
        student_id: '',
        amount: '',
        due_date: '',
    });
    const [invoices, setInvoices] = useState<any[]>([]);
    const [downloads, setDownloads] = useState<any[]>([]);
    const [grades, setGrades] = useState<any[]>([]);
    const [subjects, setSubjects] = useState<any[]>([]);
    const [classSubjects, setClassSubjects] = useState<any[]>([]);
    const [newGrade, setNewGrade] = useState({
        student_id: '',
        subject: '',
        term: '',
        score: '',
        max_score: '100'
    });
    const [newSubject, setNewSubject] = useState({ name: '', code: '' });
    const [isSubjectCodeManual, setIsSubjectCodeManual] = useState(false);
    const [newClassSubject, setNewClassSubject] = useState({
        class_id: '',
        subject_id: '',
        teacher_id: ''
    });
    const [scheduleEntries, setScheduleEntries] = useState<any[]>([]);
    const [showScheduleModal, setShowScheduleModal] = useState(false);
    const [newSchedule, setNewSchedule] = useState({
        class_subject_id: '',
        day_of_week: 'Monday',
        start_time: '09:00',
        end_time: '10:00',
        room: ''
    });
    const [studentSearchTerm, setStudentSearchTerm] = useState('');
    const [studentClassFilter, setStudentClassFilter] = useState('all');
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const [notificationTemplates, setNotificationTemplates] = useState<NotificationTemplate[]>([]);
    const [notificationStatusFilter, setNotificationStatusFilter] = useState('all');
    const [notificationChannelFilter, setNotificationChannelFilter] = useState('all');
    const [newNotification, setNewNotification] = useState({
        recipient_type: 'school',
        recipient_id: '',
        channel: 'in_app',
        title: '',
        message: '',
        scheduled_at: '',
    });
    const [newTemplate, setNewTemplate] = useState({
        name: '',
        channel: 'in_app',
        title_template: '',
        message_template: '',
    });
    const [showStudentReportCardModal, setShowStudentReportCardModal] = useState(false);
    const [studentReportCard, setStudentReportCard] = useState<StudentReportCard | null>(null);
    const [studentReportCardTerms, setStudentReportCardTerms] = useState<string[]>([]);
    const [selectedReportCardTerm, setSelectedReportCardTerm] = useState('');
    const [openTeacherMenuId, setOpenTeacherMenuId] = useState<string | null>(null);
    const [openClassMenuId, setOpenClassMenuId] = useState<string | null>(null);
    const [scheduleClassFilter, setScheduleClassFilter] = useState('all');
    const scheduleSectionRef = useRef<HTMLDivElement | null>(null);

    // Leave Management State
    const [adminLeaves, setAdminLeaves] = useState<any[]>([]);
    const [leaveRoleFilter, setLeaveRoleFilter] = useState('all');
    const [leaveStatusFilter, setLeaveStatusFilter] = useState('all');

    const filteredStudents = students.filter((student) => {
        const query = studentSearchTerm.trim().toLowerCase();
        const className = String((student as any).class_name || '');
        const matchesSearch = !query
            || String(student.name || '').toLowerCase().includes(query)
            || String(student.admission_no || '').toLowerCase().includes(query)
            || String(student.roll_number || '').toLowerCase().includes(query);
        const matchesClass = studentClassFilter === 'all' || className === studentClassFilter;
        return matchesSearch && matchesClass;
    });

    const filteredScheduleEntries = scheduleClassFilter === 'all'
        ? scheduleEntries
        : scheduleEntries.filter((entry: any) => {
            const classSubject = classSubjects.find((cs: any) => String(cs.id) === String(entry.class_subject_id));
            return classSubject && String(classSubject.class_id) === scheduleClassFilter;
        });

    const downloadBlob = (blob: Blob, filename: string) => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
    };

    const resolveImageSrc = (value?: string | null) => {
        if (!value) return '';
        if (value.startsWith('data:') || value.startsWith('http')) return value;
        if (value.startsWith('/')) return `${API_BASE_URL}${value}`;
        return value;
    };

    const toCodeToken = (value: string, maxLen: number) => {
        const cleaned = String(value || '')
            .toUpperCase()
            .replace(/[^A-Z0-9 ]+/g, ' ')
            .trim();
        if (!cleaned) return '';
        const words = cleaned.split(/\s+/).filter(Boolean);
        let token = words.map((w) => w[0]).join('');
        if (token.length < Math.min(3, maxLen)) {
            token = words.join('');
        }
        return token.slice(0, maxLen);
    };

    const getSchoolNameSeed = () => {
        if (schoolNameForCodes.trim()) return schoolNameForCodes.trim();
        try {
            const raw = localStorage.getItem('user');
            if (raw) {
                const parsed = JSON.parse(raw);
                const fromStorage = String(parsed?.school_name || parsed?.schoolName || '').trim();
                if (fromStorage) return fromStorage;
            }
        } catch {
            // ignore storage parsing issues
        }
        return `School${user.school_id || ''}`;
    };

    const getStableThreeDigits = (text: string) => {
        let hash = 0;
        for (let i = 0; i < text.length; i++) {
            hash = (hash * 31 + text.charCodeAt(i)) % 900;
        }
        return String(hash + 100);
    };

    const generateSubjectCode = (subjectName: string) => {
        const schoolSeed = getSchoolNameSeed();
        const subjectToken = toCodeToken(subjectName, 5) || 'SUB';
        const schoolToken = toCodeToken(schoolSeed, 5) || 'SCH';
        const digits = getStableThreeDigits(`${subjectName}|${schoolSeed}`);
        return `${subjectToken}-${schoolToken}-${digits}`.slice(0, 20);
    };

    // fetch teacher method 
    const fetchTeachers = async () => {
        try {
            const data = await getTeachers();
            const normalized = Array.isArray(data)
                ? data.map((teacher: any) => {
                    const pickScalar = (value: any) => Array.isArray(value) ? value[0] : value;
                    return {
                        ...teacher,
                        department: pickScalar(teacher?.department),
                        employee_id: pickScalar(teacher?.employee_id),
                    };
                })
                : [];
            setTeachers(normalized);
        } catch (error) {
            console.error("Error fetching teachers:", error);
            toast.error("Failed to load teachers");
        }
    };

    // fetching classess method 
    const fetchClasses = async () => {
        try {
            const data = await getClasses();
            setClasses(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error("Error fetching classes:", error);
            toast.error("Failed to load classes");
        }
    };

    useEffect(() => {
        const handleGlobalClick = () => {
            setOpenTeacherMenuId(null);
            setOpenClassMenuId(null);
        };
        window.addEventListener('click', handleGlobalClick);
        return () => {
            window.removeEventListener('click', handleGlobalClick);
        };
    }, []);

    useEffect(() => {
        if (currentView === 'teachers' || currentView === 'classes') {
            fetchTeachers();
        }
        if (currentView === 'classes') {
            fetchClasses();
            fetchSubjects();
            fetchClassSubjects();
            fetchScheduleEntries();
            fetchStats();
        }
        if (currentView === 'dashboard') {
            fetchStats();
            fetchAttendanceChart();
        }
        if (currentView === 'students') {
            fetchStudents();
            fetchClasses();
        }
        if (currentView === 'announcements' || currentView === 'dashboard') {
            fetchAnnouncements();
        }
        if (currentView === 'fees') {
            fetchFeesStats();
            fetchInvoices();
            fetchStudents();
        }
        if (currentView === 'reports') {
            fetchDownloads();
            fetchGrades();
            fetchStudents();
        }
        if (currentView === 'notifications') {
            fetchNotificationTemplates();
            fetchStudents();
            fetchTeachers();
        }
    }, [currentView]);

    useEffect(() => {
        if (currentView === 'notifications') {
            fetchNotifications();
        }
    }, [currentView, notificationStatusFilter, notificationChannelFilter]);

    const fetchStats = async () => {
        try {
            const data = await getAdminStats();
            setStats({
                totalStudents: data?.totalStudents || 0,
                totalTeachers: data?.totalTeachers || 0,
                attendanceRate: data?.attendanceRate || 0,
                pendingFees: data?.pendingFees || 0,
            });
            setSchoolNameForCodes(String(data?.schoolName || '').trim());
        } catch (error) {
            console.error("Error fetching admin stats:", error);
        }
    };

    const fetchAttendanceChart = async () => {
        try {
            const data = await getAttendanceReport();
            const mapped = (Array.isArray(data) ? data : []).slice(0, 7).reverse().map((row: any) => ({
                name: String(row.date).slice(5),
                present: row.present || 0,
                absent: row.absent || 0,
            }));
            setAttendanceData(mapped);
        } catch (error) {
            console.error("Error fetching attendance chart:", error);
        }
    };

    const fetchStudents = async () => {
        try {
            const data = await getStudents();
            setStudents(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error("Error fetching students:", error);
            toast.error("Failed to load students");
        }
    };

    const fetchAnnouncements = async () => {
        try {
            const data = await getAnnouncements();
            setAnnouncements(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error("Error fetching announcements:", error);
            toast.error("Failed to load announcements");
        }
    };

    const fetchFeesStats = async () => {
        try {
            const data = await getFeesStats();
            setFeesStats(data || null);
        } catch (error) {
            console.error("Error fetching fees stats:", error);
        }
    };

    const fetchInvoices = async () => {
        try {
            const data = await getInvoices();
            setInvoices(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error("Error fetching invoices:", error);
        }
    };

    const handleCreateStudent = async () => {
        try {
            await createStudent(newStudent);
            toast.success("Student created");
            setShowAddStudentModal(false);
            setNewStudent({
                class_id: '',
                admission_no: '',
                roll_number: '',
                name: '',
                gender: 'male',
                dob: '',
                guardian_name: '',
                guardian_phone: '',
            });
            fetchStudents();
        } catch (err) {
            toast.error("Failed to create student");
        }
    };

    const handleCreateAnnouncement = async () => {
        try {
            await createAnnouncement(newAnnouncement);
            toast.success("Announcement posted");
            setNewAnnouncement({ title: '', message: '', type: 'info' });
            fetchAnnouncements();
        } catch (err) {
            toast.error("Failed to post announcement");
        }
    };

    const handleCreateInvoice = async () => {
        try {
            await createInvoice({
                student_id: newInvoice.student_id,
                amount: Number(newInvoice.amount),
                due_date: newInvoice.due_date,
            });
            toast.success("Invoice created");
            setNewInvoice({ student_id: '', amount: '', due_date: '' });
            fetchInvoices();
            fetchFeesStats();
        } catch (err) {
            toast.error("Failed to create invoice");
        }
    };

    const fetchDownloads = async () => {
        try {
            const data = await getReportDownloads();
            setDownloads(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error("Error fetching downloads:", error);
        }
    };

    const fetchGrades = async () => {
        try {
            const data = await getGrades();
            setGrades(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error("Error fetching grades:", error);
        }
    };

    const fetchSubjects = async () => {
        try {
            const data = await getSubjects();
            setSubjects(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error("Error fetching subjects:", error);
        }
    };

    const fetchClassSubjects = async () => {
        try {
            const data = await getClassSubjects();
            setClassSubjects(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error("Error fetching class subjects:", error);
        }
    };

    const fetchScheduleEntries = async () => {
        try {
            const data = await getScheduleEntries();
            setScheduleEntries(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error("Error fetching schedule entries:", error);
        }
    };

    const fetchNotifications = async () => {
        try {
            const params: { status?: string; channel?: string; limit?: number } = { limit: 100 };
            if (notificationStatusFilter !== 'all') params.status = notificationStatusFilter;
            if (notificationChannelFilter !== 'all') params.channel = notificationChannelFilter;
            const data = await getNotifications(params);
            setNotifications(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error("Error fetching notifications:", error);
            toast.error("Failed to load notifications");
        }
    };

    const fetchAdminLeaves = async () => {
        try {
            const params: { role?: string; status?: string } = {};
            if (leaveRoleFilter !== 'all') params.role = leaveRoleFilter;
            if (leaveStatusFilter !== 'all') params.status = leaveStatusFilter;
            const data = await getAdminLeaves(params);
            setAdminLeaves(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error("Error fetching leaves:", error);
            toast.error("Failed to load leaves");
        }
    };

    useEffect(() => {
        if (currentView === 'leaves') {
            fetchAdminLeaves();
        }
    }, [currentView, leaveRoleFilter, leaveStatusFilter]);

    const fetchNotificationTemplates = async () => {
        try {
            const data = await getNotificationTemplates();
            setNotificationTemplates(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error("Error fetching notification templates:", error);
            toast.error("Failed to load templates");
        }
    };

    const handleQueueNotification = async () => {
        if (!newNotification.message.trim()) {
            toast.error("Message is required");
            return;
        }
        if (newNotification.recipient_type !== 'school' && !newNotification.recipient_id) {
            toast.error("Please select a recipient");
            return;
        }
        try {
            await queueNotification({
                recipient_type: newNotification.recipient_type,
                recipient_id: newNotification.recipient_type === 'school' ? null : (newNotification.recipient_id || null),
                channel: newNotification.channel,
                title: newNotification.title || null,
                message: newNotification.message,
                scheduled_at: newNotification.scheduled_at || null,
            });
            toast.success("Notification queued");
            setNewNotification({
                recipient_type: 'school',
                recipient_id: '',
                channel: 'in_app',
                title: '',
                message: '',
                scheduled_at: '',
            });
            fetchNotifications();
        } catch (err: any) {
            toast.error(err?.response?.data?.message || "Failed to queue notification");
        }
    };

    const handleCreateNotificationTemplate = async () => {
        if (!newTemplate.name.trim() || !newTemplate.message_template.trim()) {
            toast.error("Template name and message are required");
            return;
        }
        try {
            await createNotificationTemplate(newTemplate);
            toast.success("Template created");
            setNewTemplate({
                name: '',
                channel: 'in_app',
                title_template: '',
                message_template: '',
            });
            fetchNotificationTemplates();
        } catch (err: any) {
            toast.error(err?.response?.data?.message || "Failed to create template");
        }
    };

    const handleTriggerFeeDueNotifications = async () => {
        try {
            const result = await triggerFeeDueNotifications(3);
            const queued = Number(result?.queued || 0);
            toast.success(`Fee reminders queued: ${queued}`);
            fetchNotifications();
        } catch (err: any) {
            toast.error(err?.response?.data?.message || "Failed to queue fee reminders");
        }
    };

    const handleRunNotificationDispatchNow = async () => {
        try {
            const result = await runNotificationDispatchNow();
            const sent = Number(result?.sent || 0);
            const retried = Number(result?.retried || 0);
            const failed = Number(result?.failed || 0);
            toast.success(`Dispatch done. Sent: ${sent}, Retried: ${retried}, Failed: ${failed}`);
            fetchNotifications();
        } catch (err: any) {
            toast.error(err?.response?.data?.message || "Failed to run notification dispatch");
        }
    };

    const handleUpdateNotificationStatus = async (id: string | number, status: string) => {
        try {
            await updateNotificationStatus(id, status);
            toast.success("Notification status updated");
            fetchNotifications();
        } catch (err: any) {
            toast.error(err?.response?.data?.message || "Failed to update notification");
        }
    };

    const handleOpenStudentReportCard = async (student: Student, preferredTerm?: string) => {
        try {
            const terms = await getStudentReportCardTerms(student.id);
            const termList = Array.isArray(terms) ? terms : [];
            setStudentReportCardTerms(termList);

            const selectedTerm = preferredTerm !== undefined ? preferredTerm : (termList[0] || '');
            setSelectedReportCardTerm(selectedTerm);

            const report = await getStudentReportCard(student.id, selectedTerm || undefined);
            setStudentReportCard(report);
            setShowStudentReportCardModal(true);
        } catch (err: any) {
            toast.error(err?.response?.data?.message || "Failed to load report card");
        }
    };

    const handleDownloadStudentReportCard = async () => {
        if (!selectedStudent) return;
        try {
            const blob = await downloadStudentReportCardPdf(selectedStudent.id, selectedReportCardTerm || undefined);
            downloadBlob(blob, `report-card-${selectedStudent.name.replace(/\s+/g, '_')}.pdf`);
        } catch (err: any) {
            toast.error(err?.response?.data?.message || "Failed to download report card");
        }
    };

    const handleCreateSchedule = async () => {
        try {
            await createScheduleEntry(newSchedule);
            toast.success("Schedule entry added");
            setShowScheduleModal(false);
            setNewSchedule({
                class_subject_id: '',
                day_of_week: 'Monday',
                start_time: '09:00',
                end_time: '10:00',
                room: ''
            });
            fetchScheduleEntries();
        } catch (err) {
            toast.error("Failed to add schedule");
        }
    };

    const handleCreateSubject = async () => {
        const subjectName = String(newSubject.name || '').trim();
        if (!subjectName) {
            toast.error("Subject name is required");
            return;
        }

        const subjectCode = String(newSubject.code || '').trim() || generateSubjectCode(subjectName);

        try {
            await createSubject({ name: subjectName, code: subjectCode });
            toast.success("Subject created");
            setNewSubject({ name: '', code: '' });
            setIsSubjectCodeManual(false);
            setShowSubjectModal(false);
            fetchSubjects();
        } catch (err) {
            toast.error("Failed to create subject");
        }
    };

    const handleAssignSubject = async () => {
        if (!newClassSubject.class_id || !newClassSubject.subject_id || !newClassSubject.teacher_id) {
            toast.error("Please select class, subject, and teacher");
            return;
        }

        try {
            await createClassSubject({
                class_id: Number(newClassSubject.class_id),
                subject_id: Number(newClassSubject.subject_id),
                teacher_id: Number(newClassSubject.teacher_id),
            });
            toast.success("Subject assigned");
            setNewClassSubject({ class_id: '', subject_id: '', teacher_id: '' });
            setShowAssignModal(false);
            fetchClassSubjects();
        } catch (err) {
            const message = (err as any)?.response?.data?.message || "Failed to assign subject";
            toast.error(message);
        }
    };

    const handleCreateGrade = async () => {
        try {
            await createGrade({
                student_id: Number(newGrade.student_id),
                subject: newGrade.subject,
                term: newGrade.term,
                score: Number(newGrade.score),
                max_score: Number(newGrade.max_score || 100)
            });
            toast.success("Grade saved");
            setShowGradeModal(false);
            setNewGrade({ student_id: '', subject: '', term: '', score: '', max_score: '100' });
            fetchGrades();
        } catch (err) {
            toast.error("Failed to save grade");
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setSelectedFile(e.target.files[0]);
        }
    };

    const handleTeacherFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setSelectedTeacherFile(e.target.files[0]);
        }
    };

    const handleUploadTeacherProfileLogo = async (file?: File | null) => {
        if (!file || !selectedTeacher) return;

        setIsTeacherLogoUploading(true);
        const formData = new FormData();
        formData.append("logo", file);

        try {
            const res = await fetch(`${API_BASE_URL}/api/admin/teachers/logo`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${localStorage.getItem("token")}`,
                },
                body: formData,
            });
            const data = await res.json();
            if (res.ok && data?.url) {
                setTeacherLogoPreview(data.url);
                setTeacherLogoUploadName(String(data.url).split('/').pop() || '');
                toast.success("Teacher image uploaded");
            } else {
                toast.error(data?.message || "Image upload failed");
            }
        } catch (err) {
            toast.error("Error uploading teacher image");
        } finally {
            setIsTeacherLogoUploading(false);
        }
    };

    const handleUploadStudentProfileLogo = async (file?: File | null) => {
        if (!file || !selectedStudent) return;

        setIsStudentLogoUploading(true);
        const formData = new FormData();
        formData.append("logo", file);

        try {
            const res = await fetch(`${API_BASE_URL}/api/admin/students/logo`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${localStorage.getItem("token")}`,
                },
                body: formData,
            });
            const data = await res.json();
            if (res.ok && data?.url) {
                setStudentLogoPreview(data.url);
                setStudentLogoUploadName(String(data.url).split('/').pop() || '');
                toast.success("Student image uploaded");
            } else {
                toast.error(data?.message || "Image upload failed");
            }
        } catch (err) {
            toast.error("Error uploading student image");
        } finally {
            setIsStudentLogoUploading(false);
        }
    };

    const handleSaveTeacherChanges = async () => {
        if (!selectedTeacher) return;

        const teacherId = Number((selectedTeacher as any).id);
        if (!Number.isFinite(teacherId)) {
            toast.error("Invalid teacher id");
            return;
        }

        try {
            const payload: any = {
                name: String(editForm.name || '').trim(),
                email: String(editForm.email || '').trim(),
                phone: String(editForm.phone || '').trim(),
                department: String(editForm.subject || '').trim(),
                is_active: editForm.status === 'Active' ? 1 : 0,
                joinDate: editForm.joinDate || null,
            };

            if (teacherLogoUploadName) {
                payload.logo = teacherLogoUploadName;
            }

            await updateTeacher(teacherId, payload);

            setSelectedTeacher({
                ...selectedTeacher,
                name: editForm.name,
                email: editForm.email,
                phone: editForm.phone,
                department: editForm.subject,
                is_active: editForm.status === 'Active',
                joinDate: editForm.joinDate || '',
                logo: teacherLogoUploadName ? resolveImageSrc(teacherLogoPreview) : selectedTeacher.logo,
            });
            setTeachers((prev) =>
                prev.map((teacher: any) =>
                    Number(teacher.id) === teacherId
                        ? {
                            ...teacher,
                            name: editForm.name,
                            email: editForm.email,
                            phone: editForm.phone,
                            department: editForm.subject,
                            is_active: editForm.status === 'Active',
                            joinDate: editForm.joinDate || '',
                            logo: teacherLogoUploadName ? resolveImageSrc(teacherLogoPreview) : teacher.logo,
                        }
                        : teacher
                )
            );
            setTeacherLogoUploadName('');
            setIsEditingTeacher(false);
            toast.success("Teacher profile updated successfully");
        } catch (err: any) {
            toast.error(err?.response?.data?.message || "Failed to update teacher profile");
        }
    };

    const handleUpdateTeacherStatus = async () => {
        if (!selectedTeacher) return;

        const teacherId = Number((selectedTeacher as any).id);
        if (!Number.isFinite(teacherId)) {
            toast.error("Invalid teacher id");
            return;
        }

        const isActive = editForm.status === 'Active';

        try {
            await updateTeacher(teacherId, { is_active: isActive ? 1 : 0 });
            setSelectedTeacher({ ...selectedTeacher, is_active: isActive });
            setTeachers((prev) =>
                prev.map((teacher: any) =>
                    Number(teacher.id) === teacherId
                        ? { ...teacher, is_active: isActive }
                        : teacher
                )
            );
            toast.success(`Teacher marked as ${isActive ? 'Active' : 'Inactive'}`);
        } catch (err: any) {
            toast.error(err?.response?.data?.message || "Failed to update teacher status");
        }
    };

    const handleBulkUpload = async () => {
        if (!selectedFile) {
            toast.error("Please select a file first");
            return;
        }

        setIsUploading(true);
        const formData = new FormData();
        formData.append('file', selectedFile);

        try {
            const res = await fetch(`${API_BASE_URL}/api/admin/students-bulk/bulk`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: formData
            });

            const data = await res.json();

            if (res.ok) {
                toast.success(`Success! ${data.success} students imported`);
                if (data.failed > 0) {
                    toast.warning(`${data.failed} rows failed. Check format.`);
                }
            } else {
                toast.error(data.message || "Upload failed");
            }

        } catch (err) {
            toast.error("Network error - is backend running?");
        } finally {
            setIsUploading(false);
            setShowBulkImportModal(false);
            setSelectedFile(null);
        }
    };

    const handleTeacherBulkUpload = async () => {
        if (!selectedTeacherFile) {
            toast.error("Please select a file first");
            return;
        }

        setIsTeacherUploading(true);
        const formData = new FormData();
        formData.append('file', selectedTeacherFile);

        try {
            const res = await fetch(`${API_BASE_URL}/api/admin/teachers/bulk`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: formData
            });

            const data = await res.json();

            if (res.ok) {
                toast.success(`Success! ${data.success} teachers imported`);
                if (data.failed > 0) {
                    toast.warning(`${data.failed} rows failed. Check format.`);
                }
                fetchTeachers();
            } else {
                toast.error(data.message || "Upload failed");
            }

        } catch (err) {
            toast.error("Network error - is backend running?");
        } finally {
            setIsTeacherUploading(false);
            setShowBulkTeacherImportModal(false);
            setSelectedTeacherFile(null);
        }
    };

    const openTeacherProfile = (teacher: Teacher, editMode: boolean = false) => {
        setSelectedTeacher(teacher);
        setIsEditingTeacher(editMode);
        setTeacherLogoPreview(teacher.logo || '');
        setTeacherLogoUploadName('');
        const isActive = teacher.is_active === true || teacher.is_active === 1 || teacher.is_active === '1' || String(teacher.is_active).toLowerCase() === 'true';
        setEditForm({
            name: teacher.name,
            email: teacher.email,
            phone: teacher.phone || '',
            subject: teacher.department || '',
            status: isActive ? 'Active' : 'Inactive',
            joinDate: teacher.joinDate || ''
        });
        setOpenTeacherMenuId(null);
    };

    const handleDeleteTeacher = async (teacher: Teacher) => {
        const teacherId = Number((teacher as any).id);
        if (!Number.isFinite(teacherId)) {
            toast.error("Invalid teacher id");
            return;
        }

        const confirmed = window.confirm(`Delete ${teacher.name}'s profile? This action cannot be undone.`);
        if (!confirmed) return;

        try {
            await deleteTeacher(teacherId);
            toast.success("Teacher removed successfully");
            setOpenTeacherMenuId(null);
            if (selectedTeacher && Number((selectedTeacher as any).id) === teacherId) {
                setSelectedTeacher(null);
            }
            await Promise.all([fetchTeachers(), fetchClasses()]);
        } catch (err: any) {
            toast.error(err?.response?.data?.message || "Failed to delete teacher");
        }
    };

    const openClassTimetable = (classId: string) => {
        setScheduleClassFilter(classId);
        setOpenClassMenuId(null);
        requestAnimationFrame(() => {
            scheduleSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    };

    const openAssignSubjectModalForClass = (classId: string) => {
        setNewClassSubject((prev) => ({ ...prev, class_id: classId }));
        setShowAssignModal(true);
        setOpenClassMenuId(null);
    };

    const openScheduleModalForClass = (classId: string) => {
        const classSubject = classSubjects.find((cs: any) => String(cs.class_id) === classId);
        setNewSchedule((prev) => ({
            ...prev,
            class_subject_id: classSubject ? String(classSubject.id) : ''
        }));
        setShowScheduleModal(true);
        setOpenClassMenuId(null);
        if (!classSubject) {
            toast.warning("Assign a subject to this class before adding schedule entries.");
        }
    };

    const openStudentProfile = (student: Student, editMode: boolean = false) => {
        setSelectedStudent(student);
        setStudentForm(student);
        setIsEditingStudent(editMode);
        setStudentLogoPreview((student as any).logo || '');
        setStudentLogoUploadName('');
        setShowStudentReportCardModal(false);
        setStudentReportCard(null);
    };

    const handleSaveStudentChanges = async () => {
        if (!selectedStudent || !studentForm) return;

        const studentId = Number(studentForm.id || selectedStudent.id);
        if (!Number.isFinite(studentId)) {
            toast.error("Invalid student id");
            return;
        }

        try {
            const payload: any = {
                name: studentForm.name,
                dob: studentForm.dob || null,
                guardian_name: studentForm.guardian_name || null,
                guardian_phone: studentForm.guardian_phone || null,
            };

            if (studentForm.fees_status) {
                payload.fees_status = studentForm.fees_status;
            }

            if (studentLogoUploadName) {
                payload.logo = studentLogoUploadName;
            }

            await updateStudent(studentId, payload);

            const mergedStudent = {
                ...selectedStudent,
                ...studentForm,
                logo: studentLogoUploadName ? resolveImageSrc(studentLogoPreview) : (selectedStudent as any).logo,
            };
            setSelectedStudent(mergedStudent);
            setStudentForm((prev) => (prev ? { ...prev, ...mergedStudent } : prev));
            setStudents((prev) =>
                prev.map((student) =>
                    Number(student.id) === studentId
                        ? { ...student, ...mergedStudent }
                        : student
                )
            );
            setStudentLogoUploadName('');
            setIsEditingStudent(false);
            toast.success("Student details updated successfully");
        } catch (err: any) {
            toast.error(err?.response?.data?.message || "Failed to update student details");
        }
    };

    // create teacher method 
    const handleCreateTeacher = async () => {
        if (!newTeacher.password.trim()) {
            toast.error("Password is required for new teachers");
            return;
        }
        try {
            const payload = {
                ...newTeacher,
                school_id: user.school_id,
                logo: logoUrl ? logoUrl.split('/').pop() : '',
            };

            const res = await fetch(`${API_BASE_URL}/api/admin/teachers`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                toast.success("New teacher profile created successfully");
                setShowAddTeacherModal(false);
                setNewTeacher({ name: '', email: '', password: '', phone: '', department: '', address: '', joinDate: '', status: 'Active' });
                setLogoUrl('');
                fetchTeachers(); // Refresh list
                // Optionally refresh list
            } else {
                const err = await res.json();
                toast.error(err.message || "Failed to create teacher");
            }
        } catch (error) {
            toast.error("Error creating teacher");
        }
    };

    // create classs method 
    const handleCreateClass = async () => {
        try {
            const payload = {
                grade: newClass.grade,
                section: newClass.section,
                academic_year: newClass.academicYear,
                class_teacher_id: newClass.teacherId || null,
                room_number: newClass.roomNumber || null,
                school_id: user.school_id
            };

            const res = await fetch(`${API_BASE_URL}/api/admin/classes`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                toast.success("New class group created successfully");
                setShowCreateClassModal(false);
                setNewClass({ grade: '', section: '', academicYear: '', teacherId: '', roomNumber: '' });
                fetchClasses(); // Refresh the classes list
            } else {
                const err = await res.json();
                toast.error(err.message || "Failed to create class");
            }
        } catch (error) {
            toast.error("Error creating class");
        }
    };

    // --- Render Views ---
    if (currentView === 'students') {
        return (
            <div className="space-y-6 animate-in fade-in duration-500">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <h2 className="text-2xl font-bold">Students Management</h2>
                    <div className="flex gap-3">
                        <Button variant="outline" icon={UploadCloud} onClick={() => setShowBulkImportModal(true)}>Bulk Import</Button>
                        <Button
                            variant="outline"
                            icon={FileSpreadsheet}
                            onClick={async () => {
                                try {
                                    const blob = await downloadStudentsCsv();
                                    downloadBlob(blob, 'students.csv');
                                } catch (err) {
                                    toast.error("Failed to download CSV");
                                }
                            }}
                        >
                            Export CSV
                        </Button>
                        <Button
                            variant="outline"
                            icon={Download}
                            onClick={async () => {
                                try {
                                    const blob = await downloadStudentsPdf();
                                    downloadBlob(blob, 'students.pdf');
                                } catch (err) {
                                    toast.error("Failed to download PDF");
                                }
                            }}
                        >
                            Export PDF
                        </Button>
                        <Button icon={Plus} onClick={() => setShowAddStudentModal(true)}>Add Student</Button>
                    </div>
                </div>

                <Card className="p-0 overflow-hidden">
                    {/* Filters */}
                    <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex gap-4">
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
                            <input
                                type="text"
                                placeholder="Search by name or roll no..."
                                value={studentSearchTerm}
                                onChange={(e) => setStudentSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                        </div>
                        <select
                            value={studentClassFilter}
                            onChange={(e) => setStudentClassFilter(e.target.value)}
                            className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                        >
                            <option value="all">All Classes</option>
                            {classes.map((cls: any) => {
                                const classLabel = `${cls.grade}-${cls.section}`;
                                return (
                                    <option key={`class-filter-${cls.id}`} value={classLabel}>
                                        {classLabel}
                                    </option>
                                );
                            })}
                        </select>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 uppercase font-medium">
                                <tr>
                                    <th className="px-6 py-3 text-left">Student</th>
                                    <th className="px-6 py-3 text-left">Admission No</th>
                                    <th className="px-6 py-3 text-left">Class</th>
                                    <th className="px-6 py-3 text-left">Guardian</th>
                                    <th className="px-6 py-3 text-left">Fees Status</th>
                                    <th className="px-6 py-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {filteredStudents.map(student => (
                                    <tr key={student.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                        <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">{student.name}</td>
                                        <td className="px-6 py-4 text-slate-500">{student.admission_no}</td>
                                        <td className="px-6 py-4"><Badge variant="outline">{(student as any).class_name || 'N/A'}</Badge></td>
                                        <td className="px-6 py-4">
                                            <p className="text-slate-900 dark:text-slate-200">{student.guardian_name}</p>
                                            <p className="text-xs text-slate-500">{student.guardian_phone}</p>
                                        </td>
                                        <td className="px-6 py-4">
                                            <Badge variant={student.fees_status === 'Paid' ? 'success' : student.fees_status === 'Overdue' ? 'danger' : 'warning'}>
                                                {student.fees_status}
                                            </Badge>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end gap-2">
                                                <button
                                                    onClick={() => openStudentProfile(student, false)}
                                                    className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
                                                    title="View Profile"
                                                >
                                                    <Eye size={18} />
                                                </button>
                                                <button
                                                    onClick={() => openStudentProfile(student, true)}
                                                    className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-colors"
                                                    title="Edit Student"
                                                >
                                                    <Pencil size={18} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Card>

                {showAddStudentModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-2xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
                            <h3 className="text-xl font-bold mb-6">Add New Student</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <Input
                                    label="Full Name"
                                    placeholder="Student Name"
                                    value={newStudent.name}
                                    onChange={(e) => setNewStudent({ ...newStudent, name: e.target.value })}
                                />
                                <Input
                                    label="Admission No"
                                    placeholder="A-2025-001"
                                    value={newStudent.admission_no}
                                    onChange={(e) => setNewStudent({ ...newStudent, admission_no: e.target.value })}
                                />
                                <Input
                                    label="Roll Number"
                                    placeholder="1"
                                    value={newStudent.roll_number}
                                    onChange={(e) => setNewStudent({ ...newStudent, roll_number: e.target.value })}
                                />
                                <div>
                                    <label className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-1.5 block">Class</label>
                                    <select
                                        className="w-full rounded-xl border border-slate-200 bg-white/50 px-4 py-2.5 text-sm outline-none dark:border-slate-700 dark:bg-slate-800"
                                        value={newStudent.class_id}
                                        onChange={(e) => setNewStudent({ ...newStudent, class_id: e.target.value })}
                                    >
                                        <option value="">Select Class</option>
                                        {classes.map((c: any) => (
                                            <option key={c.id} value={c.id}>{c.grade}-{c.section}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="col-span-2 grid grid-cols-2 gap-4">
                                    <Input
                                        label="Date of Birth"
                                        type="date"
                                        value={newStudent.dob}
                                        onChange={(e) => setNewStudent({ ...newStudent, dob: e.target.value })}
                                    />
                                    <div>
                                        <label className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-1.5 block">Gender</label>
                                        <select
                                            className="w-full rounded-xl border border-slate-200 bg-white/50 px-4 py-2.5 text-sm outline-none dark:border-slate-700 dark:bg-slate-800"
                                            value={newStudent.gender}
                                            onChange={(e) => setNewStudent({ ...newStudent, gender: e.target.value })}
                                        >
                                            <option value="male">Male</option>
                                            <option value="female">Female</option>
                                            <option value="other">Other</option>
                                        </select>
                                    </div>
                                </div>
                                <Input
                                    label="Guardian Name"
                                    placeholder="Parent's Name"
                                    value={newStudent.guardian_name}
                                    onChange={(e) => setNewStudent({ ...newStudent, guardian_name: e.target.value })}
                                />
                                <Input
                                    label="Guardian Phone"
                                    placeholder="+1..."
                                    value={newStudent.guardian_phone}
                                    onChange={(e) => setNewStudent({ ...newStudent, guardian_phone: e.target.value })}
                                />
                            </div>
                            <div className="flex justify-end gap-3 mt-8">
                                <Button variant="outline" onClick={() => setShowAddStudentModal(false)}>Cancel</Button>
                                <Button onClick={handleCreateStudent}>Save Student</Button>
                            </div>
                        </div>
                    </div>
                )}

                {showBulkImportModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-lg p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Bulk Import Students</h3>
                                <button onClick={() => setShowBulkImportModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><X size={24} /></button>
                            </div>

                            {!selectedFile ? (
                                <div className="relative border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-8 flex flex-col items-center justify-center text-center hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                                    <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-900/30 rounded-full flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-4 group-hover:scale-110 transition-transform">
                                        <UploadCloud size={32} />
                                    </div>
                                    <p className="font-medium text-slate-900 dark:text-white mb-1">Click to upload or drag and drop</p>
                                    <p className="text-sm text-slate-500">CSV, Excel files (max 10MB)</p>
                                    <input
                                        id="bulk-upload-input"
                                        type="file"
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                        accept=".csv,.xlsx,.xls"
                                        onChange={handleFileSelect}
                                    />
                                </div>
                            ) : (
                                <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg">
                                            <FileText size={24} />
                                        </div>
                                        <div className="text-sm">
                                            <p className="font-medium text-slate-900 dark:text-white">{selectedFile.name}</p>
                                            <p className="text-slate-500">{(selectedFile.size / 1024).toFixed(2)} KB</p>
                                        </div>
                                    </div>
                                    <button onClick={() => setSelectedFile(null)} className="text-slate-400 hover:text-red-500"><X size={20} /></button>
                                </div>
                            )}

                            <div className="mt-6">
                                <div className="flex items-start gap-2 mb-6 text-sm text-slate-500 bg-blue-50 dark:bg-blue-900/10 p-3 rounded-lg text-blue-600 dark:text-blue-300">
                                    <div className="shrink-0 mt-0.5">Info</div>
                                    <p>Ensure your file follows the template format. <a href="/template.xlsx" download className="underline font-semibold">Download Template</a></p>
                                </div>
                                <div className="flex justify-end gap-3">
                                    <Button variant="outline" onClick={() => setShowBulkImportModal(false)}>Cancel</Button>
                                    <Button onClick={handleBulkUpload} disabled={!selectedFile || isUploading}>
                                        {isUploading ? 'Importing...' : 'Import Students'}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* View/Edit Student Modal */}
                {selectedStudent && studentForm && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-2xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 relative max-h-[90vh] overflow-y-auto">
                            {/* Modal Header */}
                            <div className="flex justify-between items-start mb-6">
                                <div className="flex items-center gap-4">
                                    <div className="relative">
                                        {resolveImageSrc(studentLogoPreview || (selectedStudent as any).logo) ? (
                                            <img
                                                src={resolveImageSrc(studentLogoPreview || (selectedStudent as any).logo)}
                                                alt={selectedStudent.name}
                                                className="w-16 h-16 rounded-full object-cover border-4 border-white dark:border-slate-800 shadow-lg"
                                            />
                                        ) : (
                                            <div className="w-16 h-16 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-xl font-bold text-indigo-700 dark:text-indigo-400 border-4 border-white dark:border-slate-800 shadow-lg">
                                                {selectedStudent.name.charAt(0)}
                                            </div>
                                        )}
                                        {isEditingStudent && (
                                            <>
                                                <input
                                                    id="student-logo-edit"
                                                    type="file"
                                                    accept="image/*"
                                                    className="hidden"
                                                    onChange={(e) => handleUploadStudentProfileLogo(e.target.files?.[0] || null)}
                                                />
                                                <label
                                                    htmlFor="student-logo-edit"
                                                    className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-2 py-1 rounded-md text-[10px] font-semibold bg-slate-900 text-white cursor-pointer whitespace-nowrap"
                                                >
                                                    {isStudentLogoUploading ? 'Uploading...' : 'Change'}
                                                </label>
                                            </>
                                        )}
                                    </div>
                                    <div>
                                        {isEditingStudent ? (
                                            <input
                                                value={studentForm.name}
                                                onChange={(e) => setStudentForm({ ...studentForm, name: e.target.value })}
                                                className="text-2xl font-bold bg-transparent border-b border-slate-300 focus:border-indigo-500 outline-none text-slate-900 dark:text-white w-full"
                                            />
                                        ) : (
                                            <h3 className="text-2xl font-bold text-slate-900 dark:text-white">{selectedStudent.name}</h3>
                                        )}
                                        <div className="flex items-center gap-2 mt-1">
                                            <Badge variant="outline">Roll: {selectedStudent.roll_number}</Badge>
                                            <Badge variant="outline">{(studentForm as any).class_name || (selectedStudent as any).class_name || 'Class N/A'}</Badge>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    {!isEditingStudent && (
                                        <button
                                            onClick={() => setIsEditingStudent(true)}
                                            className="p-2 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
                                            title="Edit Profile"
                                        >
                                            <Pencil size={20} />
                                        </button>
                                    )}
                                    <button
                                        onClick={() => {
                                            setSelectedStudent(null);
                                            setStudentLogoPreview('');
                                            setStudentLogoUploadName('');
                                        }}
                                        className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
                                    >
                                        <X size={24} />
                                    </button>
                                </div>
                            </div>

                            {/* Modal Content */}
                            <div className="space-y-6">
                                {/* Personal Info */}
                                <div>
                                    <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">Academic Info</h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                                            <p className="text-xs text-slate-500 mb-1">Admission No</p>
                                            <p className="font-medium font-mono">{selectedStudent.admission_no}</p>
                                        </div>
                                        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                                            <p className="text-xs text-slate-500 mb-1">Date of Birth</p>
                                            {isEditingStudent ? (
                                                <input
                                                    type="date"
                                                    value={studentForm.dob}
                                                    onChange={(e) => setStudentForm({ ...studentForm, dob: e.target.value })}
                                                    className="bg-transparent w-full text-sm font-medium outline-none border-b border-indigo-300"
                                                />
                                            ) : (
                                                <p className="font-medium">{selectedStudent.dob}</p>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Guardian Info */}
                                <div>
                                    <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">Guardian Information</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                                            <p className="text-xs text-slate-500 mb-1">Guardian Name</p>
                                            {isEditingStudent ? (
                                                <input
                                                    value={studentForm.guardian_name}
                                                    onChange={(e) => setStudentForm({ ...studentForm, guardian_name: e.target.value })}
                                                    className="bg-transparent w-full font-medium outline-none border-b border-indigo-300"
                                                />
                                            ) : (
                                                <p className="font-medium">{selectedStudent.guardian_name}</p>
                                            )}
                                        </div>
                                        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                                            <p className="text-xs text-slate-500 mb-1">Guardian Phone</p>
                                            {isEditingStudent ? (
                                                <input
                                                    value={studentForm.guardian_phone}
                                                    onChange={(e) => setStudentForm({ ...studentForm, guardian_phone: e.target.value })}
                                                    className="bg-transparent w-full font-medium outline-none border-b border-indigo-300"
                                                />
                                            ) : (
                                                <p className="font-medium">{selectedStudent.guardian_phone}</p>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Financial Info - Editable */}
                                <div>
                                    <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">Financial Status</h4>
                                    <div className="p-4 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                        <div>
                                            <p className="text-sm font-medium text-indigo-900 dark:text-indigo-200">Current Fee Status</p>
                                            <p className="text-xs text-indigo-600 dark:text-indigo-400">Updates affect invoice generation</p>
                                        </div>
                                        {isEditingStudent ? (
                                            <select
                                                value={studentForm.fees_status}
                                                onChange={(e) => setStudentForm({ ...studentForm, fees_status: e.target.value as any })}
                                                className="rounded-lg border border-indigo-200 dark:border-indigo-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500"
                                            >
                                                <option value="Paid">Paid</option>
                                                <option value="Pending">Pending</option>
                                                <option value="Overdue">Overdue</option>
                                            </select>
                                        ) : (
                                            <Badge variant={studentForm.fees_status === 'Paid' ? 'success' : studentForm.fees_status === 'Overdue' ? 'danger' : 'warning'} className="text-sm px-3 py-1">
                                                {studentForm.fees_status}
                                            </Badge>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Footer Actions */}
                            <div className="flex gap-3 mt-8 pt-6 border-t border-slate-100 dark:border-slate-800">
                                {isEditingStudent ? (
                                    <>
                                        <Button
                                            variant="outline"
                                            className="flex-1"
                                            onClick={() => {
                                                setStudentForm(selectedStudent);
                                                setStudentLogoPreview((selectedStudent as any)?.logo || '');
                                                setStudentLogoUploadName('');
                                                setIsEditingStudent(false);
                                            }}
                                        >
                                            Cancel
                                        </Button>
                                        <Button className="flex-1" icon={Save} onClick={handleSaveStudentChanges}>Save Details</Button>
                                    </>
                                ) : (
                                    <>
                                        <Button
                                            variant="outline"
                                            className="flex-1"
                                            onClick={() => {
                                                setSelectedStudent(null);
                                                setStudentLogoPreview('');
                                                setStudentLogoUploadName('');
                                            }}
                                        >
                                            Close
                                        </Button>
                                        <Button
                                            className="flex-1"
                                            icon={FileText}
                                            variant="primary"
                                            onClick={() => selectedStudent && handleOpenStudentReportCard(selectedStudent)}
                                        >
                                            View Academic Report
                                        </Button>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {showStudentReportCardModal && studentReportCard && selectedStudent && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-4xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[90vh] overflow-y-auto">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-xl font-bold">Report Card: {studentReportCard.student.name}</h3>
                                <button
                                    onClick={() => setShowStudentReportCardModal(false)}
                                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                                >
                                    <X size={24} />
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6">
                                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                                    <p className="text-xs text-slate-500">Class</p>
                                    <p className="font-semibold">{studentReportCard.student.class_name}</p>
                                </div>
                                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                                    <p className="text-xs text-slate-500">Overall %</p>
                                    <p className="font-semibold">{studentReportCard.summary.percentage}%</p>
                                </div>
                                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                                    <p className="text-xs text-slate-500">Grade</p>
                                    <p className="font-semibold">{studentReportCard.summary.grade}</p>
                                </div>
                                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                                    <p className="text-xs text-slate-500">Result</p>
                                    <p className="font-semibold">{studentReportCard.summary.pass ? 'Pass' : 'Needs Improvement'}</p>
                                </div>
                            </div>

                            <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <label className="text-sm text-slate-500">Term</label>
                                    <select
                                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none dark:border-slate-700 dark:bg-slate-800"
                                        value={selectedReportCardTerm}
                                        onChange={async (e) => {
                                            const term = e.target.value;
                                            setSelectedReportCardTerm(term);
                                            if (selectedStudent) {
                                                await handleOpenStudentReportCard(selectedStudent, term);
                                            }
                                        }}
                                    >
                                        <option value="">Latest / All</option>
                                        {studentReportCardTerms.map((term) => (
                                            <option key={`term-${term}`} value={term}>{term}</option>
                                        ))}
                                    </select>
                                </div>
                                <Button icon={Download} onClick={handleDownloadStudentReportCard}>Download PDF</Button>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="text-left text-slate-500 border-b border-slate-100 dark:border-slate-800">
                                        <tr>
                                            <th className="pb-3">Subject</th>
                                            <th className="pb-3">Score</th>
                                            <th className="pb-3">Max</th>
                                            <th className="pb-3">Percentage</th>
                                            <th className="pb-3">Band</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {studentReportCard.subjects.map((row, idx) => (
                                            <tr key={`${row.subject}-${idx}`}>
                                                <td className="py-3">{row.subject}</td>
                                                <td className="py-3">{row.score}</td>
                                                <td className="py-3">{row.max_score}</td>
                                                <td className="py-3">{row.percentage}%</td>
                                                <td className="py-3">{row.band}</td>
                                            </tr>
                                        ))}
                                        {studentReportCard.subjects.length === 0 && (
                                            <tr>
                                                <td className="py-4 text-slate-500" colSpan={5}>No grades found for this term.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    if (currentView === 'teachers') {
        // const teachers = mockUsers.filter(u => u.role === UserRole.TEACHER); // Use API data instead
        return (
            <div className="space-y-6 animate-in fade-in duration-500">
                <div className="flex justify-between items-center">
                    <div>
                        <h2 className="text-2xl font-bold">Teachers Management</h2>
                        <p className="text-slate-500">Manage faculty members and assignments.</p>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" icon={UploadCloud} onClick={() => setShowBulkTeacherImportModal(true)}>Bulk Import</Button>
                        <Button icon={Plus} onClick={() => setShowAddTeacherModal(true)}>Add Teacher</Button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {teachers.map(teacher => {
                        const teacherIdKey = String((teacher as any).id);
                        const isTeacherMenuOpen = openTeacherMenuId === teacherIdKey;
                        return (
                        <Card key={teacher.id} className={`group relative overflow-visible ${isTeacherMenuOpen ? 'z-30' : 'z-0'}`}>
                            <div className="flex items-start justify-between mb-4">
                                {resolveImageSrc(teacher.logo) ? (
                                    <img src={resolveImageSrc(teacher.logo)} alt={teacher.name} className="w-16 h-16 rounded-full object-cover border-2 border-white dark:border-slate-700 shadow-sm" />
                                ) : (
                                    <div className="w-16 h-16 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-lg font-bold text-indigo-700 dark:text-indigo-300 border-2 border-white dark:border-slate-700 shadow-sm">
                                        {String(teacher.name || 'T').charAt(0)}
                                    </div>
                                )}
                                {(() => {
                                        const status = teacher.is_active;
                                        const statusStr = String(status).toLowerCase();
                                        const isActive = status === true || statusStr === '1' || statusStr === 'true';
                                        let text = '';
                                        let variant = '';
                                        if (isActive) { text = 'Active'; variant = 'success'; }
                                        else if (status === false || statusStr === '0') { text = 'Inactive'; variant = 'danger'; }
                                        else { text = 'Unknown'; variant = 'secondary'; }
                                        return <Badge variant={variant}>{text}</Badge>;
                                    })()}
                            </div>
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">{teacher.name}</h3>
                            <p className="text-sm text-slate-500 mb-4">{teacher.department || 'N/A'}</p>

                            <div className="space-y-2 text-sm">
                                <div className="flex items-center gap-3 text-slate-600 dark:text-slate-400">
                                    <Mail size={16} />
                                    <span>{teacher.email}</span>
                                </div>
                                <div className="flex items-center gap-3 text-slate-600 dark:text-slate-400">
                                    <Phone size={16} />
                                    <span>{teacher.phone || 'N/A'}</span>
                                </div>
                            </div>

                            <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex gap-2">
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="flex-1"
                                    onClick={() => openTeacherProfile(teacher, false)}
                                >
                                    View Profile
                                </Button>
                                <div className="relative" onClick={(e) => e.stopPropagation()}>
                                    <Button
                                        size="sm"
                                        variant="secondary"
                                        className="px-3"
                                        aria-label={`Open actions for ${teacher.name}`}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setOpenTeacherMenuId((prev) => prev === teacherIdKey ? null : teacherIdKey);
                                        }}
                                    >
                                        <MoreHorizontal size={16} />
                                    </Button>
                                    {isTeacherMenuOpen && (
                                        <div className="absolute right-0 mt-2 w-44 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl p-1 z-50">
                                            <button
                                                type="button"
                                                className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                                                onClick={() => openTeacherProfile(teacher, false)}
                                            >
                                                View Profile
                                            </button>
                                            <button
                                                type="button"
                                                className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                                                onClick={() => openTeacherProfile(teacher, true)}
                                            >
                                                Edit Profile
                                            </button>
                                            <button
                                                type="button"
                                                className="w-full text-left px-3 py-2 text-sm rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                                                onClick={() => handleDeleteTeacher(teacher)}
                                            >
                                                Delete Teacher
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </Card>
                    )})}
                </div>

                {showAddTeacherModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-2xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
                            <h3 className="text-xl font-bold mb-6">Add New Teacher</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex justify-center">
                                    <label htmlFor="logo-upload" className="cursor-pointer group">
                                        <input
                                            id="logo-upload"
                                            name="logo"
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            onChange={async (e) => {
                                                const file = e.target.files?.[0];
                                                if (!file) return;

                                                const formData = new FormData();
                                                formData.append("logo", file);

                                                try {
                                                    const res = await fetch(
                                                        `${API_BASE_URL}/api/admin/teachers/logo`,
                                                        {
                                                            method: "POST",
                                                            headers: {
                                                                Authorization: `Bearer ${localStorage.getItem(
                                                                    "token"
                                                                )}`,
                                                            },
                                                            body: formData,
                                                        }
                                                    );
                                                    const data = await res.json();
                                                    if (res.ok) {
                                                        setLogoUrl(data.url);
                                                        toast.success("Logo uploaded successfully");
                                                    } else {
                                                        toast.error("Logo upload failed");
                                                    }
                                                } catch (err) {
                                                    toast.error("Error uploading logo");
                                                }
                                            }}
                                        />
                                        {logoUrl ? (
                                            <div className="w-32 h-32 rounded-2xl border-4 border-slate-300 dark:border-slate-700 overflow-hidden relative group-hover:border-indigo-500 transition-all">
                                                <img
                                                    src={
                                                        logoUrl.startsWith("http")
                                                            ? logoUrl
                                                            : `${API_BASE_URL}${logoUrl}`
                                                    }
                                                    alt="Logo Preview"
                                                    className="w-full h-full object-cover"
                                                />
                                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <p className="text-white text-xs font-medium">
                                                        Change
                                                    </p>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="w-32 h-32 rounded-2xl border-4 border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center overflow-hidden bg-slate-50 dark:bg-slate-800 group-hover:border-indigo-500 transition-all">
                                                <div className="text-center">
                                                    <UploadCloud
                                                        size={40}
                                                        className="mx-auto text-slate-400 group-hover:text-indigo-600"
                                                    />
                                                    <p className="text-xs text-slate-500 mt-2">
                                                        Click to upload logo
                                                    </p>
                                                </div>
                                            </div>
                                        )}
                                    </label>
                                </div>
                                <Input
                                    label="Full Name"
                                    placeholder="e.g. Alex Johnson"
                                    value={newTeacher.name}
                                    onChange={(e) => setNewTeacher({ ...newTeacher, name: e.target.value })}
                                />
                                <Input
                                    label="Email Address"
                                    type="email"
                                    placeholder="teacher@school.edu"
                                    value={newTeacher.email}
                                    onChange={(e) => setNewTeacher({ ...newTeacher, email: e.target.value })}
                                />
                                <Input
                                    label="Password"
                                    type="password"
                                    placeholder="Min 12 chars with upper/lower/number/special"
                                    value={newTeacher.password}
                                    onChange={(e) => setNewTeacher({ ...newTeacher, password: e.target.value })}
                                />
                                <Input
                                    label="Phone Number"
                                    placeholder="+91 555..."
                                    value={newTeacher.phone}
                                    onChange={(e) => setNewTeacher({ ...newTeacher, phone: e.target.value })}
                                />
                                <Input
                                    label="Subject Specialization"
                                    placeholder="e.g. Mathematics"
                                    value={newTeacher.department}
                                    onChange={(e) => setNewTeacher({ ...newTeacher, department: e.target.value })}
                                />
                                <div className="col-span-2">
                                    <Input
                                        label="Home Address"
                                        placeholder="Street address..."
                                        value={newTeacher.address}
                                        onChange={(e) => setNewTeacher({ ...newTeacher, address: e.target.value })}
                                    />
                                </div>
                                <div className="col-span-2 grid grid-cols-2 gap-4">
                                    <Input
                                        label="Join Date"
                                        type="date"
                                        value={newTeacher.joinDate}
                                        onChange={(e) => setNewTeacher({ ...newTeacher, joinDate: e.target.value })}
                                    />
                                    <div>
                                        <label className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-1.5 block">Status</label>
                                        <select
                                            className="w-full rounded-xl border border-slate-200 bg-white/50 px-4 py-2.5 text-sm outline-none dark:border-slate-700 dark:bg-slate-800"
                                            value={newTeacher.status}
                                            onChange={(e) => setNewTeacher({ ...newTeacher, status: e.target.value })}
                                        >
                                            <option>Active</option>
                                            <option>Inactive</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                            <div className="flex justify-end gap-3 mt-8">
                                <Button variant="outline" onClick={() => setShowAddTeacherModal(false)}>Cancel</Button>
                                <Button onClick={handleCreateTeacher}>Create Teacher Profile</Button>
                            </div>
                        </div>
                    </div>
                )}

                {showBulkTeacherImportModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-lg p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Bulk Import Teachers</h3>
                                <button onClick={() => setShowBulkTeacherImportModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><X size={24} /></button>
                            </div>

                            {!selectedTeacherFile ? (
                                <div className="relative border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-8 flex flex-col items-center justify-center text-center hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                                    <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-900/30 rounded-full flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-4 group-hover:scale-110 transition-transform">
                                        <UploadCloud size={32} />
                                    </div>
                                    <p className="font-medium text-slate-900 dark:text-white mb-1">Click to upload or drag and drop</p>
                                    <p className="text-sm text-slate-500">CSV, Excel files (max 10MB)</p>
                                    <input
                                        id="teacher-bulk-upload-input"
                                        type="file"
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                        accept=".csv,.xlsx,.xls"
                                        onChange={handleTeacherFileSelect}
                                    />
                                </div>
                            ) : (
                                <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg">
                                            <FileText size={24} />
                                        </div>
                                        <div className="text-sm">
                                            <p className="font-medium text-slate-900 dark:text-white">{selectedTeacherFile.name}</p>
                                            <p className="text-slate-500">{(selectedTeacherFile.size / 1024).toFixed(2)} KB</p>
                                        </div>
                                    </div>
                                    <button onClick={() => setSelectedTeacherFile(null)} className="text-slate-400 hover:text-red-500"><X size={20} /></button>
                                </div>
                            )}

                            <div className="mt-6">
                                <div className="flex items-start gap-2 mb-6 text-sm text-slate-500 bg-blue-50 dark:bg-blue-900/10 p-3 rounded-lg text-blue-600 dark:text-blue-300">
                                    <div className="shrink-0 mt-0.5">Info</div>
                                    <p>Use the provided format. Password is required for every row and must be strong (min 12 chars, upper/lower/number/special). <a href="/teachers-template.xlsx" download className="underline font-semibold">Download Template</a></p>
                                </div>
                                <div className="flex justify-end gap-3">
                                    <Button variant="outline" onClick={() => setShowBulkTeacherImportModal(false)}>Cancel</Button>
                                    <Button onClick={handleTeacherBulkUpload} disabled={!selectedTeacherFile || isTeacherUploading}>
                                        {isTeacherUploading ? 'Importing...' : 'Import Teachers'}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {selectedTeacher && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-lg p-6 shadow-2xl border border-slate-200 dark:border-slate-800 relative">
                            <div className="absolute top-4 right-4 flex gap-2">
                                {!isEditingTeacher && (
                                    <button
                                        onClick={() => setIsEditingTeacher(true)}
                                        className="p-2 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
                                        title="Edit Profile"
                                    >
                                        <Pencil size={20} />
                                    </button>
                                )}
                                <button
                                    onClick={() => {
                                        setSelectedTeacher(null);
                                        setTeacherLogoPreview('');
                                        setTeacherLogoUploadName('');
                                    }}
                                    className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
                                >
                                    <X size={24} />
                                </button>
                            </div>

                            <div className="flex flex-col items-center mb-6">
                                <div className="relative mb-4">
                                    {resolveImageSrc(teacherLogoPreview || selectedTeacher.logo) ? (
                                        <img
                                            src={resolveImageSrc(teacherLogoPreview || selectedTeacher.logo)}
                                            alt={selectedTeacher.name}
                                            className="w-24 h-24 rounded-full object-cover border-4 border-white dark:border-slate-800 shadow-lg"
                                        />
                                    ) : (
                                        <div className="w-24 h-24 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-2xl font-bold text-indigo-700 dark:text-indigo-300 border-4 border-white dark:border-slate-800 shadow-lg">
                                            {selectedTeacher.name.charAt(0)}
                                        </div>
                                    )}

                                    {isEditingTeacher && (
                                        <>
                                            <input
                                                id="teacher-logo-edit"
                                                type="file"
                                                accept="image/*"
                                                className="hidden"
                                                onChange={(e) => handleUploadTeacherProfileLogo(e.target.files?.[0] || null)}
                                            />
                                            <label
                                                htmlFor="teacher-logo-edit"
                                                className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-2 py-1 rounded-md text-[11px] font-semibold bg-slate-900 text-white cursor-pointer whitespace-nowrap"
                                            >
                                                {isTeacherLogoUploading ? 'Uploading...' : 'Change Photo'}
                                            </label>
                                        </>
                                    )}
                                </div>

                                {isEditingTeacher ? (
                                    <div className="w-full text-center mt-2 space-y-3">
                                        <Input
                                            value={editForm.name}
                                            onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                                            className="text-center font-bold text-lg"
                                            placeholder="Full Name"
                                        />
                                    </div>
                                ) : (
                                    <h3 className="text-2xl font-bold text-slate-900 dark:text-white">{selectedTeacher.name}</h3>
                                )}

                                <span className="px-3 py-1 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-xs font-semibold mt-2">
                                    Senior Instructor
                                </span>
                            </div>

                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                                        <p className="text-xs text-slate-500 uppercase font-semibold mb-1">Email</p>
                                        {isEditingTeacher ? (
                                            <Input
                                                value={editForm.email}
                                                onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                                                className="h-8 py-1 px-2 text-sm"
                                            />
                                        ) : (
                                            <p className="text-sm font-medium truncate" title={selectedTeacher.email}>{selectedTeacher.email}</p>
                                        )}
                                    </div>
                                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                                        <p className="text-xs text-slate-500 uppercase font-semibold mb-1">Phone</p>
                                        {isEditingTeacher ? (
                                            <Input
                                                value={editForm.phone}
                                                onChange={e => setEditForm({ ...editForm, phone: e.target.value })}
                                                className="h-8 py-1 px-2 text-sm"
                                            />
                                        ) : (
                                            <p className="text-sm font-medium">{selectedTeacher.phone || 'N/A'}</p>
                                        )}
                                    </div>
                                </div>

                                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                                    <p className="text-xs text-slate-500 uppercase font-semibold mb-1">Subject Specialization</p>
                                    {isEditingTeacher ? (
                                        <Input
                                            value={editForm.subject}
                                            onChange={e => setEditForm({ ...editForm, subject: e.target.value })}
                                            className="h-8 py-1 px-2 text-sm"
                                        />
                                    ) : (
                                        <p className="text-sm font-medium">{editForm.subject}</p>
                                    )}
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                                        <p className="text-xs text-slate-500 uppercase font-semibold mb-1">Status</p>
                                        {isEditingTeacher ? (
                                            <select
                                                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm outline-none"
                                                value={editForm.status}
                                                onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                                            >
                                                <option>Active</option>
                                                <option>Inactive</option>
                                            </select>
                                        ) : (
                                            <Badge variant={editForm.status === 'Active' ? 'success' : 'danger'}>
                                                {editForm.status}
                                            </Badge>
                                        )}
                                    </div>
                                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                                        <p className="text-xs text-slate-500 uppercase font-semibold mb-1">Join Date</p>
                                        {isEditingTeacher ? (
                                            <Input
                                                type="date"
                                                value={editForm.joinDate}
                                                onChange={e => setEditForm({ ...editForm, joinDate: e.target.value })}
                                                className="h-8 py-1 px-2 text-sm"
                                            />
                                        ) : (
                                            <p className="text-sm font-medium">{editForm.joinDate}</p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-3 mt-8">
                                {isEditingTeacher ? (
                                    <>
                                        <Button
                                            variant="outline"
                                            className="flex-1"
                                            onClick={() => {
                                                if (selectedTeacher) {
                                                    setEditForm({
                                                        name: selectedTeacher.name,
                                                        email: selectedTeacher.email,
                                                        phone: selectedTeacher.phone || '',
                                                        subject: selectedTeacher.department || '',
                                                        status: (selectedTeacher.is_active === true || selectedTeacher.is_active === 1 || selectedTeacher.is_active === '1' || String(selectedTeacher.is_active).toLowerCase() === 'true') ? 'Active' : 'Inactive',
                                                        joinDate: selectedTeacher.joinDate || '',
                                                    });
                                                    setTeacherLogoPreview(selectedTeacher.logo || '');
                                                }
                                                setTeacherLogoUploadName('');
                                                setIsEditingTeacher(false);
                                            }}
                                        >
                                            Cancel
                                        </Button>
                                        <Button
                                            variant="outline"
                                            className="flex-1"
                                            onClick={handleUpdateTeacherStatus}
                                        >
                                            Update Status
                                        </Button>
                                        <Button className="flex-1" icon={Save} onClick={handleSaveTeacherChanges}>Save Changes</Button>
                                    </>
                                ) : (
                                    <>
                                        <Button
                                            variant="outline"
                                            className="flex-1"
                                            onClick={() => {
                                                setSelectedTeacher(null);
                                                setTeacherLogoPreview('');
                                                setTeacherLogoUploadName('');
                                            }}
                                        >
                                            Close
                                        </Button>
                                        <Button className="flex-1" icon={Mail}>Send Message</Button>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    if (currentView === 'leaves') {
        return (
            <div className="space-y-6 animate-in fade-in duration-500">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                        <Calendar size={28} className="text-indigo-600" /> Leave Approvals
                    </h2>
                    <div className="flex gap-3">
                        <select
                            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                            value={leaveRoleFilter}
                            onChange={(e) => setLeaveRoleFilter(e.target.value)}
                        >
                            <option value="all">All Roles</option>
                            <option value="teacher">Teachers</option>
                            <option value="student">Students</option>
                        </select>
                        <select
                            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                            value={leaveStatusFilter}
                            onChange={(e) => setLeaveStatusFilter(e.target.value)}
                        >
                            <option value="all">All Status</option>
                            <option value="pending">Pending</option>
                            <option value="approved">Approved</option>
                            <option value="rejected">Rejected</option>
                        </select>
                    </div>
                </div>

                <Card className="p-0 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                                <tr>
                                    <th className="px-6 py-4 text-left font-semibold text-slate-500 uppercase">Applicant</th>
                                    <th className="px-6 py-4 text-left font-semibold text-slate-500 uppercase">Role</th>
                                    <th className="px-6 py-4 text-left font-semibold text-slate-500 uppercase">Duration</th>
                                    <th className="px-6 py-4 text-left font-semibold text-slate-500 uppercase">Reason</th>
                                    <th className="px-6 py-4 text-center font-semibold text-slate-500 uppercase">Status</th>
                                    <th className="px-6 py-4 text-center font-semibold text-slate-500 uppercase">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {adminLeaves.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                                            No leave requests found matching the filters.
                                        </td>
                                    </tr>
                                ) : (
                                    adminLeaves.map(leave => (
                                        <tr key={leave.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                            <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">
                                                {leave.user_name}
                                            </td>
                                            <td className="px-6 py-4">
                                                <Badge variant={leave.user_role === 'teacher' ? 'primary' : 'secondary'}>
                                                    {leave.user_role}
                                                </Badge>
                                            </td>
                                            <td className="px-6 py-4 text-slate-600 dark:text-slate-400">
                                                {new Date(leave.start_date).toLocaleDateString()} to {new Date(leave.end_date).toLocaleDateString()}
                                            </td>
                                            <td className="px-6 py-4 text-slate-600 dark:text-slate-400 max-w-xs">
                                                <p className="truncate" title={leave.reason}>{leave.reason}</p>
                                            </td>
                                            <td className="px-6 py-4 flex justify-center">
                                                <Badge variant={leave.status === 'approved' ? 'success' : leave.status === 'rejected' ? 'danger' : 'warning'}>
                                                    {leave.status}
                                                </Badge>
                                            </td>
                                            <td className="px-6 py-4">
                                                {leave.status === 'pending' ? (
                                                    <div className="flex justify-center gap-2">
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="border-emerald-500 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 font-medium"
                                                            onClick={() => {
                                                                const comment = prompt("Add comment for approval (optional):", "");
                                                                if (comment !== null) updateAdminLeaveStatus(leave.id, { status: 'approved', comment }).then(() => { toast.success("Leave approved"); fetchAdminLeaves(); }).catch(err => toast.error(err.response?.data?.message || "Failed to update"));
                                                            }}
                                                        >
                                                            Approve
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="border-red-500 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 font-medium"
                                                            onClick={() => {
                                                                const comment = prompt("Add reason for rejection:", "");
                                                                if (comment !== null) updateAdminLeaveStatus(leave.id, { status: 'rejected', comment }).then(() => { toast.success("Leave rejected"); fetchAdminLeaves(); }).catch(err => toast.error(err.response?.data?.message || "Failed to update"));
                                                            }}
                                                        >
                                                            Reject
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    <div className="text-center text-xs text-slate-500 w-full truncate max-w-[150px]">
                                                        {leave.comment ? `Note: ${leave.comment}` : '-'}
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </Card>
            </div>
        );
    }

    if (currentView === 'classes') {
        // const teachers = mockUsers.filter(u => u.role === UserRole.TEACHER); // Use API data instead
        return (
            <div className="space-y-6 animate-in fade-in duration-500">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <h2 className="text-2xl font-bold">Class Management</h2>
                    <div className="flex gap-3">
                        <Button
                            variant="outline"
                            icon={BookOpen}
                            onClick={() => {
                                setNewSubject({ name: '', code: '' });
                                setIsSubjectCodeManual(false);
                                setShowSubjectModal(true);
                            }}
                        >
                            Add Subject
                        </Button>
                        <Button variant="outline" icon={GraduationCap} onClick={() => setShowAssignModal(true)}>Assign Subject</Button>
                        <Button variant="outline" icon={CalendarDays} onClick={() => setShowScheduleModal(true)}>Add Schedule</Button>
                        <Button icon={Plus} onClick={() => setShowCreateClassModal(true)}>Create Class</Button>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {classes.length > 0 ? classes.map(cls => {
                        const classId = String((cls as any).id);
                        const isClassMenuOpen = openClassMenuId === classId;
                        return (
                        <Card key={cls.id} className="relative overflow-hidden group">
                            <div className="absolute top-0 left-0 w-2 h-full bg-indigo-500"></div>
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="text-2xl font-bold">Grade {cls.grade}-{cls.section}</h3>
                                    <p className="text-slate-500 text-sm">Academic Year: {cls.academic_year}</p>
                                </div>
                                <div className="relative" onClick={(e) => e.stopPropagation()}>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        icon={MoreHorizontal}
                                        className="px-2"
                                        aria-label={`Open actions for Grade ${cls.grade}-${cls.section}`}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setOpenClassMenuId((prev) => prev === classId ? null : classId);
                                        }}
                                    />
                                    {isClassMenuOpen && (
                                        <div className="absolute right-0 mt-2 w-44 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl p-1 z-20">
                                            <button
                                                type="button"
                                                className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                                                onClick={() => openClassTimetable(classId)}
                                            >
                                                View Timetable
                                            </button>
                                            <button
                                                type="button"
                                                className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                                                onClick={() => openAssignSubjectModalForClass(classId)}
                                            >
                                                Assign Subject
                                            </button>
                                            <button
                                                type="button"
                                                className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                                                onClick={() => openScheduleModalForClass(classId)}
                                            >
                                                Add Schedule
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="mt-6 space-y-2">
                                <div className="flex justify-between text-sm border-b border-slate-100 dark:border-slate-800 pb-2">
                                    <span className="text-slate-500">Class Teacher</span>
                                    <span className="font-medium">{cls.teacher_name || 'Unassigned'}</span>
                                </div>
                                <div className="flex justify-between text-sm border-b border-slate-100 dark:border-slate-800 pb-2">
                                    <span className="text-slate-500">Students</span>
                                    <span className="font-medium">32</span>
                                </div>
                            </div>
                            <Button
                                variant="outline"
                                className="w-full mt-4 text-sm"
                                onClick={() => openClassTimetable(classId)}
                            >
                                View Timetable
                            </Button>
                        </Card>
                    )}) : (
                        <div className="col-span-3 text-center py-12">
                            <p className="text-slate-500">No classes found. Create your first class to get started!</p>
                        </div>
                    )}
                </div>

                <Card>
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold">Class Subjects</h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-slate-500 border-b border-slate-100 dark:border-slate-800">
                                    <th className="pb-3 font-medium">Class</th>
                                    <th className="pb-3 font-medium">Subject</th>
                                    <th className="pb-3 font-medium">Teacher</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {classSubjects.map((cs: any) => (
                                    <tr key={cs.id}>
                                        <td className="py-3">{cs.grade}-{cs.section}</td>
                                        <td className="py-3">{cs.subject}</td>
                                        <td className="py-3">{cs.teacher_name}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Card>

                <div ref={scheduleSectionRef}>
                    <Card>
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
                            <h3 className="font-bold">Schedule Entries</h3>
                            <select
                                className="rounded-xl border border-slate-200 bg-white/50 px-3 py-2 text-sm outline-none dark:border-slate-700 dark:bg-slate-800"
                                value={scheduleClassFilter}
                                onChange={(e) => setScheduleClassFilter(e.target.value)}
                            >
                                <option value="all">All Classes</option>
                                {classes.map((cls: any) => (
                                    <option key={`schedule-filter-${cls.id}`} value={String(cls.id)}>
                                        Grade {cls.grade}-{cls.section}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-left text-slate-500 border-b border-slate-100 dark:border-slate-800">
                                        <th className="pb-3 font-medium">Day</th>
                                        <th className="pb-3 font-medium">Time</th>
                                        <th className="pb-3 font-medium">Class</th>
                                        <th className="pb-3 font-medium">Subject</th>
                                        <th className="pb-3 font-medium">Teacher</th>
                                        <th className="pb-3 font-medium">Room</th>
                                        <th className="pb-3 font-medium text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {filteredScheduleEntries.length === 0 && (
                                        <tr>
                                            <td colSpan={7} className="py-4 text-slate-500 text-center">
                                                No schedule entries found for the selected class.
                                            </td>
                                        </tr>
                                    )}
                                    {filteredScheduleEntries.map((s: any) => (
                                        <tr key={s.id}>
                                            <td className="py-3">{s.day_of_week}</td>
                                            <td className="py-3">{s.start_time} - {s.end_time}</td>
                                            <td className="py-3">{s.grade}-{s.section}</td>
                                            <td className="py-3">{s.subject}</td>
                                            <td className="py-3">{s.teacher_name}</td>
                                            <td className="py-3">{s.room || '-'}</td>
                                            <td className="py-3 text-right">
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={async () => {
                                                        await deleteScheduleEntry(s.id);
                                                        fetchScheduleEntries();
                                                    }}
                                                >
                                                    Remove
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </div>

                {showCreateClassModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-lg p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
                            <h3 className="text-xl font-bold mb-6">Create New Class Group</h3>
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <Input
                                        label="Grade Level"
                                        placeholder="e.g. 10"
                                        value={newClass.grade}
                                        onChange={(e) => setNewClass({ ...newClass, grade: e.target.value })}
                                    />
                                    <Input
                                        label="Section"
                                        placeholder="e.g. A"
                                        value={newClass.section}
                                        onChange={(e) => setNewClass({ ...newClass, section: e.target.value })}
                                    />
                                </div>
                                <Input
                                    label="Academic Year"
                                    placeholder="e.g. 2025-2026"
                                    value={newClass.academicYear}
                                    onChange={(e) => setNewClass({ ...newClass, academicYear: e.target.value })}
                                />

                                <div>
                                    <label className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-1.5 block">Assign Class Teacher</label>
                                    <select
                                        className="w-full rounded-xl border border-slate-200 bg-white/50 px-4 py-2.5 text-sm outline-none dark:border-slate-700 dark:bg-slate-800"
                                        value={newClass.teacherId}
                                        onChange={(e) => setNewClass({ ...newClass, teacherId: e.target.value })}
                                    >
                                        <option value="">Select a teacher...</option>
                                        {teachers.map(t => (
                                            <option key={t.id} value={t.id}>{t.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-1.5 block">Room Number (Optional)</label>
                                    <Input
                                        placeholder="e.g. Room 304"
                                        value={newClass.roomNumber}
                                        onChange={(e) => setNewClass({ ...newClass, roomNumber: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end gap-3 mt-8">
                                <Button variant="outline" onClick={() => setShowCreateClassModal(false)}>Cancel</Button>
                                <Button onClick={handleCreateClass}>Create Class</Button>
                            </div>
                        </div>
                    </div>
                )}
                {showSubjectModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-lg p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-xl font-bold">Add Subject</h3>
                                <button onClick={() => setShowSubjectModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><X size={24} /></button>
                            </div>
                            <div className="space-y-4">
                                <Input
                                    label="Subject Name"
                                    value={newSubject.name}
                                    onChange={(e) => {
                                        const subjectName = e.target.value;
                                        setNewSubject((prev) => ({
                                            ...prev,
                                            name: subjectName,
                                            code: isSubjectCodeManual ? prev.code : generateSubjectCode(subjectName),
                                        }));
                                    }}
                                />
                                <Input
                                    label="Code (Optional)"
                                    value={newSubject.code}
                                    onChange={(e) => {
                                        setIsSubjectCodeManual(true);
                                        setNewSubject({ ...newSubject, code: e.target.value.toUpperCase() });
                                    }}
                                />
                                <p className="text-xs text-slate-500">
                                    Code is auto-generated from subject + school + 3 digits. You can edit it manually.
                                </p>
                            </div>
                            <div className="flex justify-end gap-3 mt-6">
                                <Button variant="outline" onClick={() => setShowSubjectModal(false)}>Cancel</Button>
                                <Button onClick={handleCreateSubject}>Save Subject</Button>
                            </div>
                        </div>
                    </div>
                )}

                {showAssignModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-lg p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-xl font-bold">Assign Subject to Class</h3>
                                <button onClick={() => setShowAssignModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><X size={24} /></button>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <label className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-1.5 block">Class</label>
                                    <select
                                        className="w-full rounded-xl border border-slate-200 bg-white/50 px-4 py-2.5 text-sm outline-none dark:border-slate-700 dark:bg-slate-800"
                                        value={newClassSubject.class_id}
                                        onChange={(e) => setNewClassSubject({ ...newClassSubject, class_id: e.target.value })}
                                    >
                                        <option value="">Select Class</option>
                                        {classes.map((c: any) => (
                                            <option key={c.id} value={c.id}>{c.grade}-{c.section}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-1.5 block">Subject</label>
                                    <select
                                        className="w-full rounded-xl border border-slate-200 bg-white/50 px-4 py-2.5 text-sm outline-none dark:border-slate-700 dark:bg-slate-800"
                                        value={newClassSubject.subject_id}
                                        onChange={(e) => setNewClassSubject({ ...newClassSubject, subject_id: e.target.value })}
                                    >
                                        <option value="">Select Subject</option>
                                        {subjects.map((s: any) => (
                                            <option key={s.id} value={s.id}>{s.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-1.5 block">Teacher</label>
                                    <select
                                        className="w-full rounded-xl border border-slate-200 bg-white/50 px-4 py-2.5 text-sm outline-none dark:border-slate-700 dark:bg-slate-800"
                                        value={newClassSubject.teacher_id}
                                        onChange={(e) => setNewClassSubject({ ...newClassSubject, teacher_id: e.target.value })}
                                    >
                                        <option value="">Select Teacher</option>
                                        {teachers.map((t: any) => (
                                            <option key={t.id} value={t.id}>{t.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className="flex justify-end gap-3 mt-6">
                                <Button variant="outline" onClick={() => setShowAssignModal(false)}>Cancel</Button>
                                <Button onClick={handleAssignSubject}>Assign</Button>
                            </div>
                        </div>
                    </div>
                )}

                {showScheduleModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-lg p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-xl font-bold">Add Schedule Entry</h3>
                                <button onClick={() => setShowScheduleModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><X size={24} /></button>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <label className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-1.5 block">Class Subject</label>
                                    <select
                                        className="w-full rounded-xl border border-slate-200 bg-white/50 px-4 py-2.5 text-sm outline-none dark:border-slate-700 dark:bg-slate-800"
                                        value={newSchedule.class_subject_id}
                                        onChange={(e) => setNewSchedule({ ...newSchedule, class_subject_id: e.target.value })}
                                    >
                                        <option value="">Select Class Subject</option>
                                        {classSubjects.map((cs: any) => (
                                            <option key={cs.id} value={cs.id}>
                                                {cs.grade}-{cs.section} - {cs.subject} - {cs.teacher_name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-1.5 block">Day</label>
                                    <select
                                        className="w-full rounded-xl border border-slate-200 bg-white/50 px-4 py-2.5 text-sm outline-none dark:border-slate-700 dark:bg-slate-800"
                                        value={newSchedule.day_of_week}
                                        onChange={(e) => setNewSchedule({ ...newSchedule, day_of_week: e.target.value })}
                                    >
                                        {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(d => (
                                            <option key={d} value={d}>{d}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <Input
                                        label="Start Time"
                                        type="time"
                                        value={newSchedule.start_time}
                                        onChange={(e) => setNewSchedule({ ...newSchedule, start_time: e.target.value })}
                                    />
                                    <Input
                                        label="End Time"
                                        type="time"
                                        value={newSchedule.end_time}
                                        onChange={(e) => setNewSchedule({ ...newSchedule, end_time: e.target.value })}
                                    />
                                </div>
                                <Input
                                    label="Room"
                                    value={newSchedule.room}
                                    onChange={(e) => setNewSchedule({ ...newSchedule, room: e.target.value })}
                                />
                            </div>
                            <div className="flex justify-end gap-3 mt-6">
                                <Button variant="outline" onClick={() => setShowScheduleModal(false)}>Cancel</Button>
                                <Button onClick={handleCreateSchedule}>Save</Button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        )
    }

    if (currentView === 'attendance') {
        return (
            <div className="space-y-6 animate-in fade-in duration-500">
                <div className="flex justify-between items-center">
                    <h2 className="text-2xl font-bold">Attendance Overview</h2>
                    <div className="flex gap-2">
                        <Input type="date" className="w-40" />
                        <Button
                            variant="outline"
                            icon={Download}
                            onClick={async () => {
                                try {
                                    const blob = await downloadAttendancePdf();
                                    downloadBlob(blob, 'attendance-summary.pdf');
                                } catch (err) {
                                    toast.error("Failed to download PDF");
                                }
                            }}
                        >
                            Report PDF
                        </Button>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2">
                        <Card className="h-full">
                            <h3 className="font-bold mb-4">Weekly Attendance</h3>
                            <div className="h-[300px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={attendanceData}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                        <XAxis dataKey="name" axisLine={false} tickLine={false} />
                                        <YAxis axisLine={false} tickLine={false} />
                                        <Tooltip
                                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                                            cursor={{ fill: '#f1f5f9' }}
                                        />
                                        <Bar dataKey="present" name="Present" fill="#6366f1" radius={[4, 4, 0, 0]} />
                                        <Bar dataKey="absent" name="Absent" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </Card>
                    </div>
                    <div className="space-y-6">
                        <StatCard title="Avg Attendance" value="92%" icon={PieChart} trend="up" />
                        <StatCard title="Absent Today" value="34" icon={Users} trend="down" />
                    </div>
                </div>

                <Card>
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold">Today's Class Submissions</h3>
                        <Badge variant="success">Live Updates</Badge>
                    </div>
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left text-slate-500 border-b border-slate-100 dark:border-slate-800">
                                <th className="pb-3 font-medium">Class</th>
                                <th className="pb-3 font-medium">Teacher</th>
                                <th className="pb-3 font-medium">Time</th>
                                <th className="pb-3 font-medium">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            <tr>
                                <td className="py-3 font-bold">10-A</td>
                                <td className="py-3">Teacher 1</td>
                                <td className="py-3 text-slate-500">09:15 AM</td>
                                <td className="py-3"><Badge variant="success">Submitted</Badge></td>
                            </tr>
                            <tr>
                                <td className="py-3 font-bold">10-B</td>
                                <td className="py-3">Teacher 2</td>
                                <td className="py-3 text-slate-500">09:20 AM</td>
                                <td className="py-3"><Badge variant="success">Submitted</Badge></td>
                            </tr>
                            <tr>
                                <td className="py-3 font-bold">9-A</td>
                                <td className="py-3">Teacher 3</td>
                                <td className="py-3 text-slate-500">-</td>
                                <td className="py-3"><Badge variant="warning">Pending</Badge></td>
                            </tr>
                        </tbody>
                    </table>
                </Card>
            </div>
        );
    }

    if (currentView === 'fees') {
        return (
            <div className="space-y-6 animate-in fade-in duration-500">
                <div className="flex justify-between items-center">
                    <h2 className="text-2xl font-bold">Fees & Invoices</h2>
                    <div className="flex gap-2">
                        <Button variant="outline" icon={Filter}>Filter</Button>
                        <Button
                            variant="outline"
                            icon={FileSpreadsheet}
                            onClick={async () => {
                                try {
                                    const blob = await downloadInvoicesCsv();
                                    downloadBlob(blob, 'invoices.csv');
                                } catch (err) {
                                    toast.error("Failed to download CSV");
                                }
                            }}
                        >
                            Export CSV
                        </Button>
                        <Button
                            variant="outline"
                            icon={Download}
                            onClick={async () => {
                                try {
                                    const blob = await downloadInvoicesPdf();
                                    downloadBlob(blob, 'invoices.pdf');
                                } catch (err) {
                                    toast.error("Failed to download PDF");
                                }
                            }}
                        >
                            Export PDF
                        </Button>
                        <Button icon={Plus} onClick={() => setShowInvoiceModal(true)}>Create Invoice</Button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <StatCard
                        title="Total Collected"
                        value={feesStats?.collected ?? "$0"}
                        icon={DollarSign}
                        trend="up"
                        subtext="This Month"
                    />
                    <StatCard
                        title="Pending Dues"
                        value={feesStats?.pending ?? "$0"}
                        icon={AlertTriangle}
                        trend="down"
                        subtext="Needs Action"
                    />
                    <StatCard
                        title="Total Students"
                        value={feesStats?.total_students ?? 0}
                        icon={GraduationCap}
                        subtext="From invoices"
                    />
                </div>

                <Card className="overflow-hidden">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-bold">Recent Transactions</h3>
                        <div className="flex gap-2">
                            <Button size="sm" variant="ghost">All</Button>
                            <Button size="sm" variant="ghost">Paid</Button>
                            <Button size="sm" variant="ghost">Pending</Button>
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 uppercase font-medium">
                                <tr>
                                    <th className="px-4 py-3 text-left">Invoice ID</th>
                                    <th className="px-4 py-3 text-left">Student</th>
                                    <th className="px-4 py-3 text-left">Amount</th>
                                    <th className="px-4 py-3 text-left">Date</th>
                                    <th className="px-4 py-3 text-left">Method</th>
                                    <th className="px-4 py-3 text-left">Status</th>
                                    <th className="px-4 py-3 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {invoices.map((inv) => (
                                    <tr key={inv.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                        <td className="px-4 py-3 font-mono text-slate-600 dark:text-slate-400">{inv.id}</td>
                                        <td className="px-4 py-3 font-medium">{inv.student_name || inv.student_id}</td>
                                        <td className="px-4 py-3">{`$${inv.amount}`}</td>
                                        <td className="px-4 py-3 text-slate-500">{inv.created_at || inv.due_date}</td>
                                        <td className="px-4 py-3 text-slate-500">-</td>
                                        <td className="px-4 py-3">
                                            <select
                                                className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                                                value={inv.status}
                                                onChange={async (e) => {
                                                    const next = e.target.value;
                                                    try {
                                                        await updateInvoiceStatus(inv.id, next);
                                                        toast.success("Invoice updated");
                                                        fetchInvoices();
                                                        fetchFeesStats();
                                                    } catch (err) {
                                                        toast.error("Failed to update invoice");
                                                    }
                                                }}
                                            >
                                                <option value="paid">paid</option>
                                                <option value="pending">pending</option>
                                                <option value="overdue">overdue</option>
                                            </select>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <Button size="sm" variant="ghost" icon={Printer} className="px-2"></Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Card>

                {showInvoiceModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-lg p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-xl font-bold">Create Invoice</h3>
                                <button onClick={() => setShowInvoiceModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><X size={24} /></button>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <label className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-1.5 block">Student</label>
                                    <select
                                        className="w-full rounded-xl border border-slate-200 bg-white/50 px-4 py-2.5 text-sm outline-none dark:border-slate-700 dark:bg-slate-800"
                                        value={newInvoice.student_id}
                                        onChange={(e) => setNewInvoice({ ...newInvoice, student_id: e.target.value })}
                                    >
                                        <option value="">Select Student</option>
                                        {students.map((s: any) => (
                                            <option key={s.id} value={s.id}>{s.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <Input
                                    label="Amount"
                                    type="number"
                                    value={newInvoice.amount}
                                    onChange={(e) => setNewInvoice({ ...newInvoice, amount: e.target.value })}
                                />
                                <Input
                                    label="Due Date"
                                    type="date"
                                    value={newInvoice.due_date}
                                    onChange={(e) => setNewInvoice({ ...newInvoice, due_date: e.target.value })}
                                />
                            </div>
                            <div className="flex justify-end gap-3 mt-6">
                                <Button variant="outline" onClick={() => setShowInvoiceModal(false)}>Cancel</Button>
                                <Button onClick={() => { handleCreateInvoice(); setShowInvoiceModal(false); }}>Create</Button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    if (currentView === 'reports') {
        return (
            <div className="space-y-8 animate-in fade-in duration-500">
                <div>
                    <h2 className="text-2xl font-bold">Reports Center</h2>
                    <p className="text-slate-500">Generate and download detailed reports.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {reportTypes.map((report) => (
                        <div key={report.id} className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:shadow-lg hover:border-indigo-500 transition-all group cursor-pointer">
                            <div className="flex items-start justify-between">
                                <div className={`p-3 rounded-xl ${report.bg} ${report.color} mb-4 group-hover:scale-110 transition-transform`}>
                                    <report.icon size={24} />
                                </div>
                                <div className="p-2 rounded-full bg-slate-50 dark:bg-slate-800 text-slate-400 group-hover:text-indigo-500">
                                    <ArrowUpRight size={20} />
                                </div>
                            </div>
                            <h3 className="text-xl font-bold mb-2">{report.title}</h3>
                            <p className="text-slate-500 text-sm mb-6">{report.description}</p>
                            <div className="flex gap-3">
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="w-full"
                                    onClick={async () => {
                                        try {
                                            let data: any[] = [];
                                            if (report.title === 'Academic Performance') {
                                                data = await getAcademicReport();
                                            } else if (report.title === 'Attendance Summary') {
                                                data = await getAttendanceReport();
                                            } else if (report.title === 'Fee Collection') {
                                                data = await getFeeReport();
                                            }
                                            setReportTitle(report.title);
                                            setReportData(Array.isArray(data) ? data : []);
                                            setShowReportModal(true);
                                        } catch (err) {
                                            toast.error("Failed to load preview");
                                        }
                                    }}
                                >
                                    Preview
                                </Button>
                                <Button
                                    size="sm"
                                    className="w-full"
                                    icon={Download}
                                    onClick={async () => {
                                        try {
                                            if (report.title === 'Academic Performance') {
                                                const blob = await downloadAcademicPdf();
                                                downloadBlob(blob, 'academic-performance.pdf');
                                            } else if (report.title === 'Attendance Summary') {
                                                const blob = await downloadAttendancePdf();
                                                downloadBlob(blob, 'attendance-summary.pdf');
                                            } else if (report.title === 'Fee Collection') {
                                                const blob = await downloadFeePdf();
                                                downloadBlob(blob, 'fee-collection.pdf');
                                            }
                                            await logReportDownload({
                                                report_type: report.title,
                                                file_name: `${report.title.replace(/\s+/g, "_")}.pdf`
                                            });
                                            fetchDownloads();
                                            toast.success("Report download logged");
                                        } catch (err) {
                                            toast.error("Failed to log download");
                                        }
                                    }}
                                >
                                    Download PDF
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>

                <Card>
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold">Grades</h3>
                        <Button size="sm" icon={Plus} onClick={() => setShowGradeModal(true)}>Add Grade</Button>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-slate-500 border-b border-slate-100 dark:border-slate-800">
                                    <th className="pb-3 font-medium">Student</th>
                                    <th className="pb-3 font-medium">Subject</th>
                                    <th className="pb-3 font-medium">Term</th>
                                    <th className="pb-3 font-medium">Score</th>
                                    <th className="pb-3 font-medium">Max</th>
                                    <th className="pb-3 font-medium">Date</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {grades.map((g: any) => (
                                    <tr key={g.id}>
                                        <td className="py-3">{g.student_name}</td>
                                        <td className="py-3">{g.subject}</td>
                                        <td className="py-3">{g.term}</td>
                                        <td className="py-3">{g.score}</td>
                                        <td className="py-3">{g.max_score}</td>
                                        <td className="py-3 text-slate-500">{g.created_at}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Card>

                <Card>
                    <h3 className="font-bold mb-4">Recent Downloads</h3>
                    <div className="space-y-3">
                        {downloads.map((d, i) => (
                            <div key={`${d.file_name}-${i}`} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                                <div className="flex items-center gap-3">
                                    <FileText size={18} className="text-slate-400" />
                                    <span className="text-sm font-medium">{d.file_name}</span>
                                </div>
                                <span className="text-xs text-slate-400">{d.created_at}</span>
                            </div>
                        ))}
                    </div>
                </Card>

                {showGradeModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-lg p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-xl font-bold">Add Grade</h3>
                                <button onClick={() => setShowGradeModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><X size={24} /></button>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <label className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-1.5 block">Student</label>
                                    <select
                                        className="w-full rounded-xl border border-slate-200 bg-white/50 px-4 py-2.5 text-sm outline-none dark:border-slate-700 dark:bg-slate-800"
                                        value={newGrade.student_id}
                                        onChange={(e) => setNewGrade({ ...newGrade, student_id: e.target.value })}
                                    >
                                        <option value="">Select Student</option>
                                        {students.map((s: any) => (
                                            <option key={s.id} value={s.id}>{s.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <Input
                                    label="Subject"
                                    value={newGrade.subject}
                                    onChange={(e) => setNewGrade({ ...newGrade, subject: e.target.value })}
                                />
                                <Input
                                    label="Term"
                                    placeholder="Term 1"
                                    value={newGrade.term}
                                    onChange={(e) => setNewGrade({ ...newGrade, term: e.target.value })}
                                />
                                <div className="grid grid-cols-2 gap-4">
                                    <Input
                                        label="Score"
                                        type="number"
                                        value={newGrade.score}
                                        onChange={(e) => setNewGrade({ ...newGrade, score: e.target.value })}
                                    />
                                    <Input
                                        label="Max Score"
                                        type="number"
                                        value={newGrade.max_score}
                                        onChange={(e) => setNewGrade({ ...newGrade, max_score: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end gap-3 mt-6">
                                <Button variant="outline" onClick={() => setShowGradeModal(false)}>Cancel</Button>
                                <Button onClick={handleCreateGrade}>Save Grade</Button>
                            </div>
                        </div>
                    </div>
                )}

                {showReportModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-xl font-bold">{reportTitle} Preview</h3>
                                <button onClick={() => setShowReportModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><X size={24} /></button>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="text-left text-slate-500 border-b border-slate-100 dark:border-slate-800">
                                        <tr>
                                            {Object.keys(reportData[0] || {}).map((k) => (
                                                <th key={k} className="pb-3 font-medium">{k}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {reportData.map((row, idx) => (
                                            <tr key={idx}>
                                                {Object.keys(reportData[0] || {}).map((k) => (
                                                    <td key={k} className="py-3">{String(row[k])}</td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    if (currentView === 'notifications') {
        return (
            <div className="space-y-6 animate-in fade-in duration-500">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div>
                        <h2 className="text-2xl font-bold flex items-center gap-2"><Bell size={22} /> Notifications</h2>
                        <p className="text-slate-500">Queue messages, manage templates, and trigger fee reminders.</p>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={handleRunNotificationDispatchNow}>Run Delivery Now</Button>
                        <Button icon={Send} onClick={handleTriggerFeeDueNotifications}>Queue Fee Due Reminders</Button>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card>
                        <h3 className="font-bold mb-4">Queue Notification</h3>
                        <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-1.5 block">Recipient Type</label>
                                    <select
                                        className="w-full rounded-xl border border-slate-200 bg-white/50 px-4 py-2.5 text-sm outline-none dark:border-slate-700 dark:bg-slate-800"
                                        value={newNotification.recipient_type}
                                        onChange={(e) => setNewNotification({ ...newNotification, recipient_type: e.target.value, recipient_id: '' })}
                                    >
                                        <option value="school">Entire School</option>
                                        <option value="student">Student</option>
                                        <option value="teacher">Teacher</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-1.5 block">Channel</label>
                                    <select
                                        className="w-full rounded-xl border border-slate-200 bg-white/50 px-4 py-2.5 text-sm outline-none dark:border-slate-700 dark:bg-slate-800"
                                        value={newNotification.channel}
                                        onChange={(e) => setNewNotification({ ...newNotification, channel: e.target.value })}
                                    >
                                        <option value="in_app">In App</option>
                                        <option value="email">Email</option>
                                        <option value="sms">SMS</option>
                                        <option value="whatsapp">WhatsApp</option>
                                    </select>
                                </div>
                            </div>

                            {newNotification.recipient_type === 'student' && (
                                <div>
                                    <label className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-1.5 block">Student</label>
                                    <select
                                        className="w-full rounded-xl border border-slate-200 bg-white/50 px-4 py-2.5 text-sm outline-none dark:border-slate-700 dark:bg-slate-800"
                                        value={newNotification.recipient_id}
                                        onChange={(e) => setNewNotification({ ...newNotification, recipient_id: e.target.value })}
                                    >
                                        <option value="">Select student</option>
                                        {students.map((s) => (
                                            <option key={`notify-student-${s.id}`} value={s.id}>{s.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {newNotification.recipient_type === 'teacher' && (
                                <div>
                                    <label className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-1.5 block">Teacher</label>
                                    <select
                                        className="w-full rounded-xl border border-slate-200 bg-white/50 px-4 py-2.5 text-sm outline-none dark:border-slate-700 dark:bg-slate-800"
                                        value={newNotification.recipient_id}
                                        onChange={(e) => setNewNotification({ ...newNotification, recipient_id: e.target.value })}
                                    >
                                        <option value="">Select teacher</option>
                                        {teachers.map((t: any) => (
                                            <option key={`notify-teacher-${t.id}`} value={t.id}>{t.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <Input
                                label="Title (Optional)"
                                value={newNotification.title}
                                onChange={(e) => setNewNotification({ ...newNotification, title: e.target.value })}
                            />

                            <div>
                                <label className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-1.5 block">Message</label>
                                <textarea
                                    className="w-full rounded-xl border border-slate-200 bg-white/50 px-4 py-2.5 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 min-h-[110px]"
                                    value={newNotification.message}
                                    onChange={(e) => setNewNotification({ ...newNotification, message: e.target.value })}
                                />
                            </div>

                            <Input
                                label="Schedule At (Optional)"
                                type="datetime-local"
                                value={newNotification.scheduled_at}
                                onChange={(e) => setNewNotification({ ...newNotification, scheduled_at: e.target.value })}
                            />

                            <div className="flex justify-end">
                                <Button icon={Send} onClick={handleQueueNotification}>Queue Notification</Button>
                            </div>
                        </div>
                    </Card>

                    <Card>
                        <h3 className="font-bold mb-4">Templates</h3>
                        <div className="space-y-3">
                            <Input
                                label="Template Name"
                                value={newTemplate.name}
                                onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                            />
                            <div>
                                <label className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-1.5 block">Channel</label>
                                <select
                                    className="w-full rounded-xl border border-slate-200 bg-white/50 px-4 py-2.5 text-sm outline-none dark:border-slate-700 dark:bg-slate-800"
                                    value={newTemplate.channel}
                                    onChange={(e) => setNewTemplate({ ...newTemplate, channel: e.target.value })}
                                >
                                    <option value="in_app">In App</option>
                                    <option value="email">Email</option>
                                    <option value="sms">SMS</option>
                                    <option value="whatsapp">WhatsApp</option>
                                </select>
                            </div>
                            <Input
                                label="Title Template"
                                value={newTemplate.title_template}
                                onChange={(e) => setNewTemplate({ ...newTemplate, title_template: e.target.value })}
                            />
                            <div>
                                <label className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-1.5 block">Message Template</label>
                                <textarea
                                    className="w-full rounded-xl border border-slate-200 bg-white/50 px-4 py-2.5 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 min-h-[110px]"
                                    value={newTemplate.message_template}
                                    onChange={(e) => setNewTemplate({ ...newTemplate, message_template: e.target.value })}
                                />
                            </div>
                            <div className="flex justify-end">
                                <Button onClick={handleCreateNotificationTemplate}>Save Template</Button>
                            </div>

                            <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                                <h4 className="font-semibold mb-3">Saved Templates</h4>
                                <div className="space-y-2 max-h-[240px] overflow-y-auto">
                                    {notificationTemplates.map((tpl) => (
                                        <div key={`tpl-${tpl.id}`} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                                            <div className="flex items-center justify-between gap-2">
                                                <p className="font-medium">{tpl.name}</p>
                                                <Badge variant="outline">{tpl.channel}</Badge>
                                            </div>
                                            <p className="text-xs text-slate-500 mt-1">{tpl.title_template || 'No title template'}</p>
                                        </div>
                                    ))}
                                    {notificationTemplates.length === 0 && (
                                        <p className="text-sm text-slate-500">No templates yet.</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </Card>
                </div>

                <Card>
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
                        <h3 className="font-bold">Notification Queue</h3>
                        <div className="flex gap-2">
                            <select
                                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none dark:border-slate-700 dark:bg-slate-800"
                                value={notificationStatusFilter}
                                onChange={(e) => setNotificationStatusFilter(e.target.value)}
                            >
                                <option value="all">All Status</option>
                                <option value="queued">Queued</option>
                                <option value="sent">Sent</option>
                                <option value="failed">Failed</option>
                                <option value="cancelled">Cancelled</option>
                                <option value="read">Read</option>
                            </select>
                            <select
                                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none dark:border-slate-700 dark:bg-slate-800"
                                value={notificationChannelFilter}
                                onChange={(e) => setNotificationChannelFilter(e.target.value)}
                            >
                                <option value="all">All Channels</option>
                                <option value="in_app">In App</option>
                                <option value="email">Email</option>
                                <option value="sms">SMS</option>
                                <option value="whatsapp">WhatsApp</option>
                            </select>
                            <Button variant="outline" onClick={fetchNotifications}>Refresh</Button>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-slate-500 border-b border-slate-100 dark:border-slate-800">
                                    <th className="pb-3 font-medium">Title</th>
                                    <th className="pb-3 font-medium">Recipient</th>
                                    <th className="pb-3 font-medium">Channel</th>
                                    <th className="pb-3 font-medium">Status</th>
                                    <th className="pb-3 font-medium">Attempts</th>
                                    <th className="pb-3 font-medium">Next Retry</th>
                                    <th className="pb-3 font-medium">Created</th>
                                    <th className="pb-3 font-medium text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {notifications.map((n: any) => (
                                    <tr key={`notif-${n.id}`}>
                                        <td className="py-3">
                                            <p className="font-medium">{n.title || 'Untitled'}</p>
                                            <p className="text-xs text-slate-500 line-clamp-2">{n.message}</p>
                                        </td>
                                        <td className="py-3">{n.recipient_type}{n.recipient_id ? `#${n.recipient_id}` : ''}</td>
                                        <td className="py-3 uppercase text-xs">{n.channel}</td>
                                        <td className="py-3">
                                            <Badge
                                                variant={
                                                    n.status === 'sent' || n.status === 'read'
                                                        ? 'success'
                                                        : n.status === 'failed' || n.status === 'cancelled'
                                                            ? 'danger'
                                                            : 'warning'
                                                }
                                            >
                                                {n.status}
                                            </Badge>
                                        </td>
                                        <td className="py-3">{n.attempts ?? 0}</td>
                                        <td className="py-3 text-slate-500">{n.next_retry_at || '-'}</td>
                                        <td className="py-3 text-slate-500">{n.created_at}</td>
                                        <td className="py-3 text-right">
                                            <select
                                                className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-xs"
                                                value={n.status}
                                                onChange={(e) => handleUpdateNotificationStatus(n.id, e.target.value)}
                                            >
                                                <option value="queued">queued</option>
                                                <option value="sent">sent</option>
                                                <option value="read">read</option>
                                                <option value="failed">failed</option>
                                                <option value="cancelled">cancelled</option>
                                            </select>
                                        </td>
                                    </tr>
                                ))}
                                {notifications.length === 0 && (
                                    <tr>
                                        <td colSpan={8} className="py-4 text-slate-500 text-center">No notifications found.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </Card>
            </div>
        );
    }

    if (currentView === 'announcements') {
        return (
            <div className="space-y-6 animate-in fade-in duration-500">
                <div className="flex justify-between items-center">
                    <h2 className="text-2xl font-bold">Announcements</h2>
                    <Button icon={Plus} onClick={() => setShowAnnouncementModal(true)}>New Announcement</Button>
                </div>

                <div className="grid gap-6">
                    {announcements.map((ann) => (
                        <Card key={ann.id} className="flex flex-col md:flex-row gap-6">
                            <div className={`w-full md:w-48 shrink-0 rounded-xl flex flex-col items-center justify-center p-4 ${ann.type === 'alert' ? 'bg-red-50 text-red-600' : ann.type === 'success' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'
                                }`}>
                                <Calendar size={24} className="mb-2" />
                                <span className="font-bold">{ann.date || ann.created_at}</span>
                                <span className="text-xs uppercase tracking-wider mt-1">{ann.type}</span>
                            </div>
                            <div className="flex-1">
                                <div className="flex justify-between items-start mb-2">
                                    <h3 className="text-xl font-bold">{ann.title}</h3>
                                    <div className="flex gap-2">
                                        <button className="p-2 hover:bg-slate-100 rounded-lg text-slate-500"><MoreHorizontal size={18} /></button>
                                    </div>
                                </div>
                                <p className="text-slate-600 dark:text-slate-300 leading-relaxed mb-4">{ann.message}</p>
                                <div className="flex items-center gap-4 text-sm text-slate-500">
                                    <span className="flex items-center gap-1"><Users size={14} /> All Students</span>
                                    <span className="flex items-center gap-1"><CheckCircle size={14} /> Published</span>
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>

                {showAnnouncementModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-lg p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-xl font-bold">New Announcement</h3>
                                <button onClick={() => setShowAnnouncementModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><X size={24} /></button>
                            </div>
                            <div className="space-y-4">
                                <Input
                                    label="Title"
                                    value={newAnnouncement.title}
                                    onChange={(e) => setNewAnnouncement({ ...newAnnouncement, title: e.target.value })}
                                />
                                <div>
                                    <label className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-1.5 block">Type</label>
                                    <select
                                        className="w-full rounded-xl border border-slate-200 bg-white/50 px-4 py-2.5 text-sm outline-none dark:border-slate-700 dark:bg-slate-800"
                                        value={newAnnouncement.type}
                                        onChange={(e) => setNewAnnouncement({ ...newAnnouncement, type: e.target.value })}
                                    >
                                        <option value="info">Info</option>
                                        <option value="alert">Alert</option>
                                        <option value="success">Success</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-1.5 block">Message</label>
                                    <textarea
                                        className="w-full rounded-xl border border-slate-200 bg-white/50 px-4 py-2.5 text-sm outline-none dark:border-slate-700 dark:bg-slate-800"
                                        rows={4}
                                        value={newAnnouncement.message}
                                        onChange={(e) => setNewAnnouncement({ ...newAnnouncement, message: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end gap-3 mt-6">
                                <Button variant="outline" onClick={() => setShowAnnouncementModal(false)}>Cancel</Button>
                                <Button onClick={() => { handleCreateAnnouncement(); setShowAnnouncementModal(false); }}>Publish</Button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // Default Dashboard View
    return (
        <div className="space-y-8 animate-in fade-in duration-500">

            {/* Header */}
            <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Principal's Dashboard</h2>
                <p className="text-slate-500">Welcome to your school administration</p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard title="Total Students" value={stats.totalStudents} icon={Users} trend="up" />
                <StatCard title="Total Teachers" value={stats.totalTeachers} icon={GraduationCap} />
                <StatCard title="Attendance Today" value={`${stats.attendanceRate}%`} icon={PieChart} trend="down" />
                <StatCard title="Pending Fees" value={`$${stats.pendingFees}`} icon={DollarSign} subtext="Needs attention" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* Attendance Chart */}
                <div className="lg:col-span-2">
                    <Card className="h-full min-h-[400px]">
                        <h3 className="text-lg font-bold mb-6">Attendance Overview (This Week)</h3>
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={attendanceData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} />
                                    <YAxis axisLine={false} tickLine={false} />
                                    <Tooltip
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                                        cursor={{ fill: '#f1f5f9' }}
                                    />
                                    <Bar dataKey="present" name="Present" fill="#6366f1" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="absent" name="Absent" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </Card>
                </div>

                {/* Quick Actions & Announcements */}
                <div className="space-y-6">
                    <Card>
                        <h3 className="text-lg font-bold mb-4">Quick Actions</h3>
                        <div className="grid grid-cols-2 gap-3">
                            <Button variant="outline" size="sm" className="h-auto py-3 flex-col gap-2" icon={Plus}>
                                <span>Add Student</span>
                            </Button>
                            <Button variant="outline" size="sm" className="h-auto py-3 flex-col gap-2" icon={GraduationCap}>
                                <span>Add Teacher</span>
                            </Button>
                            <Button variant="outline" size="sm" className="h-auto py-3 flex-col gap-2" icon={BookOpen}>
                                <span>New Class</span>
                            </Button>
                            <Button variant="outline" size="sm" className="h-auto py-3 flex-col gap-2" icon={DollarSign}>
                                <span>Create Invoice</span>
                            </Button>
                        </div>
                    </Card>

                    <Card>
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold">Announcements</h3>
                            <button className="text-indigo-600 text-sm font-medium hover:underline">View All</button>
                        </div>
                        <div className="space-y-4">
                            {announcements.map(ann => (
                                <div key={ann.id} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                                    <p className="font-semibold text-sm text-slate-800 dark:text-slate-200">{ann.title}</p>
                                    <p className="text-xs text-slate-500 mt-1 line-clamp-2">{ann.message}</p>
                                    <div className="mt-2 flex items-center justify-between">
                                        <Badge variant={ann.type === 'alert' ? 'danger' : ann.type === 'success' ? 'success' : 'default'}>{ann.type}</Badge>
                                        <span className="text-xs text-slate-400">{ann.date || ann.created_at}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Card>
                </div>

            </div>
        </div>
    );
};

export default AdminView;
