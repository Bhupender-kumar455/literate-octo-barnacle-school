import React, { useState } from 'react';
import { User, UserRole } from '../types';
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
  Sun,
  Moon
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

  // --- Define Navigation based on Role ---
  const getNavItems = () => {
    if (user.role === UserRole.SUPER_ADMIN) {
      return [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'schools', label: 'All Schools', icon: School },
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
        { id: 'reports', label: 'Reports', icon: BarChart3 },
        { id: 'announcements', label: 'Announcements', icon: Megaphone },
      ];
    } else {
      // Teacher
      return [
        { id: 'dashboard', label: 'My Schedule', icon: CalendarDays },
        { id: 'attendance', label: 'Take Attendance', icon: ClipboardCheck },
        { id: 'students', label: 'My Students', icon: Users },
        { id: 'history', label: 'History', icon: BarChart3 },
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

              <button className="relative p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 rounded-full transition-colors">
                <Bell size={20} />
                <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white dark:ring-slate-900"></span>
              </button>
            </div>
            <div className="w-px h-8 bg-slate-200 dark:bg-slate-700 mx-2"></div>
            {/* School Logo context */}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-xs">
                {user.role === UserRole.SUPER_ADMIN ? 'SA' : 'H'}
              </div>
              <span className="hidden sm:block text-sm font-medium">{user.role === UserRole.SUPER_ADMIN ? 'System Admin' : 'Hogwarts Academy'}</span>
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