import React, { useState } from 'react';
import { mockStudents, CURRENT_DATE } from '../services/mockData';
import { Card, Button, Badge, StatCard } from './UIComponents';
import { Calendar, Clock, MapPin, CheckCircle, XCircle, AlertCircle, Users, Save, Check } from 'lucide-react';
import { Student } from '../types';

const TeacherView: React.FC<{ currentView: string }> = ({ currentView }) => {
  const [activeSession, setActiveSession] = useState<string | null>(null);
  const [attendanceState, setAttendanceState] = useState<Record<string, 'Present' | 'Absent' | 'Late'>>({});

  // Initialize attendance state if empty
  React.useEffect(() => {
    const initial: any = {};
    mockStudents.forEach(s => initial[s.id] = 'Present');
    setAttendanceState(initial);
  }, []);

  const handleStatusChange = (studentId: string, status: 'Present' | 'Absent' | 'Late') => {
    setAttendanceState(prev => ({ ...prev, [studentId]: status }));
  };

  const markAllPresent = () => {
    const allPresent: any = {};
    mockStudents.forEach(s => allPresent[s.id] = 'Present');
    setAttendanceState(allPresent);
  };

  if (currentView === 'students') {
      return (
          <div className="space-y-6">
              <h2 className="text-2xl font-bold">My Students</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {mockStudents.map(student => (
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
      )
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
            <h2 className="text-3xl md:text-4xl font-bold mb-6">Good Morning, Minerva!</h2>
            
            <div className="glass-panel bg-white/10 border-white/20 rounded-2xl p-6 backdrop-blur-md">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="success" className="bg-emerald-500/20 text-emerald-100 border-emerald-500/30">Current Period</Badge>
                    <span className="text-indigo-200 text-sm font-mono">09:00 - 10:00 AM</span>
                  </div>
                  <h3 className="text-2xl font-bold">Transfiguration - Class 10-A</h3>
                  <div className="flex items-center gap-4 mt-2 text-sm text-indigo-100">
                    <span className="flex items-center gap-1"><MapPin size={14} /> Room 304</span>
                    <span className="flex items-center gap-1"><Users size={14} /> 32 Students</span>
                  </div>
                </div>
                <Button 
                  onClick={() => setActiveSession('10-A')} 
                  className="bg-white text-indigo-600 hover:bg-indigo-50 shadow-xl w-full md:w-auto py-3"
                >
                  Start Class & Take Attendance
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
               <Button variant="ghost" size="sm" onClick={() => setActiveSession(null)} className="mb-2">← Back to Schedule</Button>
               <h2 className="text-2xl font-bold flex items-center gap-2">
                 <Clock className="text-indigo-600" /> Attendance: Class 10-A
               </h2>
            </div>
            <div className="flex gap-2">
               <Button variant="secondary" onClick={markAllPresent} icon={CheckCircle}>Mark All Present</Button>
               <Button icon={Save}>Submit Attendance</Button>
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
                      {mockStudents.map((student) => (
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
                                  {/* Radio Group Logic */}
                                  <button 
                                    onClick={() => handleStatusChange(student.id, 'Present')}
                                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                                      attendanceState[student.id] === 'Present' 
                                        ? 'bg-emerald-100 border-emerald-500 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' 
                                        : 'border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800'
                                    }`}
                                  >P</button>
                                  <button 
                                    onClick={() => handleStatusChange(student.id, 'Absent')}
                                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                                      attendanceState[student.id] === 'Absent' 
                                        ? 'bg-red-100 border-red-500 text-red-700 dark:bg-red-900/30 dark:text-red-400' 
                                        : 'border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800'
                                    }`}
                                  >A</button>
                                  <button 
                                    onClick={() => handleStatusChange(student.id, 'Late')}
                                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                                      attendanceState[student.id] === 'Late' 
                                        ? 'bg-amber-100 border-amber-500 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' 
                                        : 'border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800'
                                    }`}
                                  >L</button>
                               </div>
                            </td>
                            <td className="px-6 py-4">
                               <input type="text" placeholder="Note..." className="w-full bg-transparent border-b border-slate-200 dark:border-slate-700 focus:border-indigo-500 outline-none text-sm py-1" />
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
                  <div className="flex items-center p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                     <div className="p-3 bg-white dark:bg-slate-700 rounded-lg shadow-sm mr-4 font-bold text-slate-700 dark:text-slate-300 text-center min-w-[60px]">
                        11:00<br/><span className="text-xs font-normal text-slate-500">AM</span>
                     </div>
                     <div>
                        <h4 className="font-bold text-slate-900 dark:text-white">Potions</h4>
                        <p className="text-sm text-slate-500">Class 9-B • Room 101</p>
                     </div>
                  </div>
                  <div className="flex items-center p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 opacity-60">
                     <div className="p-3 bg-white dark:bg-slate-700 rounded-lg shadow-sm mr-4 font-bold text-slate-700 dark:text-slate-300 text-center min-w-[60px]">
                        02:00<br/><span className="text-xs font-normal text-slate-500">PM</span>
                     </div>
                     <div>
                        <h4 className="font-bold text-slate-900 dark:text-white">Defense Against Dark Arts</h4>
                        <p className="text-sm text-slate-500">Class 12-A • Room 405</p>
                     </div>
                  </div>
               </div>
            </Card>
            <Card>
               <h3 className="font-bold text-lg mb-4">Notice Board</h3>
               <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/50 text-amber-800 dark:text-amber-200">
                  <div className="flex items-start gap-3">
                     <AlertCircle className="shrink-0 mt-0.5" size={18} />
                     <div>
                        <h4 className="font-bold text-sm">Staff Meeting</h4>
                        <p className="text-sm mt-1 opacity-90">Monthly review meeting at 4:00 PM in the Great Hall.</p>
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