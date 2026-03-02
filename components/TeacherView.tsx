import React, { useState } from 'react';
import {
  getTeacherScheduleToday,
  getTeacherStudents,
  submitAttendanceBulk,
  getTeacherAttendanceHistory,
  getTeacherGrades,
  addTeacherGrade,
  getTeacherAssignments,
  createTeacherAssignment,
  getTeacherAssignmentSubmissions,
  gradeTeacherAssignmentSubmission,
  getClassSubjects,
  getTeacherLeaves,
  submitTeacherLeave
} from '../services/api';
import { Card, Button, Badge } from './UIComponents';
import { toast } from 'sonner';
import { Calendar, Clock, MapPin, CheckCircle, AlertCircle, Users, Save, FileText } from 'lucide-react';
import { Student, User } from '../types';

const TeacherView: React.FC<{ currentView: string; user: User }> = ({ currentView, user }) => {
  const [activeSession, setActiveSession] = useState<string | null>(null);
  const [attendanceState, setAttendanceState] = useState<Record<string, 'present' | 'absent' | 'late'>>({});
  const [attendanceRemarks, setAttendanceRemarks] = useState<Record<string, string>>({});
  const [schedule, setSchedule] = useState<any[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [grades, setGrades] = useState<any[]>([]);
  const [gradeForm, setGradeForm] = useState({ student_id: '', subject: '', term: 'Midterm', score: '', max_score: '100' });
  const [historyFrom, setHistoryFrom] = useState("");
  const [historyTo, setHistoryTo] = useState("");

  // Assignments State
  const [assignments, setAssignments] = useState<any[]>([]);
  const [classSubjects, setClassSubjects] = useState<any[]>([]);
  const [activeAssignmentId, setActiveAssignmentId] = useState<number | null>(null);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [assignmentForm, setAssignmentForm] = useState({ class_subject_id: '', title: '', description: '', due_date: '', max_score: '100' });
  const [gradingState, setGradingState] = useState<Record<number, { score: string, feedback: string }>>({});

  // Leaves State
  const [leaves, setLeaves] = useState<any[]>([]);
  const [leaveForm, setLeaveForm] = useState({ start_date: '', end_date: '', reason: '' });

  const greeting = (() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  })();

  React.useEffect(() => {
    const fetchSchedule = async () => {
      try {
        const data = await getTeacherScheduleToday();
        setSchedule(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error("Failed to load schedule:", error);
      }
    };
    fetchSchedule();
  }, []);

  React.useEffect(() => {
    const fetchStudents = async () => {
      try {
        const data = await getTeacherStudents();
        const list = Array.isArray(data) ? data : [];
        setStudents(list);
        const initial: any = {};
        const initialRemarks: Record<string, string> = {};
        list.forEach(s => {
          initial[String(s.id)] = 'present';
          initialRemarks[String(s.id)] = '';
        });
        setAttendanceState(initial);
        setAttendanceRemarks(initialRemarks);
      } catch (error) {
        console.error("Failed to load students:", error);
      }
    };
    fetchStudents();
  }, []);

  React.useEffect(() => {
    const fetchHistory = async () => {
      if (currentView !== 'history') return;
      try {
        const data = await getTeacherAttendanceHistory();
        setHistory(Array.isArray(data) ? data : []);
      } catch (err) {
        toast.error("Failed to load history");
      }
    };
    fetchHistory();
  }, [currentView]);

  React.useEffect(() => {
    const fetchGrades = async () => {
      if (currentView !== 'grades') return;
      try {
        const data = await getTeacherGrades();
        setGrades(Array.isArray(data) ? data : []);
      } catch (err) {
        toast.error("Failed to load grades");
      }
    };
    fetchGrades();
  }, [currentView]);

  React.useEffect(() => {
    const loadAssignmentsData = async () => {
      if (currentView !== 'assignments') return;
      try {
        const [assignmentsData, csData] = await Promise.all([
          getTeacherAssignments(),
          getClassSubjects()
        ]);
        setAssignments(Array.isArray(assignmentsData) ? assignmentsData : []);
        setClassSubjects(Array.isArray(csData) ? csData : []);
      } catch (err) {
        toast.error("Failed to load assignments data");
      }
    }
    loadAssignmentsData();
  }, [currentView]);

  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createTeacherAssignment(assignmentForm);
      toast.success("Assignment created successfully");
      setAssignmentForm({ class_subject_id: '', title: '', description: '', due_date: '', max_score: '100' });
      const assignmentsData = await getTeacherAssignments();
      setAssignments(Array.isArray(assignmentsData) ? assignmentsData : []);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to create assignment");
    }
  };

  const fetchSubmissions = async (assignmentId: number) => {
    try {
      setActiveAssignmentId(assignmentId);
      const data = await getTeacherAssignmentSubmissions(assignmentId);
      setSubmissions(Array.isArray(data) ? data : []);

      // Initialize grading state
      const initialGrading: any = {};
      (Array.isArray(data) ? data : []).forEach(sub => {
        if (sub.submission_id) {
          initialGrading[sub.submission_id] = { score: sub.score || '', feedback: sub.feedback || '' };
        }
      });
      setGradingState(initialGrading);
    } catch (err) {
      toast.error("Failed to load submissions");
      setActiveAssignmentId(null);
    }
  };

  const handleGradeSubmission = async (submissionId: number) => {
    const gState = gradingState[submissionId];
    if (!gState || !gState.score) {
      return toast.error("Please enter a score");
    }
    try {
      await gradeTeacherAssignmentSubmission(submissionId, { score: gState.score, feedback: gState.feedback });
      toast.success("Submission graded successfully");
      // Refresh submissions view
      if (activeAssignmentId) {
        fetchSubmissions(activeAssignmentId);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to grade submission");
    }
  };

  React.useEffect(() => {
    const fetchLeaves = async () => {
      if (currentView !== 'leaves') return;
      try {
        const data = await getTeacherLeaves();
        setLeaves(Array.isArray(data) ? data : []);
      } catch (err) {
        toast.error("Failed to load leaves");
      }
    };
    fetchLeaves();
  }, [currentView]);

  const handleSubmitLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await submitTeacherLeave(leaveForm);
      toast.success("Leave request submitted successfully");
      setLeaveForm({ start_date: '', end_date: '', reason: '' });
      const data = await getTeacherLeaves();
      setLeaves(Array.isArray(data) ? data : []);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to submit leave request");
    }
  };

  const handleStatusChange = (studentId: string | number, status: 'present' | 'absent' | 'late') => {
    const key = String(studentId);
    setAttendanceState(prev => ({ ...prev, [key]: status }));
  };

  const handleRemarkChange = (studentId: string | number, value: string) => {
    const key = String(studentId);
    setAttendanceRemarks(prev => ({ ...prev, [key]: value }));
  };

  const markAllPresent = () => {
    const allPresent: any = {};
    students.forEach(s => { allPresent[String(s.id)] = 'present'; });
    setAttendanceState(allPresent);
  };

  const handleSubmitAttendance = async () => {
    if (!students.length) {
      toast.error("No students found for attendance");
      return;
    }

    const activeClassSubjectId = activeSession && /^\d+$/.test(activeSession)
      ? Number(activeSession)
      : null;
    const scheduleClassSubjectId = schedule[0]?.id ? Number(schedule[0].id) : null;
    const classSubjectId = (activeClassSubjectId && activeClassSubjectId > 0)
      ? activeClassSubjectId
      : (scheduleClassSubjectId && scheduleClassSubjectId > 0 ? scheduleClassSubjectId : null);

    try {
      const today = new Date().toISOString().split('T')[0];
      const records = students.map((s) => ({
        student_id: s.id,
        status: attendanceState[String(s.id)] || 'present',
        class_subject_id: classSubjectId,
        remarks: attendanceRemarks[String(s.id)] || null
      }));
      await submitAttendanceBulk({ date: today, records });
      toast.success("Attendance submitted");
    } catch (error: any) {
      console.error("Failed to submit attendance:", error);
      toast.error(error?.response?.data?.message || "Failed to submit attendance");
    }
  };

  const handleAddGrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gradeForm.student_id || !gradeForm.subject || !gradeForm.term || !gradeForm.score) {
      return toast.error("Please fill all required fields");
    }

    try {
      await addTeacherGrade(gradeForm);
      toast.success("Grade added successfully");
      setGradeForm({ student_id: '', subject: '', term: 'Midterm', score: '', max_score: '100' });
      const data = await getTeacherGrades();
      setGrades(Array.isArray(data) ? data : []);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to add grade");
    }
  };

  const activeSchedule = schedule.find((entry) => String(entry.id) === String(activeSession)) || schedule[0];
  const currentClassLabel = activeSchedule
    ? `${activeSchedule?.grade || ''}${activeSchedule?.section ? `-${activeSchedule.section}` : ''}`
    : 'Class';

  const parseStartTime = (timeRange?: string) => {
    const start = String(timeRange || '').split('-')[0]?.trim();
    if (!start) return { label: '--:--', meridiem: '' };
    const [hourStr, minute = '00'] = start.split(':');
    const hour = Number(hourStr);
    if (!Number.isFinite(hour)) return { label: start, meridiem: '' };
    const meridiem = hour >= 12 ? 'PM' : 'AM';
    const normalizedHour = ((hour + 11) % 12) + 1;
    return { label: `${String(normalizedHour).padStart(2, '0')}:${minute}`, meridiem };
  };

  if (currentView === 'students') {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">My Students</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {students.map(student => (
            <Card key={student.id} className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold">{student.name.charAt(0)}</div>
              <div>
                <h4 className="font-bold">{student.name}</h4>
                <p className="text-sm text-slate-500">Roll: {student.roll_number}</p>
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (currentView === 'leaves') {
    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        <h2 className="text-2xl font-bold flex items-center gap-2"><Calendar size={22} /> Leave Requests</h2>

        <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-1">
            <Card>
              <h3 className="font-bold text-lg mb-4">Request Leave</h3>
              <form onSubmit={handleSubmitLeave} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Start Date</label>
                  <input
                    type="date"
                    required
                    className="w-full px-3 py-2 border rounded-xl bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700"
                    value={leaveForm.start_date}
                    onChange={(e) => setLeaveForm({ ...leaveForm, start_date: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">End Date</label>
                  <input
                    type="date"
                    required
                    className="w-full px-3 py-2 border rounded-xl bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700"
                    value={leaveForm.end_date}
                    onChange={(e) => setLeaveForm({ ...leaveForm, end_date: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Reason</label>
                  <textarea
                    required
                    rows={4}
                    className="w-full px-3 py-2 border rounded-xl bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700"
                    value={leaveForm.reason}
                    onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                  />
                </div>
                <Button type="submit" className="w-full">Submit Request</Button>
              </form>
            </Card>
          </div>

          <div className="md:col-span-2 space-y-4">
            <h3 className="font-bold text-lg">My Leave History</h3>
            {leaves.length === 0 ? (
              <Card><p className="text-slate-500 text-center py-4">No leave requests found.</p></Card>
            ) : (
              leaves.map(leave => (
                <Card key={leave.id}>
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <span className="text-sm font-medium text-slate-500">
                        {new Date(leave.start_date).toLocaleDateString()} to {new Date(leave.end_date).toLocaleDateString()}
                      </span>
                    </div>
                    <Badge variant={leave.status === 'approved' ? 'success' : leave.status === 'rejected' ? 'danger' : 'warning'}>
                      {leave.status}
                    </Badge>
                  </div>
                  <p className="text-sm mt-2">{leave.reason}</p>
                  {leave.comment && (
                    <div className="mt-3 bg-slate-50 dark:bg-slate-800 p-3 rounded-lg text-sm border border-slate-100 dark:border-slate-700">
                      <strong>Admin note:</strong> {leave.comment}
                    </div>
                  )}
                </Card>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  if (currentView === 'history') {
    return (
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h2 className="text-2xl font-bold">Attendance History</h2>
          <div className="flex gap-2">
            <input
              type="date"
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
              value={historyFrom}
              onChange={(e) => setHistoryFrom(e.target.value)}
            />
            <input
              type="date"
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
              value={historyTo}
              onChange={(e) => setHistoryTo(e.target.value)}
            />
            <Button
              onClick={async () => {
                try {
                  const data = await getTeacherAttendanceHistory(historyFrom || undefined, historyTo || undefined);
                  setHistory(Array.isArray(data) ? data : []);
                } catch (err) {
                  toast.error("Failed to load history");
                }
              }}
            >
              Apply
            </Button>
          </div>
        </div>

        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="px-6 py-3 text-left">Date</th>
                  <th className="px-6 py-3 text-left">Student</th>
                  <th className="px-6 py-3 text-left">Class</th>
                  <th className="px-6 py-3 text-left">Subject</th>
                  <th className="px-6 py-3 text-left">Remarks</th>
                  <th className="px-6 py-3 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {history.map((h: any) => (
                  <tr key={h.id}>
                    <td className="px-6 py-3">{h.date}</td>
                    <td className="px-6 py-3">{h.student_name}</td>
                    <td className="px-6 py-3">{h.grade ? `${h.grade}-${h.section}` : '-'}</td>
                    <td className="px-6 py-3">{h.subject || '-'}</td>
                    <td className="px-6 py-3">{h.remarks || '-'}</td>
                    <td className="px-6 py-3">{h.status ? String(h.status).charAt(0).toUpperCase() + String(h.status).slice(1) : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    );
  }

  if (currentView === 'grades') {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Manage Grades</h2>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Grade Entry Form */}
          <Card className="col-span-1 border-indigo-100 dark:border-indigo-900/30">
            <h3 className="font-bold text-lg mb-4">Add Student Grade</h3>
            <form onSubmit={handleAddGrade} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Select Student <span className="text-red-500">*</span></label>
                <select
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500"
                  value={gradeForm.student_id} onChange={(e) => setGradeForm({ ...gradeForm, student_id: e.target.value })}
                  required
                >
                  <option value="">-- Choose Student --</option>
                  {students.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.roll_number})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Subject <span className="text-red-500">*</span></label>
                <input
                  type="text" className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                  placeholder="e.g. Mathematics"
                  value={gradeForm.subject} onChange={(e) => setGradeForm({ ...gradeForm, subject: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Term/Exam <span className="text-red-500">*</span></label>
                <input
                  type="text" className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                  placeholder="e.g. Midterm 1"
                  value={gradeForm.term} onChange={(e) => setGradeForm({ ...gradeForm, term: e.target.value })}
                  required
                />
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Score <span className="text-red-500">*</span></label>
                  <input
                    type="number" step="0.01" className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                    value={gradeForm.score} onChange={(e) => setGradeForm({ ...gradeForm, score: e.target.value })}
                    required
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Max Score</label>
                  <input
                    type="number" step="0.01" className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                    value={gradeForm.max_score} onChange={(e) => setGradeForm({ ...gradeForm, max_score: e.target.value })}
                  />
                </div>
              </div>
              <Button type="submit" className="w-full mt-4" icon={Save}>Submit Grade</Button>
            </form>
          </Card>

          {/* Grades History List */}
          <Card className="col-span-1 md:col-span-2 p-0 overflow-hidden flex flex-col h-full">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/10">
              <h3 className="font-bold text-lg">Recent Grades Posted</h3>
            </div>
            <div className="overflow-auto flex-1 h-[400px]">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left">Student</th>
                    <th className="px-4 py-3 text-left">Subject</th>
                    <th className="px-4 py-3 text-left">Term</th>
                    <th className="px-4 py-3 text-right">Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {grades.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-slate-500">No grades posted yet.</td>
                    </tr>
                  ) : (
                    grades.map((g: any) => (
                      <tr key={g.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="px-4 py-3 font-medium">{g.student_name}</td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{g.subject}</td>
                        <td className="px-4 py-3 text-slate-500">{g.term}</td>
                        <td className="px-4 py-3 text-right">
                          <span className="inline-block px-2 py-1 rounded-md bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 font-medium">
                            {g.score} / {g.max_score}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  if (currentView === 'assignments') {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Manage Assignments</h2>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Assignment Entry Form */}
          <Card className="col-span-1 border-indigo-100 dark:border-indigo-900/30 h-fit">
            <h3 className="font-bold text-lg mb-4">Create Assignment</h3>
            <form onSubmit={handleCreateAssignment} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Select Class & Subject <span className="text-red-500">*</span></label>
                <select
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500"
                  value={assignmentForm.class_subject_id} onChange={(e) => setAssignmentForm({ ...assignmentForm, class_subject_id: e.target.value })}
                  required
                >
                  <option value="">-- Choose Class/Subject --</option>
                  {classSubjects.map(cs => (
                    <option key={cs.id} value={cs.id}>{cs.grade}-{cs.section} {cs.subject_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Title <span className="text-red-500">*</span></label>
                <input
                  type="text" className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                  placeholder="e.g. Chapter 4 Exercises"
                  value={assignmentForm.title} onChange={(e) => setAssignmentForm({ ...assignmentForm, title: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Due Date <span className="text-red-500">*</span></label>
                <input
                  type="datetime-local" className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                  value={assignmentForm.due_date} onChange={(e) => setAssignmentForm({ ...assignmentForm, due_date: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Description</label>
                <textarea
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                  rows={3}
                  value={assignmentForm.description} onChange={(e) => setAssignmentForm({ ...assignmentForm, description: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Max Score</label>
                <input
                  type="number" step="0.01" className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                  value={assignmentForm.max_score} onChange={(e) => setAssignmentForm({ ...assignmentForm, max_score: e.target.value })}
                />
              </div>

              <Button type="submit" className="w-full mt-4" icon={Save}>Post Assignment</Button>
            </form>
          </Card>

          {/* Assignments List & Submissions */}
          <div className="col-span-1 md:col-span-2 space-y-6">
            {activeAssignmentId ? (
              <Card className="p-0 overflow-hidden flex flex-col h-full border-blue-100 dark:border-blue-900/30">
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-blue-50 dark:bg-blue-900/20">
                  <h3 className="font-bold text-lg flex items-center">
                    <Button variant="ghost" className="mr-2 p-1 h-auto" onClick={() => setActiveAssignmentId(null)}>
                      ← Back
                    </Button>
                    Submissions
                  </h3>
                </div>
                <div className="overflow-auto flex-1 h-[500px]">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0">
                      <tr>
                        <th className="px-4 py-3 text-left">Student</th>
                        <th className="px-4 py-3 text-left">Status</th>
                        <th className="px-4 py-3 text-left">Content</th>
                        <th className="px-4 py-3 text-right">Grade (Max 100)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {submissions.map((sub: any) => (
                        <tr key={sub.student_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                          <td className="px-4 py-4 font-medium" style={{ verticalAlign: 'top' }}>
                            {sub.student_name}<br />
                            <span className="text-xs text-slate-500 font-normal">Roll: {sub.roll_number}</span>
                          </td>
                          <td className="px-4 py-4" style={{ verticalAlign: 'top' }}>
                            {sub.submission_id ? (
                              <Badge variant={sub.status === 'graded' ? 'success' : 'warning'}>
                                {sub.status || 'submitted'}
                              </Badge>
                            ) : (
                              <Badge variant="secondary">pending</Badge>
                            )}
                          </td>
                          <td className="px-4 py-4" style={{ verticalAlign: 'top', maxWidth: '200px' }}>
                            {sub.submission_id ? (
                              <div className="text-xs bg-slate-100 dark:bg-slate-800 p-2 rounded max-h-24 overflow-y-auto">
                                {sub.text_content ? sub.text_content : (
                                  sub.file_url ? <a href={sub.file_url} className="text-blue-500 underline whitespace-nowrap overflow-hidden text-ellipsis block" target="_blank" rel="noreferrer">{sub.file_url}</a> : 'No content'
                                )}
                              </div>
                            ) : '-'}
                          </td>
                          <td className="px-4 py-4" style={{ verticalAlign: 'top' }}>
                            {!sub.submission_id ? '-' : (
                              <div className="flex flex-col items-end gap-2">
                                <div className="flex items-center gap-2">
                                  <input
                                    type="number"
                                    className="w-16 px-2 py-1 text-right text-sm border rounded bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700"
                                    placeholder="Score"
                                    value={gradingState[sub.submission_id]?.score ?? sub.score ?? ''}
                                    onChange={(e) => setGradingState({
                                      ...gradingState,
                                      [sub.submission_id]: { ...gradingState[sub.submission_id], score: e.target.value }
                                    })}
                                  />
                                </div>
                                <textarea
                                  className="w-full text-xs p-1 border rounded bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700"
                                  placeholder="Feedback..."
                                  rows={2}
                                  value={gradingState[sub.submission_id]?.feedback ?? sub.feedback ?? ''}
                                  onChange={(e) => setGradingState({
                                    ...gradingState,
                                    [sub.submission_id]: { ...gradingState[sub.submission_id], feedback: e.target.value }
                                  })}
                                ></textarea>
                                <Button
                                  size="sm"
                                  onClick={() => handleGradeSubmission(sub.submission_id)}
                                  disabled={!gradingState[sub.submission_id]?.score}
                                >
                                  Save
                                </Button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            ) : (
              <Card className="p-0 overflow-hidden flex flex-col h-full">
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/10">
                  <h3 className="font-bold text-lg">Active Assignments</h3>
                </div>
                <div className="overflow-auto flex-1 h-[500px]">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0">
                      <tr>
                        <th className="px-4 py-3 text-left">Assignment</th>
                        <th className="px-4 py-3 text-left">Class</th>
                        <th className="px-4 py-3 text-left">Submissions</th>
                        <th className="px-4 py-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {assignments.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-4 py-8 text-center text-slate-500">No assignments created yet.</td>
                        </tr>
                      ) : (
                        assignments.map((a: any) => (
                          <tr key={a.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer" onClick={() => fetchSubmissions(a.id)}>
                            <td className="px-4 py-3 font-medium">
                              <div>{a.title}</div>
                              <div className="text-xs text-slate-500 font-normal mt-0.5">Due: {new Date(a.due_date).toLocaleDateString()}</div>
                            </td>
                            <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                              {a.grade}-{a.section} <br />
                              <span className="text-xs">{a.subject_name}</span>
                            </td>
                            <td className="px-4 py-3">
                              <span className="inline-block px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 font-medium">
                                {a.graded_count} graded / {a.total_submissions} sub.
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <Button size="sm" variant="outline">View</Button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500">

      {/* Hero Schedule Card */}
      {!activeSession ? (
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 to-violet-700 text-white p-8 shadow-xl shadow-indigo-500/20">
          <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>

          <div className="relative z-10">
            <div className="flex items-center gap-2 text-indigo-200 mb-2 font-medium">
              <Calendar size={18} />
              <span>Today, {new Date().toLocaleDateString()}</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold mb-6">{greeting}, {user.name}!</h2>

            <div className="glass-panel bg-white/10 border-white/20 rounded-2xl p-6 backdrop-blur-md">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="success" className="bg-emerald-500/20 text-emerald-100 border-emerald-500/30">Current Period</Badge>
                    <span className="text-indigo-200 text-sm font-mono">{schedule[0]?.time || '09:00 - 10:00'}</span>
                  </div>
                  <h3 className="text-2xl font-bold">
                    {schedule[0]
                      ? `${schedule[0]?.subject || 'Subject'} - Class ${schedule[0]?.grade || ''}${schedule[0]?.section ? `-${schedule[0].section}` : ''}`
                      : 'Your next class'}
                  </h3>
                  <div className="flex items-center gap-4 mt-2 text-sm text-indigo-100">
                    <span className="flex items-center gap-1"><MapPin size={14} /> {schedule[0]?.room || 'Room TBA'}</span>
                    <span className="flex items-center gap-1"><Users size={14} /> {schedule[0]?.students_count || students.length || 'Students'}</span>
                  </div>
                </div>
                <Button
                  onClick={() => setActiveSession(schedule[0] ? String(schedule[0].id) : 'current')}
                  className="bg-white text-indigo-600 hover:bg-indigo-50 shadow-xl w-full md:w-auto py-3"
                >
                  Start Class and Take Attendance
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Active Class View */
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <Button variant="ghost" size="sm" onClick={() => setActiveSession(null)} className="mb-2">&lt;- Back to Schedule</Button>
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <Clock className="text-indigo-600" /> Attendance: {currentClassLabel}
              </h2>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={markAllPresent} icon={CheckCircle}>Mark All Present</Button>
              <Button icon={Save} onClick={handleSubmitAttendance}>Submit Attendance</Button>
            </div>
          </div>

          <Card className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase">Student</th>
                    <th className="px-6 py-4 text-center text-xs font-semibold text-slate-500 uppercase">Roll No</th>
                    <th className="px-6 py-4 text-center text-xs font-semibold text-slate-500 uppercase">Status</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {students.map((student) => (
                    <tr key={student.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-300 flex items-center justify-center font-bold text-sm">
                            {student.name.charAt(0)}
                          </div>
                          <div>
                            <p className="font-medium text-slate-900 dark:text-white">{student.name}</p>
                            <p className="text-xs text-slate-500">{student.admission_no}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center font-mono text-sm text-slate-600 dark:text-slate-400">
                        {student.roll_number}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-center gap-2">
                          <button
                            onClick={() => handleStatusChange(student.id, 'present')}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${attendanceState[String(student.id)] === 'present'
                              ? 'bg-emerald-100 border-emerald-500 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                              : 'border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800'
                              }`}
                          >P</button>
                          <button
                            onClick={() => handleStatusChange(student.id, 'absent')}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${attendanceState[String(student.id)] === 'absent'
                              ? 'bg-red-100 border-red-500 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                              : 'border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800'
                              }`}
                          >A</button>
                          <button
                            onClick={() => handleStatusChange(student.id, 'late')}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${attendanceState[String(student.id)] === 'late'
                              ? 'bg-amber-100 border-amber-500 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                              : 'border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800'
                              }`}
                          >L</button>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <input
                          type="text"
                          placeholder="Note..."
                          value={attendanceRemarks[String(student.id)] || ''}
                          onChange={(e) => handleRemarkChange(student.id, e.target.value)}
                          className="w-full bg-transparent border-b border-slate-200 dark:border-slate-700 focus:border-indigo-500 outline-none text-sm py-1"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* Upcoming Schedule */}
      {!activeSession && (
        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <h3 className="font-bold text-lg mb-4">Next Classes</h3>
            <div className="space-y-4">
              {schedule.slice(1, 4).length === 0 && (
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-sm text-slate-500">
                  No more classes scheduled for today.
                </div>
              )}
              {schedule.slice(1, 4).map((entry) => {
                const time = parseStartTime(entry.time);
                return (
                  <div key={`next-${entry.id}`} className="flex items-center p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                    <div className="p-3 bg-white dark:bg-slate-700 rounded-lg shadow-sm mr-4 font-bold text-slate-700 dark:text-slate-300 text-center min-w-[70px]">
                      {time.label}
                      <br />
                      <span className="text-xs font-normal text-slate-500">{time.meridiem}</span>
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 dark:text-white">{entry.subject || 'Subject'}</h4>
                      <p className="text-sm text-slate-500">
                        Class {entry.grade}-{entry.section} {entry.room ? `- ${entry.room}` : ''}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
          <Card>
            <h3 className="font-bold text-lg mb-4">Notice Board</h3>
            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/50 text-amber-800 dark:text-amber-200">
              <div className="flex items-start gap-3">
                <AlertCircle className="shrink-0 mt-0.5" size={18} />
                <div>
                  <h4 className="font-bold text-sm">Staff Meeting</h4>
                  <p className="text-sm mt-1 opacity-90">Monthly review meeting at 4:00 PM in the main hall.</p>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default TeacherView;
