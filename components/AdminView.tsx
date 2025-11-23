import React, { useState } from 'react';
import { getAdminStats, mockStudents, mockClasses, mockAnnouncements, mockUsers } from '../services/mockData';
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
  ArrowDownRight,
  CalendarDays
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { toast } from 'sonner';
import { UserRole } from '../types';

// Mock Chart Data
const attendanceData = [
  { name: 'Mon', present: 90, absent: 10 },
  { name: 'Tue', present: 85, absent: 15 },
  { name: 'Wed', present: 95, absent: 5 },
  { name: 'Thu', present: 92, absent: 8 },
  { name: 'Fri', present: 88, absent: 12 },
];

// Mock Data for Fees
const mockInvoices = [
    { id: 'INV-2025-001', student: 'Harry Potter', amount: '$2,500', date: 'Apr 1, 2025', status: 'Paid', method: 'Bank Transfer' },
    { id: 'INV-2025-002', student: 'Ron Weasley', amount: '$2,500', date: 'Apr 2, 2025', status: 'Pending', method: '-' },
    { id: 'INV-2025-003', student: 'Hermione Granger', amount: '$2,500', date: 'Mar 28, 2025', status: 'Paid', method: 'Credit Card' },
    { id: 'INV-2025-004', student: 'Neville Longbottom', amount: '$2,500', date: 'Mar 15, 2025', status: 'Overdue', method: '-' },
    { id: 'INV-2025-005', student: 'Draco Malfoy', amount: '$5,000', date: 'Mar 10, 2025', status: 'Paid', method: 'Owl Post' },
];

// Mock Data for Reports
const reportTypes = [
    { id: 1, title: 'Academic Performance', description: 'Term-wise student marks and grading analysis.', icon: GraduationCap, color: 'text-blue-600', bg: 'bg-blue-100' },
    { id: 2, title: 'Attendance Summary', description: 'Monthly attendance logs for students and staff.', icon: CalendarDays, color: 'text-emerald-600', bg: 'bg-emerald-100' },
    { id: 3, title: 'Fee Collection', description: 'Revenue reports, pending dues and invoice history.', icon: DollarSign, color: 'text-amber-600', bg: 'bg-amber-100' },
    { id: 4, title: 'Student Behaviour', description: 'Disciplinary records and merit points log.', icon: Users, color: 'text-purple-600', bg: 'bg-purple-100' },
];

