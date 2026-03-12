import React, { useState } from "react";
import { UserRole } from "../types";
import { Button, Badge } from "./UIComponents";
import {
  Shield,
  User,
  GraduationCap,
  BookOpen,
  Lock,
  Mail,
  ArrowRight,
  Sun,
  Moon,
} from "lucide-react";

interface LoginProps {
  onLogin: (role: UserRole, email: string, password: string) => void;
  isDark?: boolean;
  toggleTheme?: () => void;
}

const Login: React.FC<LoginProps> = ({ onLogin, isDark, toggleTheme }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedRole && email && password) {
      onLogin(selectedRole, email, password);
    }
  };

  const selectRole = (role: UserRole) => {
    setSelectedRole(role);
  };

  return (
    <div className="min-h-screen w-full bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-400 via-slate-900 to-black flex items-center justify-center p-4">
      <div className="w-full max-w-4xl flex rounded-3xl overflow-hidden shadow-2xl bg-white dark:bg-slate-900">
        <div className="hidden md:flex w-1/2 bg-indigo-600 p-12 flex-col justify-between relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1523050854058-8df90110c9f1?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center opacity-20 mix-blend-overlay"></div>
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center text-indigo-600 font-bold text-2xl">
                S
              </div>
              <h1 className="text-2xl font-bold text-white tracking-wide">SchoolSystema</h1>
            </div>
            <p className="text-indigo-100 text-lg font-light">
              The premium all-in-one management solution for modern educational institutions.
            </p>
          </div>
          <div className="relative z-10 space-y-4">
            <div className="flex items-center gap-4 text-indigo-100">
              <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center backdrop-blur-sm">
                <Shield size={20} />
              </div>
              <div>
                <p className="font-medium text-white">Secure and Scalable</p>
                <p className="text-sm opacity-70">Enterprise grade security</p>
              </div>
            </div>
            <div className="flex items-center gap-4 text-indigo-100">
              <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center backdrop-blur-sm">
                <GraduationCap size={20} />
              </div>
              <div>
                <p className="font-medium text-white">Student Focused</p>
                <p className="text-sm opacity-70">Track progress seamlessly</p>
              </div>
            </div>
          </div>
        </div>

        <div className="w-full md:w-1/2 p-8 md:p-12 bg-white dark:bg-slate-950 flex flex-col justify-center relative">
          {toggleTheme && (
            <button
              onClick={toggleTheme}
              className="absolute right-6 top-6 p-2 rounded-full text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
              title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
              {isDark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          )}

          <div className="mb-8 text-center md:text-left">
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">Welcome back</h2>
            <p className="text-slate-500">Please choose your portal to continue</p>
          </div>

          {!selectedRole ? (
            <div className="grid gap-4">
              <button
                onClick={() => selectRole(UserRole.SUPER_ADMIN)}
                className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-indigo-500 dark:hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all flex items-center gap-4 group text-left"
              >
                <div className="p-3 rounded-full bg-purple-100 text-purple-600 dark:bg-purple-900/30 group-hover:scale-110 transition-transform">
                  <Shield size={24} />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-white">Super Admin</h3>
                  <p className="text-sm text-slate-500">System owners and management</p>
                </div>
              </button>

              <button
                onClick={() => selectRole(UserRole.ADMIN)}
                className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-blue-500 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all flex items-center gap-4 group text-left"
              >
                <div className="p-3 rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/30 group-hover:scale-110 transition-transform">
                  <User size={24} />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-white">Principal / Admin</h3>
                  <p className="text-sm text-slate-500">School administration</p>
                </div>
              </button>

              <button
                onClick={() => selectRole(UserRole.TEACHER)}
                className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-emerald-500 dark:hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all flex items-center gap-4 group text-left"
              >
                <div className="p-3 rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 group-hover:scale-110 transition-transform">
                  <GraduationCap size={24} />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-white">Teacher</h3>
                  <p className="text-sm text-slate-500">Classroom management</p>
                </div>
              </button>

              <button
                onClick={() => selectRole(UserRole.STUDENT)}
                className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-amber-500 dark:hover:border-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-all flex items-center gap-4 group text-left"
              >
                <div className="p-3 rounded-full bg-amber-100 text-amber-600 dark:bg-amber-900/30 group-hover:scale-110 transition-transform">
                  <BookOpen size={24} />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-white">Student</h3>
                  <p className="text-sm text-slate-500">Personal learning portal</p>
                </div>
              </button>
            </div>
          ) : (
            <form onSubmit={handleLogin} className="space-y-5 animate-in fade-in slide-in-from-right-8 duration-500">
              <div className="flex items-center justify-between mb-4">
                <Badge variant="outline">
                  Logging in as: <span className="capitalize font-bold">{selectedRole.replace("_", " ")}</span>
                </Badge>
                <button
                  type="button"
                  onClick={() => setSelectedRole(null)}
                  className="text-xs text-indigo-600 hover:underline"
                >
                  Change Role
                </button>
              </div>

              <div className="relative">
                <Mail className="absolute left-4 top-3 text-slate-400" size={20} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  placeholder="Email Address"
                />
              </div>

              <div className="relative">
                <Lock className="absolute left-4 top-3 text-slate-400" size={20} />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  placeholder="Password"
                />
              </div>

              <div className="flex items-center justify-between text-sm">
                <label className="flex items-center gap-2 text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  Remember me
                </label>
                <a href="#" className="text-indigo-600 font-medium hover:underline">
                  Forgot password?
                </a>
              </div>

              <Button className="w-full py-3 text-lg shadow-indigo-500/30" type="submit" disabled={!email}>
                Sign In <ArrowRight size={18} />
              </Button>
            </form>
          )}

          <p className="mt-8 text-center text-sm text-slate-400">
            Don't have an account? <a href="#" className="text-indigo-600 font-medium hover:underline">Contact Sales</a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
