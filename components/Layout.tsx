import React, { useState } from 'react';
import { User, UserRole } from '../types';
import { getNotifications, getStudentPortalNotifications, markStudentPortalNotificationRead, getTeacherPortalNotifications, markTeacherPortalNotificationRead } from '../services/api';
import {
  LayoutDashboard,
  Users,
  School,
  BookOpen,
  CalendarDays,
  Settings,
  LogOut,
  Bell,
  Search,
  Menu,
  X,
  GraduationCap,
  ClipboardCheck,
  CreditCard,
  BarChart3,
  Megaphone,
  MessageSquare,
  Sun,
  Moon,
  Calendar,
  RefreshCw
} from 'lucide-react';
import { Button, Badge } from './UIComponents';

interface LayoutProps {
  user: User;
  children: React.ReactNode;
  onLogout: () => void;
  currentView: string;
  onChangeView: (view: string) => void;
  isDark: boolean;
  toggleTheme: () => void;
}

const Layout: React.FC<LayoutProps> = ({ user, children, onLogout, currentView, onChangeView, isDark, toggleTheme }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isNotificationModalOpen, setIsNotificationModalOpen] = useState(false);
  const [notificationItems, setNotificationItems] = useState<any[]>([]);
  const [isNotificationLoading, setIsNotificationLoading] = useState(false);
  const [notificationError, setNotificationError] = useState('');
  const hiddenNotificationStorageKey = `hidden_notifications_${user.role}_${user.id}`;
  const readHiddenNotificationIds = () => {
    try {
      const raw = localStorage.getItem(hiddenNotificationStorageKey);
      if (!raw) return [] as string[];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.map((id) => String(id)) : [];
    } catch {
      return [] as string[];
    }
  };
  const [hiddenNotificationIds, setHiddenNotificationIds] = useState<string[]>(readHiddenNotificationIds);
  const canOpenNotifications = user.role === UserRole.ADMIN || user.role === UserRole.STUDENT || user.role === UserRole.TEACHER;

  const fetchBellNotifications = async () => {
    if (!canOpenNotifications) return;
    setIsNotificationLoading(true);
    setNotificationError('');
    try {
      if (user.role === UserRole.ADMIN) {
        const data = await getNotifications({ limit: 25, include_future: false });
        const normalized = Array.isArray(data) ? data : [];
        setNotificationItems(normalized.filter((item) => !hiddenNotificationIds.includes(String(item.id))));
      } else if (user.role === UserRole.TEACHER) {
        const data = await getTeacherPortalNotifications(25);
        const normalized = Array.isArray(data) ? data : [];
        setNotificationItems(normalized.filter((item) => !hiddenNotificationIds.includes(String(item.id))));
      } else {
        const data = await getStudentPortalNotifications(25);
        const normalized = Array.isArray(data) ? data : [];
        setNotificationItems(normalized.filter((item) => !hiddenNotificationIds.includes(String(item.id))));
      }
    } catch (error) {
      setNotificationError('Failed to load notifications');
      setNotificationItems([]);
    } finally {
      setIsNotificationLoading(false);
    }
  };

  const handleBellClick = async () => {
    if (!canOpenNotifications) return;
    setIsNotificationModalOpen(true);
    await fetchBellNotifications();
  };

  const handleMarkNotificationRead = async (id: number | string) => {
    try {
      if (user.role === UserRole.TEACHER) {
        await markTeacherPortalNotificationRead(id);
      } else {
        await markStudentPortalNotificationRead(id);
      }
      setNotificationItems((prev) =>
        prev.map((item) =>
          String(item.id) === String(id)
            ? { ...item, status: 'read', read_at: new Date().toISOString() }
            : item
        )
      );
    } catch (error) {
      // Keep modal stable even if marking read fails.
    }
  };

  const handleDismissNotification = (id: number | string) => {
    const idStr = String(id);
    const nextHidden = hiddenNotificationIds.includes(idStr)
      ? hiddenNotificationIds
      : [...hiddenNotificationIds, idStr];
    setHiddenNotificationIds(nextHidden);
    try {
      localStorage.setItem(hiddenNotificationStorageKey, JSON.stringify(nextHidden));
    } catch {
      // Ignore storage failures; dismissal still applies in current session state.
    }
    setNotificationItems((prev) => prev.filter((item) => String(item.id) !== idStr));
  };

  const getRoleBadge = () => {
    if (user.role === UserRole.SUPER_ADMIN) return { code: 'SA', label: 'System Admin' };
    if (user.role === UserRole.ADMIN) return { code: 'AD', label: 'School Admin' };
    if (user.role === UserRole.STUDENT) return { code: 'ST', label: 'Student' };
    return { code: 'TR', label: 'Teacher' };
  };

  const roleBadge = getRoleBadge();

  // --- Define Navigation based on Role ---
  const getNavItems = () => {
    if (user.role === UserRole.SUPER_ADMIN) {
      return [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'schools', label: 'All Schools', icon: School },
        { id: 'users', label: 'Users', icon: Users },
        { id: 'settings', label: 'Global Settings', icon: Settings },
      ];
    } else if (user.role === UserRole.ADMIN) {
      return [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'students', label: 'Students', icon: Users },
        { id: 'teachers', label: 'Teachers', icon: GraduationCap },
        { id: 'classes', label: 'Classes', icon: BookOpen },
        { id: 'attendance', label: 'Attendance', icon: ClipboardCheck },
        { id: 'fees', label: 'Fees & Invoices', icon: CreditCard },
        { id: 'leaves', label: 'Leave Approvals', icon: Calendar },
        { id: 'reports', label: 'Reports', icon: BarChart3 },
        { id: 'notifications', label: 'Notifications', icon: Bell },
        { id: 'announcements', label: 'Announcements', icon: Megaphone },
      ];
    } else if (user.role === UserRole.STUDENT) {
      return [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'attendance', label: 'Attendance', icon: ClipboardCheck },
        { id: 'fees', label: 'Fees', icon: CreditCard },
        { id: 'assignments', label: 'Assignments', icon: BookOpen },
        { id: 'grades', label: 'Grades', icon: GraduationCap },
        { id: 'leaves', label: 'Leaves', icon: Calendar },
        { id: 'notifications', label: 'Notifications', icon: Bell },
        { id: 'announcements', label: 'Announcements', icon: Megaphone },
      ];
    } else {
      // Teacher
      return [
        { id: 'dashboard', label: 'My Schedule', icon: CalendarDays },
        { id: 'attendance', label: 'Take Attendance', icon: ClipboardCheck },
        { id: 'students', label: 'My Students', icon: Users },
        { id: 'chat', label: 'Parent Chat', icon: MessageSquare },
        { id: 'assignments', label: 'Assignments', icon: BookOpen },
        { id: 'grades', label: 'Grades', icon: GraduationCap },
        { id: 'leaves', label: 'Leaves', icon: Calendar },
        { id: 'notifications', label: 'Notifications', icon: Bell },
        { id: 'history', label: 'My Attendance', icon: BarChart3 },
      ];
    }
  };

  const navItems = getNavItems();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex font-sans text-slate-900 dark:text-slate-100 transition-colors duration-300">

      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Notification Modal */}
      {isNotificationModalOpen && (
        <div
          className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-start justify-center p-4"
          onClick={() => setIsNotificationModalOpen(false)}
        >
          <div
            className="w-full max-w-2xl mt-14 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-lg">Notifications</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={fetchBellNotifications}
                  className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors"
                  title="Refresh"
                >
                  <RefreshCw size={16} />
                </button>
                <button
                  onClick={() => setIsNotificationModalOpen(false)}
                  className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="max-h-[65vh] overflow-y-auto p-4 space-y-3">
              {isNotificationLoading && (
                <p className="text-sm text-slate-500">Loading notifications...</p>
              )}
              {!isNotificationLoading && notificationError && (
                <p className="text-sm text-red-500">{notificationError}</p>
              )}
              {!isNotificationLoading && !notificationError && notificationItems.length === 0 && (
                <p className="text-sm text-slate-500">No notifications found.</p>
              )}

              {!isNotificationLoading && !notificationError && notificationItems.map((item) => (
                <div
                  key={`bell-notification-${item.id}`}
                  className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-slate-900 dark:text-slate-100 truncate">
                        {item.title || 'Notification'}
                      </p>
                      <p className="text-sm text-slate-600 dark:text-slate-300 mt-1 break-words">
                        {item.message}
                      </p>
                      <p className="text-xs text-slate-500 mt-2">
                        {item.created_at || item.sent_at || item.scheduled_at || '-'}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <Badge
                        variant={item.status === 'read' || item.status === 'sent' ? 'success' : item.status === 'failed' ? 'danger' : 'warning'}
                      >
                        {item.status || 'queued'}
                      </Badge>
                      {(user.role === UserRole.STUDENT || user.role === UserRole.TEACHER) && item.status !== 'read' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleMarkNotificationRead(item.id)}
                        >
                          Mark Read
                        </Button>
                      )}
                      {(item.status === 'read' || item.status === 'sent') && (
                        <button
                          onClick={() => handleDismissNotification(item.id)}
                          className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors"
                          title="Remove from panel"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <aside className={`
        fixed md:sticky top-0 left-0 z-50 h-screen w-72 
        bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800
        transition-all duration-300 ease-in-out
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="h-full flex flex-col">
          {/* Logo */}
          <div className="h-20 flex items-center px-8 border-b border-slate-100 dark:border-slate-800">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold mr-3 shadow-lg shadow-indigo-500/30">S</div>
            <span className="font-bold text-xl tracking-tight">SchoolSystema</span>
          </div>

          {/* User Profile Snippet */}
          <div className="p-6 pb-2">
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 flex items-center gap-3">
              <img src={user.avatar || 'https://picsum.photos/200'} alt="User" className="w-10 h-10 rounded-full object-cover border-2 border-white dark:border-slate-600 shadow-sm" />
              <div className="overflow-hidden">
                <h4 className="font-semibold text-sm truncate">{user.name}</h4>
                <p className="text-xs text-slate-500 capitalize">{user.role.replace('_', ' ')}</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentView === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onChangeView(item.id);
                    setIsMobileMenuOpen(false);
                  }}
                  className={`
                    w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all
                    ${isActive
                      ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200'
                    }
                  `}
                >
                  <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Logout */}
          <div className="p-4 border-t border-slate-200 dark:border-slate-800">
            <button onClick={onLogout} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
              <LogOut size={18} />
              Sign Out
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">

        {/* Header */}
        <header className="sticky top-0 z-30 h-20 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 md:px-8 transition-colors duration-300">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsMobileMenuOpen(true)} className="md:hidden p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 rounded-lg">
              <Menu size={24} />
            </button>
            <div className="hidden md:flex items-center gap-3 text-slate-400 bg-slate-100 dark:bg-slate-800 px-4 py-2 rounded-full w-64 lg:w-96 border border-transparent focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all">
              <Search size={16} />
              <input type="text" placeholder="Search students, classes..." className="bg-transparent border-none outline-none text-sm text-slate-900 dark:text-slate-100 w-full placeholder:text-slate-400" />
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Live Time Widget */}
            <div className="hidden lg:flex flex-col items-end mr-4">
              <span className="text-xs font-bold text-slate-900 dark:text-white tracking-widest">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              <span className="text-[10px] text-slate-500 font-medium uppercase">{new Date().toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={toggleTheme}
                className="p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 rounded-full transition-colors"
                title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
              >
                {isDark ? <Sun size={20} /> : <Moon size={20} />}
              </button>

              <button
                onClick={handleBellClick}
                className={`relative p-2 rounded-full transition-colors ${canOpenNotifications
                  ? 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
                  : 'text-slate-300 dark:text-slate-600 cursor-not-allowed'
                  }`}
                title={canOpenNotifications ? 'Open Notifications' : 'Notifications not available for this role'}
              >
                <Bell size={20} />
                <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white dark:ring-slate-900"></span>
              </button>
            </div>
            <div className="w-px h-8 bg-slate-200 dark:bg-slate-700 mx-2"></div>
            {/* School Logo context */}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-xs">
                {roleBadge.code}
              </div>
              <span className="hidden sm:block text-sm font-medium">
                {roleBadge.label}
              </span>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 p-4 md:p-8 overflow-auto">
          {children}
        </div>

      </main>
    </div>
  );
};

export default Layout;