const AdminView: React.FC<{ currentView: string }> = ({ currentView }) => {
  const stats = getAdminStats();
  const [showAddStudentModal, setShowAddStudentModal] = useState(false);
  const [showBulkImportModal, setShowBulkImportModal] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
        setSelectedFile(e.target.files[0]);
    }
  };

  const handleBulkUpload = () => {
    if (!selectedFile) {
        toast.error("Please select a file first");
        return;
    }
    setIsUploading(true);
    // Simulate upload
    setTimeout(() => {
        setIsUploading(false);
        setShowBulkImportModal(false);
        setSelectedFile(null);
        toast.success(`Successfully imported 24 students from ${selectedFile.name}`);
    }, 1500);
  };

  // --- Render Views ---

  if (currentView === 'students') {
    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
           <h2 className="text-2xl font-bold">Students Management</h2>
           <div className="flex gap-3">
              <Button variant="outline" icon={UploadCloud} onClick={() => setShowBulkImportModal(true)}>Bulk Import</Button>
              <Button variant="outline" icon={FileSpreadsheet}>Export CSV</Button>
              <Button icon={Plus} onClick={() => setShowAddStudentModal(true)}>Add Student</Button>
           </div>
        </div>

        <Card className="p-0 overflow-hidden">
           {/* Filters */}
           <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex gap-4">
              <div className="relative flex-1 max-w-md">
                 <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
                 <input type="text" placeholder="Search by name or roll no..." className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
              </div>
              <select className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm">
                 <option>All Classes</option>
                 <option>Class 10-A</option>
                 <option>Class 10-B</option>
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
                    {mockStudents.map(student => (
                       <tr key={student.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                          <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">{student.name}</td>
                          <td className="px-6 py-4 text-slate-500">{student.admission_no}</td>
                          <td className="px-6 py-4"><Badge variant="outline">10-A</Badge></td>
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
                             <button className="text-slate-400 hover:text-indigo-600"><MoreHorizontal size={18} /></button>
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
                   <Input label="Full Name" placeholder="Harry Potter" />
                   <Input label="Admission No" placeholder="A-2025-001" />
                   <div className="col-span-2 grid grid-cols-2 gap-4">
                     <Input label="Date of Birth" type="date" />
                     <div>
                        <label className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-1.5 block">Gender</label>
                        <select className="w-full rounded-xl border border-slate-200 bg-white/50 px-4 py-2.5 text-sm outline-none dark:border-slate-700 dark:bg-slate-800">
                           <option>Male</option>
                           <option>Female</option>
                        </select>
                     </div>
                   </div>
                   <Input label="Guardian Name" placeholder="Parent's Name" />
                   <Input label="Guardian Phone" placeholder="+1..." />
                </div>
                <div className="flex justify-end gap-3 mt-8">
                   <Button variant="outline" onClick={() => setShowAddStudentModal(false)}>Cancel</Button>
                   <Button onClick={() => setShowAddStudentModal(false)}>Save Student</Button>
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
                        <div className="shrink-0 mt-0.5">ℹ️</div>
                        <p>Ensure your file follows the template format. <a href="#" className="underline font-semibold">Download Template</a></p>
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
      </div>
    );
  }

  if (currentView === 'teachers') {
      const teachers = mockUsers.filter(u => u.role === UserRole.TEACHER);
      return (
          <div className="space-y-6 animate-in fade-in duration-500">
              <div className="flex justify-between items-center">
                  <div>
                    <h2 className="text-2xl font-bold">Teachers Management</h2>
                    <p className="text-slate-500">Manage faculty members and assignments.</p>
                  </div>
                  <Button icon={Plus}>Add Teacher</Button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {teachers.map(teacher => (
                      <Card key={teacher.id} className="group">
                          <div className="flex items-start justify-between mb-4">
                              <img src={teacher.avatar} alt={teacher.name} className="w-16 h-16 rounded-full object-cover border-2 border-white dark:border-slate-700 shadow-sm" />
                              <Badge variant="success">Active</Badge>
                          </div>
                          <h3 className="text-lg font-bold text-slate-900 dark:text-white">{teacher.name}</h3>
                          <p className="text-sm text-slate-500 mb-4">Senior Instructor</p>
                          
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
                              <Button size="sm" variant="outline" className="flex-1">View Profile</Button>
                              <Button size="sm" variant="secondary" className="px-3"><MoreHorizontal size={16} /></Button>
                          </div>
                      </Card>
                  ))}
              </div>
          </div>
      );
  }

  if (currentView === 'classes') {
      return (
          <div className="space-y-6 animate-in fade-in duration-500">
              <div className="flex justify-between items-center">
                 <h2 className="text-2xl font-bold">Class Management</h2>
                 <Button icon={Plus}>Create Class</Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {mockClasses.map(cls => (
                      <Card key={cls.id} className="relative overflow-hidden group">
                          <div className="absolute top-0 left-0 w-2 h-full bg-indigo-500"></div>
                          <div className="flex justify-between items-start">
                              <div>
                                  <h3 className="text-2xl font-bold">Grade {cls.grade}-{cls.section}</h3>
                                  <p className="text-slate-500 text-sm">Academic Year: {cls.academic_year}</p>
                              </div>
                              <Button size="sm" variant="ghost" icon={MoreHorizontal} className="px-2"></Button>
                          </div>
                          <div className="mt-6 space-y-2">
                              <div className="flex justify-between text-sm border-b border-slate-100 dark:border-slate-800 pb-2">
                                  <span className="text-slate-500">Class Teacher</span>
                                  <span className="font-medium">Minerva McG.</span>
                              </div>
                              <div className="flex justify-between text-sm border-b border-slate-100 dark:border-slate-800 pb-2">
                                  <span className="text-slate-500">Students</span>
                                  <span className="font-medium">32</span>
                              </div>
                          </div>
                          <Button variant="outline" className="w-full mt-4 text-sm">View Timetable</Button>
                      </Card>
                  ))}
              </div>
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
                    <Button variant="outline" icon={Download}>Report</Button>
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
                                        cursor={{fill: '#f1f5f9'}}
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
                            <td className="py-3">Minerva McGonagall</td>
                            <td className="py-3 text-slate-500">09:15 AM</td>
                            <td className="py-3"><Badge variant="success">Submitted</Badge></td>
                        </tr>
                        <tr>
                            <td className="py-3 font-bold">10-B</td>
                            <td className="py-3">Severus Snape</td>
                            <td className="py-3 text-slate-500">09:20 AM</td>
                            <td className="py-3"><Badge variant="success">Submitted</Badge></td>
                        </tr>
                        <tr>
                            <td className="py-3 font-bold">9-A</td>
                            <td className="py-3">Filius Flitwick</td>
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
                    <Button icon={Plus}>Create Invoice</Button>
                  </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <StatCard title="Total Collected" value="$112,500" icon={DollarSign} trend="up" subtext="This Month" />
                  <StatCard title="Pending Dues" value="$37,500" icon={AlertTriangle} trend="down" subtext="Needs Action" />
                  <StatCard title="Scholarships" value="$12,000" icon={GraduationCap} subtext="Active grants" />
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
                              {mockInvoices.map((inv) => (
                                  <tr key={inv.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                      <td className="px-4 py-3 font-mono text-slate-600 dark:text-slate-400">{inv.id}</td>
                                      <td className="px-4 py-3 font-medium">{inv.student}</td>
                                      <td className="px-4 py-3">{inv.amount}</td>
                                      <td className="px-4 py-3 text-slate-500">{inv.date}</td>
                                      <td className="px-4 py-3 text-slate-500">{inv.method}</td>
                                      <td className="px-4 py-3">
                                          <Badge variant={inv.status === 'Paid' ? 'success' : inv.status === 'Overdue' ? 'danger' : 'warning'}>
                                              {inv.status}
                                          </Badge>
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
                              <Button size="sm" variant="outline" className="w-full">Preview</Button>
                              <Button size="sm" className="w-full" icon={Download}>Download PDF</Button>
                          </div>
                      </div>
                  ))}
              </div>
              
              <Card>
                  <h3 className="font-bold mb-4">Recent Downloads</h3>
                  <div className="space-y-3">
                      {[1, 2, 3].map((i) => (
                          <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                              <div className="flex items-center gap-3">
                                  <FileText size={18} className="text-slate-400" />
                                  <span className="text-sm font-medium">Term_1_Grade_10_Result.pdf</span>
                              </div>
                              <span className="text-xs text-slate-400">2 mins ago</span>
                          </div>
                      ))}
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
                  <Button icon={Plus}>New Announcement</Button>
              </div>

              <div className="grid gap-6">
                  {mockAnnouncements.map((ann) => (
                      <Card key={ann.id} className="flex flex-col md:flex-row gap-6">
                          <div className={`w-full md:w-48 shrink-0 rounded-xl flex flex-col items-center justify-center p-4 ${
                              ann.type === 'alert' ? 'bg-red-50 text-red-600' : ann.type === 'success' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'
                          }`}>
                              <Calendar size={24} className="mb-2" />
                              <span className="font-bold">{ann.date}</span>
                              <span className="text-xs uppercase tracking-wider mt-1">{ann.type}</span>
                          </div>
                          <div className="flex-1">
                              <div className="flex justify-between items-start mb-2">
                                  <h3 className="text-xl font-bold">{ann.title}</h3>
                                  <div className="flex gap-2">
                                      <button className="p-2 hover:bg-slate-100 rounded-lg text-slate-500"><MoreHorizontal size={18}/></button>
                                  </div>
                              </div>
                              <p className="text-slate-600 dark:text-slate-300 leading-relaxed mb-4">{ann.message}</p>
                              <div className="flex items-center gap-4 text-sm text-slate-500">
                                  <span className="flex items-center gap-1"><Users size={14}/> All Students</span>
                                  <span className="flex items-center gap-1"><CheckCircle size={14}/> Published</span>
                              </div>
                          </div>
                      </Card>
                  ))}
              </div>
          </div>
      );
  }

  // Default Dashboard View
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Principal's Dashboard</h2>
        <p className="text-slate-500">Welcome to Hogwarts Academy Administration</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Total Students" value={stats.totalStudents} icon={Users} trend="up" />
        <StatCard title="Total Teachers" value={stats.totalTeachers} icon={GraduationCap} />
        <StatCard title="Attendance Today" value={`${stats.attendanceRate}%`} icon={PieChart} trend="down" />
        <StatCard title="Pending Fees" value={stats.pendingFees} icon={DollarSign} subtext="Needs attention" />
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
                    cursor={{fill: '#f1f5f9'}}
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
                {mockAnnouncements.map(ann => (
                   <div key={ann.id} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                      <p className="font-semibold text-sm text-slate-800 dark:text-slate-200">{ann.title}</p>
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2">{ann.message}</p>
                      <div className="mt-2 flex items-center justify-between">
                         <Badge variant={ann.type === 'alert' ? 'danger' : ann.type === 'success' ? 'success' : 'default'}>{ann.type}</Badge>
                         <span className="text-xs text-slate-400">{ann.date}</span>
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