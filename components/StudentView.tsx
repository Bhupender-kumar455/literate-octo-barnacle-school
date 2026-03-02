import React, { useEffect, useState } from "react";
import { Card, Button, StatCard, Badge } from "./UIComponents";
import {
  LayoutDashboard,
  ClipboardCheck,
  CreditCard,
  GraduationCap,
  Bell,
  Megaphone,
  Calendar,
  AlertTriangle,
  CheckCircle,
  Download,
  BookOpen,
} from "lucide-react";
import {
  getStudentPortalProfile,
  getStudentPortalAttendance,
  getStudentPortalFees,
  getStudentPortalGrades,
  getStudentPortalAnnouncements,
  getStudentPortalNotifications,
  markStudentPortalNotificationRead,
  getStudentPortalReportCard,
  downloadStudentPortalReportCardPdf,
  getStudentAssignments,
  submitStudentAssignment,
  getStudentLeaves,
  submitStudentLeave
} from "../services/api";
import { User, StudentReportCard } from "../types";
import { toast } from "sonner";

const StudentView: React.FC<{ currentView: string; user: User }> = ({ currentView }) => {
  const [profile, setProfile] = useState<any>(null);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [fees, setFees] = useState<any[]>([]);
  const [grades, setGrades] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [reportCard, setReportCard] = useState<StudentReportCard | null>(null);

  // Assignments State
  const [assignments, setAssignments] = useState<any[]>([]);
  const [activeAssignmentId, setActiveAssignmentId] = useState<number | null>(null);
  const [submissionForm, setSubmissionForm] = useState({ text_content: '', file_url: '' });

  // Leaves State
  const [leaves, setLeaves] = useState<any[]>([]);
  const [leaveForm, setLeaveForm] = useState({ start_date: '', end_date: '', reason: '' });

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const data = await getStudentPortalProfile();
        setProfile(data);
      } catch (err) {
        toast.error("Failed to load profile");
      }
    };
    loadProfile();
  }, []);

  useEffect(() => {
    if (currentView === "attendance" || currentView === "dashboard") {
      getStudentPortalAttendance().then((data) => setAttendance(Array.isArray(data) ? data : [])).catch(() => toast.error("Failed to load attendance"));
    }
    if (currentView === "fees" || currentView === "dashboard") {
      getStudentPortalFees().then((data) => setFees(Array.isArray(data) ? data : [])).catch(() => toast.error("Failed to load fees"));
    }
    if (currentView === "grades" || currentView === "dashboard") {
      getStudentPortalGrades().then((data) => setGrades(Array.isArray(data) ? data : [])).catch(() => toast.error("Failed to load grades"));
      getStudentPortalReportCard().then((data) => setReportCard(data)).catch(() => setReportCard(null));
    }
    if (currentView === "announcements" || currentView === "dashboard") {
      getStudentPortalAnnouncements().then((data) => setAnnouncements(Array.isArray(data) ? data : [])).catch(() => toast.error("Failed to load announcements"));
    }
    if (currentView === "notifications" || currentView === "dashboard") {
      getStudentPortalNotifications().then((data) => setNotifications(Array.isArray(data) ? data : [])).catch(() => toast.error("Failed to load notifications"));
    }
    if (currentView === "assignments" || currentView === "dashboard") {
      getStudentAssignments().then((data) => setAssignments(Array.isArray(data) ? data : [])).catch(() => toast.error("Failed to load assignments"));
    }
    if (currentView === "leaves" || currentView === "dashboard") {
      getStudentLeaves().then((data) => setLeaves(Array.isArray(data) ? data : [])).catch(() => toast.error("Failed to load leaves"));
    }
  }, [currentView]);

  const handleSubmitLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await submitStudentLeave(leaveForm);
      toast.success("Leave request submitted successfully");
      setLeaveForm({ start_date: '', end_date: '', reason: '' });
      const data = await getStudentLeaves();
      setLeaves(Array.isArray(data) ? data : []);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to submit leave request");
    }
  };

  const handleSubmitAssignment = async (assignmentId: number) => {
    if (!submissionForm.text_content && !submissionForm.file_url) {
      return toast.error("Please provide either text content or a file URL");
    }
    try {
      await submitStudentAssignment(assignmentId, submissionForm);
      toast.success("Assignment submitted successfully");
      setSubmissionForm({ text_content: '', file_url: '' });
      setActiveAssignmentId(null);
      // Reload assignments
      const data = await getStudentAssignments();
      setAssignments(Array.isArray(data) ? data : []);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to submit assignment");
    }
  };

  const presentCount = attendance.filter((a) => a.status === "present").length;
  const absentCount = attendance.filter((a) => a.status === "absent").length;
  const lateCount = attendance.filter((a) => a.status === "late").length;
  const unreadNotifications = notifications.filter((n) => n.status !== "read").length;

  const defaultDashboard = currentView === "dashboard";

  const renderStats = () => (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <StatCard title="Present" value={presentCount} icon={CheckCircle} trend="up" />
      <StatCard title="Absent" value={absentCount} icon={AlertTriangle} trend="down" />
      <StatCard title="Late" value={lateCount} icon={Calendar} />
    </div>
  );

  if (currentView === "attendance" || defaultDashboard) {
    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2"><LayoutDashboard size={22} /> {defaultDashboard ? "Student Dashboard" : "Attendance"}</h2>
            <p className="text-slate-500">Welcome back{profile ? `, ${profile.name}` : ""}.</p>
          </div>
          <Button
            icon={Download}
            onClick={async () => {
              try {
                const blob = await downloadStudentPortalReportCardPdf(undefined);
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.href = url;
                link.download = "report-card.pdf";
                link.click();
                window.URL.revokeObjectURL(url);
              } catch {
                toast.error("Download failed");
              }
            }}
          >
            Download Report Card
          </Button>
        </div>

        {renderStats()}

        {reportCard && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase text-slate-500">Overall Percentage</p>
                  <p className="text-3xl font-bold">{reportCard.summary.percentage}%</p>
                </div>
                <Badge variant="outline">{reportCard.term || "Latest Term"}</Badge>
              </div>
              <p className="text-sm text-slate-500 mt-2">Grade {reportCard.summary.grade}</p>
            </Card>
            <Card>
              <p className="text-xs uppercase text-slate-500">Subjects</p>
              <p className="text-3xl font-bold">{reportCard.summary.total_subjects}</p>
              <p className="text-sm text-slate-500 mt-2">Total subjects evaluated</p>
            </Card>
            <Card>
              <p className="text-xs uppercase text-slate-500">Result</p>
              <p className={`text-2xl font-semibold ${reportCard.summary.pass ? "text-emerald-600" : "text-amber-600"}`}>
                {reportCard.summary.pass ? "Pass" : "Needs Improvement"}
              </p>
              <p className="text-sm text-slate-500 mt-2">Overall grade band {reportCard.summary.grade}</p>
            </Card>
          </div>
        )}

        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold flex items-center gap-2"><Bell size={16} /> Notifications</h3>
            <Badge variant={unreadNotifications > 0 ? "warning" : "outline"}>
              {unreadNotifications} unread
            </Badge>
          </div>
          <div className="space-y-3">
            {notifications.slice(0, 3).map((n) => (
              <div key={n.id} className="rounded-xl border border-slate-100 dark:border-slate-800 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{n.title || "Notification"}</p>
                    <p className="text-sm text-slate-500 mt-1">{n.message}</p>
                    <p className="text-xs text-slate-400 mt-2">{n.created_at}</p>
                  </div>
                  {n.status !== "read" && (
                    <Button
                      variant="outline"
                      className="text-xs px-2 py-1 h-auto"
                      onClick={async () => {
                        try {
                          await markStudentPortalNotificationRead(n.id);
                          setNotifications((prev) => prev.map((item) => item.id === n.id ? { ...item, status: "read" } : item));
                        } catch {
                          toast.error("Failed to mark notification as read");
                        }
                      }}
                    >
                      Mark read
                    </Button>
                  )}
                </div>
              </div>
            ))}
            {notifications.length === 0 && <p className="text-sm text-slate-500">No notifications yet.</p>}
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold">Recent Attendance</h3>
            <Badge variant="outline">{profile?.class_name || "Class"}</Badge>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500">
                <tr>
                  <th className="px-4 py-2 text-left">Date</th>
                  <th className="px-4 py-2 text-left">Status</th>
                  <th className="px-4 py-2 text-left">Subject</th>
                  <th className="px-4 py-2 text-left">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {attendance.map((a) => (
                  <tr key={`${a.date}-${a.subject}`}>
                    <td className="px-4 py-2">{a.date}</td>
                    <td className="px-4 py-2"><Badge variant={a.status === "present" ? "success" : a.status === "absent" ? "danger" : "warning"}>{a.status}</Badge></td>
                    <td className="px-4 py-2">{a.subject || "-"}</td>
                    <td className="px-4 py-2 text-slate-500">{a.remarks || "-"}</td>
                  </tr>
                ))}
                {attendance.length === 0 && (
                  <tr><td className="px-4 py-3 text-slate-500" colSpan={4}>No attendance records yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    );
  }

  if (currentView === "fees") {
    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        <h2 className="text-2xl font-bold flex items-center gap-2"><CreditCard size={22} /> Fees</h2>
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500">
                <tr>
                  <th className="px-4 py-2 text-left">Invoice</th>
                  <th className="px-4 py-2 text-left">Amount</th>
                  <th className="px-4 py-2 text-left">Due Date</th>
                  <th className="px-4 py-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {fees.map((f) => (
                  <tr key={f.id}>
                    <td className="px-4 py-2">#{f.id}</td>
                    <td className="px-4 py-2">${f.amount}</td>
                    <td className="px-4 py-2">{f.due_date || "-"}</td>
                    <td className="px-4 py-2">
                      <Badge variant={f.status === "paid" ? "success" : f.status === "overdue" ? "danger" : "warning"}>
                        {f.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
                {fees.length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-3 text-slate-500">No invoices yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    );
  }

  if (currentView === "grades") {
    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold flex items-center gap-2"><GraduationCap size={22} /> Grades</h2>
          <Button
            icon={Download}
            onClick={async () => {
              try {
                const blob = await downloadStudentPortalReportCardPdf(undefined);
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.href = url;
                link.download = "report-card.pdf";
                link.click();
                window.URL.revokeObjectURL(url);
              } catch {
                toast.error("Download failed");
              }
            }}
          >
            Download Report Card
          </Button>
        </div>

        {reportCard && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <p className="text-xs uppercase text-slate-500">Overall Percentage</p>
              <p className="text-3xl font-bold">{reportCard.summary.percentage}%</p>
              <p className="text-sm text-slate-500 mt-2">Grade {reportCard.summary.grade}</p>
            </Card>
            <Card>
              <p className="text-xs uppercase text-slate-500">Subjects</p>
              <p className="text-3xl font-bold">{reportCard.summary.total_subjects}</p>
              <p className="text-sm text-slate-500 mt-2">Term {reportCard.term || "Latest"}</p>
            </Card>
            <Card>
              <p className="text-xs uppercase text-slate-500">Result</p>
              <p className={`text-2xl font-semibold ${reportCard.summary.pass ? "text-emerald-600" : "text-amber-600"}`}>
                {reportCard.summary.pass ? "Pass" : "Needs Improvement"}
              </p>
              <p className="text-sm text-slate-500 mt-2">Overall grade band {reportCard.summary.grade}</p>
            </Card>
          </div>
        )}

        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500">
                <tr>
                  <th className="px-4 py-2 text-left">Subject</th>
                  <th className="px-4 py-2 text-left">Term</th>
                  <th className="px-4 py-2 text-left">Score</th>
                  <th className="px-4 py-2 text-left">Max</th>
                  <th className="px-4 py-2 text-left">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {grades.map((g, idx) => (
                  <tr key={`${g.subject}-${idx}`}>
                    <td className="px-4 py-2">{g.subject}</td>
                    <td className="px-4 py-2">{g.term}</td>
                    <td className="px-4 py-2">{g.score}</td>
                    <td className="px-4 py-2">{g.max_score}</td>
                    <td className="px-4 py-2 text-slate-500">{g.created_at}</td>
                  </tr>
                ))}
                {grades.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-3 text-slate-500">No grades yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    );
  }

  if (currentView === "announcements") {
    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        <h2 className="text-2xl font-bold flex items-center gap-2"><Megaphone size={22} /> Announcements</h2>
        <div className="grid gap-4">
          {announcements.map((ann) => (
            <Card key={ann.id} className="flex flex-col md:flex-row gap-4">
              <div className={`w-full md:w-48 shrink-0 rounded-xl flex flex-col items-center justify-center p-4 ${ann.type === 'alert' ? 'bg-red-50 text-red-600' : ann.type === 'success' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'}`}>
                <Calendar size={20} className="mb-2" />
                <span className="font-bold">{ann.created_at}</span>
                <span className="text-xs uppercase tracking-wider mt-1">{ann.type}</span>
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-lg font-bold">{ann.title}</h3>
                  <Badge variant="outline">{ann.type}</Badge>
                </div>
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed">{ann.message}</p>
              </div>
            </Card>
          ))}
          {announcements.length === 0 && <p className="text-slate-500">No announcements yet.</p>}
        </div>
      </div>
    );
  }

  if (currentView === "notifications") {
    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold flex items-center gap-2"><Bell size={22} /> Notifications</h2>
          <Badge variant={unreadNotifications > 0 ? "warning" : "outline"}>{unreadNotifications} unread</Badge>
        </div>

        <div className="grid gap-4">
          {notifications.map((n) => (
            <Card key={n.id}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-semibold">{n.title || "Notification"}</h3>
                  <p className="text-slate-600 dark:text-slate-300 mt-1">{n.message}</p>
                  <p className="text-xs text-slate-400 mt-2">{n.created_at}</p>
                </div>
                {n.status !== "read" ? (
                  <Button
                    variant="outline"
                    onClick={async () => {
                      try {
                        await markStudentPortalNotificationRead(n.id);
                        setNotifications((prev) => prev.map((item) => item.id === n.id ? { ...item, status: "read" } : item));
                      } catch {
                        toast.error("Failed to mark notification as read");
                      }
                    }}
                  >
                    Mark read
                  </Button>
                ) : (
                  <Badge variant="success">Read</Badge>
                )}
              </div>
            </Card>
          ))}
          {notifications.length === 0 && <p className="text-slate-500">No notifications yet.</p>}
        </div>
      </div>
    );
  }

  if (currentView === "assignments") {
    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        <h2 className="text-2xl font-bold flex items-center gap-2"><BookOpen size={22} /> Assignments & Homework</h2>
        <div className="grid gap-4">
          {assignments.length === 0 ? (
            <Card>
              <p className="text-slate-500 text-center py-8">No assignments currently.</p>
            </Card>
          ) : (
            assignments.map((assignment) => {
              const overdue = new Date(assignment.due_date) < new Date() && !assignment.submission_id;
              const isSubmitting = activeAssignmentId === assignment.id;

              return (
                <Card key={assignment.id} className="border-l-4" style={{ borderLeftColor: assignment.status === 'graded' ? '#10b981' : (assignment.submission_id ? '#3b82f6' : (overdue ? '#ef4444' : '#eab308')) }}>
                  <div className="flex flex-col md:flex-row gap-6">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-bold">{assignment.title}</h3>
                          {assignment.status === 'graded' && <Badge variant="success">Graded</Badge>}
                          {assignment.submission_id && assignment.status !== 'graded' && <Badge variant="default">Submitted</Badge>}
                          {overdue && <Badge variant="danger">Missing</Badge>}
                        </div>
                        <span className="text-sm font-medium shrink-0 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full">
                          Due: {new Date(assignment.due_date).toLocaleDateString()}
                        </span>
                      </div>

                      <div className="text-sm text-slate-500 mb-3">
                        {assignment.subject_name}
                      </div>

                      {assignment.description && (
                        <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl text-sm border border-slate-100 dark:border-slate-800 mb-4 whitespace-pre-wrap">
                          {assignment.description}
                        </div>
                      )}

                      {assignment.submission_id ? (
                        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                          <h4 className="font-medium text-sm mb-2 text-slate-700 dark:text-slate-300">Your Submission</h4>
                          {assignment.text_content && (
                            <div className="bg-blue-50/50 dark:bg-blue-900/10 p-3 rounded text-sm mb-2 whitespace-pre-wrap">
                              {assignment.text_content}
                            </div>
                          )}
                          {assignment.file_url && (
                            <a href={assignment.file_url} target="_blank" rel="noreferrer" className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1">
                              View Attached File
                            </a>
                          )}

                          {assignment.status === 'graded' && (
                            <div className="mt-4 bg-emerald-50 dark:bg-emerald-900/10 p-4 rounded-xl border border-emerald-100 dark:border-emerald-800/30">
                              <div className="flex items-center justify-between mb-2">
                                <span className="font-medium text-emerald-800 dark:text-emerald-400">Feedback</span>
                                <span className="font-bold text-lg text-emerald-700 dark:text-emerald-300">
                                  Score: {assignment.score} / {assignment.max_score}
                                </span>
                              </div>
                              <p className="text-sm text-emerald-700 dark:text-emerald-400/80">{assignment.feedback || "No additional feedback."}</p>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                          {!isSubmitting ? (
                            <Button onClick={() => setActiveAssignmentId(assignment.id)} variant={overdue ? "danger" : "default"}>
                              Submit Assignment
                            </Button>
                          ) : (
                            <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                              <h4 className="font-bold text-sm mb-3">Submit Work</h4>
                              <form onSubmit={(e) => { e.preventDefault(); handleSubmitAssignment(assignment.id); }}>
                                <div className="space-y-3">
                                  <div>
                                    <label className="block text-xs font-medium text-slate-500 mb-1">Text Submission (Optional)</label>
                                    <textarea
                                      className="w-full text-sm p-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-blue-500"
                                      rows={4}
                                      placeholder="Type your answer here..."
                                      value={submissionForm.text_content}
                                      onChange={(e) => setSubmissionForm({ ...submissionForm, text_content: e.target.value })}
                                    ></textarea>
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium text-slate-500 mb-1">File URL (Optional)</label>
                                    <input
                                      type="url"
                                      className="w-full text-sm p-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-blue-500"
                                      placeholder="https://docs.google.com/..."
                                      value={submissionForm.file_url}
                                      onChange={(e) => setSubmissionForm({ ...submissionForm, file_url: e.target.value })}
                                    />
                                  </div>
                                </div>
                                <div className="flex gap-2 mt-4">
                                  <Button type="submit">Submit</Button>
                                  <Button type="button" variant="outline" onClick={() => { setActiveAssignmentId(null); setSubmissionForm({ text_content: '', file_url: '' }); }}>Cancel</Button>
                                </div>
                              </form>
                            </div>
                          )}
                        </div>
                      )}

                    </div>
                  </div>
                </Card>
              );
            })
          )}
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

  return null;
};

export default StudentView;
