import React, { useState, useEffect } from "react";
import { Toaster, toast } from "sonner";
import { User, UserRole } from "./types";
import { mockUsers } from "./services/mockData";
import Login from "./components/Login";
import Layout from "./components/Layout";
import SuperAdminView from "./components/SuperAdminView";
import AdminView from "./components/AdminView";
import TeacherView from "./components/TeacherView";
import { login } from "./services/api";

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState<string>("dashboard");
  const [loading, setLoading] = useState(true);

  // Simulate Auth Check
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      // Optional: validate token with a /me endpoint later
      // For now, just skip login screen if token exists
      // Or call a /me endpoint to get user
      setLoading(false);
    } else {
      setLoading(false);
    }
  }, []);
  // App.tsx → Replace the entire handleLogin function with this
  const handleLogin = async (
    role: UserRole,
    email: string,
    password: string
  ) => {
    setLoading(true);
    try {
      const response = await login(email, password, role.toLowerCase());

      // Save token
      localStorage.setItem("token", response.token);

      // Save user
      setUser({
        id: response.user.id,
        name: response.user.name,
        email: response.user.email,
        role: role as UserRole,
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${response.user.name}`,
        school_id: response.user.school_id,
      });

      setCurrentView("dashboard");
      toast.success(`Welcome back, ${response.user.name}! 👑`);
    } catch (err: any) {
      toast.error(
        err.response?.data?.message || "Login failed baby, try again!"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setUser(null);
    toast.message("Logged out successfully");
  };

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-4 animate-pulse">
          <div className="w-12 h-12 bg-indigo-600 rounded-xl"></div>
          <div className="h-4 w-32 bg-slate-200 dark:bg-slate-800 rounded-full"></div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <Toaster position="top-right" richColors />
        <Login onLogin={handleLogin} />
      </>
    );
  }

  return (
    <>
      <Toaster position="top-right" richColors />
      <Layout
        user={user}
        onLogout={handleLogout}
        currentView={currentView}
        onChangeView={setCurrentView}
      >
        {user.role === UserRole.SUPER_ADMIN && (
          <SuperAdminView currentView={currentView} />
        )}
        {user.role === UserRole.ADMIN && (
          <AdminView currentView={currentView} />
        )}
        {user.role === UserRole.TEACHER && (
          <TeacherView currentView={currentView} />
        )}
      </Layout>
    </>
  );
};

export default App;
