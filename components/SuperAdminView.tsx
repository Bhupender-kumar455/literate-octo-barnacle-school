import React, { useState, useEffect } from "react";
import { mockSchools, getSuperAdminStats } from "../services/mockData";
import { Card, Button, StatCard, Badge, Input } from "./UIComponents";
import { School } from '../types';
import {
  Building2,
  Users,
  TrendingUp,
  Plus,
  MapPin,
  Search,
  UploadCloud,
  Shield,
  Globe,
  CreditCard,
  Save,
  Activity,
  Server,
  X,
  CheckCircle,
  Phone,
  Trash2,
  LogIn,
  AlertTriangle,
  UserCog,
  Mail
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { toast } from "sonner";
const API_BASE_URL = process.env.API_URL || "http://localhost:5000";

// --- Mock Data for Dashboard ---
const growthData = [
  { name: "Jan", schools: 2, revenue: 12000 },
  { name: "Feb", schools: 2, revenue: 12500 },
  { name: "Mar", schools: 3, revenue: 15000 },
  { name: "Apr", schools: 3, revenue: 16500 },
  { name: "May", schools: 5, revenue: 22000 },
  { name: "Jun", schools: 6, revenue: 28000 },
];

const recentActivities = [
  {
    id: 1,
    action: "New School Onboarded",
    target: "Springfield Elementary",
    time: "2 hours ago",
    icon: Building2,
    color: "text-emerald-500",
  },
  {
    id: 2,
    action: "System Update",
    target: "v2.4.0 Deployed",
    time: "5 hours ago",
    icon: Server,
    color: "text-blue-500",
  },
  {
    id: 3,
    action: "High Traffic Alert",
    target: "Server Load > 80%",
    time: "1 day ago",
    icon: Activity,
    color: "text-amber-500",
  },
  {
    id: 4,
    action: "New Subscription",
    target: "Xavier Institute (Enterprise)",
    time: "2 days ago",
    icon: CreditCard,
    color: "text-purple-500",
  },
];

const SuperAdminView: React.FC<{ currentView: string }> = ({ currentView }) => {
  const stats = getSuperAdminStats();
  const [searchTerm, setSearchTerm] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [logoUrl, setLogoUrl] = useState("");
  const [schools, setSchools] = useState([]);
  const [statusFilter, setStatusFilter] = useState("All");

  // Modal States
  const [managingSchool, setManagingSchool] = useState<School | null>(null);
  const [impersonatingSchool, setImpersonatingSchool] = useState<School | null>(null);
  const [manageTab, setManageTab] = useState<'details' | 'subscription' | 'danger'>('details');


  const filteredSchools = schools.filter((school) => {
    const matchesSearch =
      school.school_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      school.principal_name?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      statusFilter === "All" ||
      (statusFilter === "Active" && school.status === 1) ||
      (statusFilter === "Inactive" && school.status === 2) ||
      (statusFilter === "Suspended" && school.status !== 1 && school.status !== 2);

    return matchesSearch && matchesStatus;
  });

  // Settings State
  const [activeSettingsTab, setActiveSettingsTab] = useState<
    "general" | "security" | "billing"
  >("general");
  const [maintenanceMode, setMaintenanceMode] = useState(false);

  useEffect(() => {
    const fetchSchools = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/superadmin/schools/all`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        });
        const data = await res.json();
        setSchools(data);
      } catch (error) {
        console.error("Failed to fetch schools:", error);
      }
    };

    fetchSchools();
    return () => { };
  }, []);

  const handleSaveSettings = () => {
    toast.success("System configuration updated successfully");
  };


  const handleSaveSchool = () => {
    toast.success("School details updated successfully");
    setManagingSchool(null);
  };

  const handleImpersonateLogin = () => {
    toast.loading("Switching identity...");
    setTimeout(() => {
      toast.dismiss();
      toast.success(`Now logged in as ${impersonatingSchool?.principalName}`);
      setImpersonatingSchool(null);
    }, 1500);
  };

  // --- VIEW: DASHBOARD ---
  if (currentView === "dashboard") {
    return (
      <div className="space-y-8 animate-in fade-in duration-500">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            Super Admin Dashboard
          </h2>
          <p className="text-slate-500">
            Real-time overview of the SchoolSystema ecosystem.
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            title="Total Schools"
            value={stats.totalSchools}
            icon={Building2}
            trend="up"
          />
          <StatCard
            title="Total Students"
            value={stats.totalStudents}
            icon={Users}
            trend="up"
          />
          <StatCard
            title="Active Sessions"
            value={stats.activeToday}
            icon={Activity}
            subtext="Currently online"
          />
          <StatCard
            title="Monthly Revenue"
            value={stats.totalRevenue}
            icon={TrendingUp}
            trend="up"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Chart */}
          <div className="lg:col-span-2">
            <Card className="h-full min-h-[400px]">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold">Platform Growth</h3>
                <select className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm px-3 py-1">
                  <option>Last 6 Months</option>
                  <option>Year to Date</option>
                </select>
              </div>
              <div className="h-[320px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={growthData}>
                    <defs>
                      <linearGradient
                        id="colorRevenue"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor="#6366f1"
                          stopOpacity={0.3}
                        />
                        <stop
                          offset="95%"
                          stopColor="#6366f1"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="name" axisLine={false} tickLine={false} />
                    <YAxis axisLine={false} tickLine={false} />
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="#e2e8f0"
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: "12px",
                        border: "none",
                        boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="#6366f1"
                      fillOpacity={1}
                      fill="url(#colorRevenue)"
                      strokeWidth={3}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          {/* System Health & Activity */}
          <div className="space-y-6">
            <Card className="bg-gradient-to-br from-slate-900 to-slate-800 text-white border-none">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-emerald-500/20 rounded-lg text-emerald-400">
                  <Server size={24} />
                </div>
                <div>
                  <h3 className="font-bold">System Status</h3>
                  <p className="text-emerald-400 text-sm">
                    All Systems Operational
                  </p>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-300">CPU Usage</span>
                    <span className="font-bold">42%</span>
                  </div>
                  <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 w-[42%]"></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-300">Memory</span>
                    <span className="font-bold">68%</span>
                  </div>
                  <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                    <div className="h-full bg-purple-500 w-[68%]"></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-300">Storage</span>
                    <span className="font-bold">24%</span>
                  </div>
                  <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 w-[24%]"></div>
                  </div>
                </div>
              </div>
            </Card>

            <Card>
              <h3 className="font-bold mb-4">Recent Activity</h3>
              <div className="space-y-4">
                {recentActivities.map((activity) => (
                  <div key={activity.id} className="flex items-start gap-3">
                    <div className={`mt-1 ${activity.color}`}>
                      <activity.icon size={16} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900 dark:text-white">
                        {activity.action}
                      </p>
                      <p className="text-xs text-slate-500">
                        {activity.target}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {activity.time}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="w-full mt-4 text-indigo-600"
              >
                View Audit Log
              </Button>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // --- VIEW: SCHOOLS ---
  if (currentView === "schools") {
    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
              Tenant Management
            </h2>
            <p className="text-slate-500">
              Manage and monitor all registered schools.
            </p>
          </div>
          <Button onClick={() => setShowCreateModal(true)} icon={Plus}>
            Onboard New School
          </Button>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex items-center gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="relative flex-1">
            <Search
              className="absolute left-3 top-3 text-slate-400"
              size={18}
            />
            <input
              type="text"
              placeholder="Search schools by name, ID, or principal..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border-none bg-slate-50 dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="hidden md:flex gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm outline-none"
            >
              <option value="All">Status: All</option>
              <option value="Active">Active</option>
              <option value="Suspended">Suspended</option>
              <option value="Inactive">Inactive</option>
            </select>
            <select className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm outline-none">
              <option>Sort By: Newest</option>
              <option>Students: High to Low</option>
              <option>Revenue</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredSchools.map((school) => (
            <Card
              key={school.id}
              className="group hover:border-indigo-500/50 transition-all"
            >
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-4">
                  <img
                    src={school.logo}
                    alt={school.name}
                    className="w-16 h-16 rounded-xl object-cover bg-slate-100 shadow-sm group-hover:scale-105 transition-transform"
                  />
                  <div>
                    <h4 className="font-bold text-lg text-slate-900 dark:text-white leading-tight">
                      {school.school_name}
                    </h4>
                    <div className="flex items-center gap-1 text-xs text-slate-500 mt-1">
                      <MapPin size={12} />
                      {school.address}
                    </div>
                  </div>
                </div>
                <Badge
                  variant={
                    school.status === 1
                      ? "success"
                      : school.status === 2
                        ? "warning"
                        : "destructive"
                  }
                >
                  {school.status === 1
                    ? "Active"
                    : school.status === 2
                      ? "Inactive"
                      : "Suspended"}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700/50">
                <div>
                  <p className="text-xs text-slate-500 uppercase font-semibold">
                    Principal
                  </p>
                  <p className="text-sm font-medium truncate">
                    {school.principal_name}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 uppercase font-semibold">
                    Students
                  </p>
                  <p className="text-sm font-medium">{school.student_count}</p>
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setManagingSchool(school);
                    setManageTab('details');
                  }}
                >
                  Manage
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  className="flex-1"
                  onClick={() => setImpersonatingSchool(school)}
                >
                  Impersonate
                </Button>
              </div>
            </Card>
          ))}

          {/* Add New Card Placeholder */}
          <button
            onClick={() => setShowCreateModal(true)}
            className="rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center p-8 text-slate-400 hover:text-indigo-600 hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/10 transition-all min-h-[240px]"
          >
            <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <Plus size={24} />
            </div>
            <span className="font-semibold">Add New School</span>
          </button>
        </div>

        {/* Create Modal */}
        {/* REAL Onboard Modal — CONNECTED TO BACKEND */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-2xl p-8 shadow-2xl border border-slate-200 dark:border-slate-800 relative">
              <button
                onClick={() => setShowCreateModal(false)}
                className="absolute top-6 right-6 text-slate-400 hover:text-slate-600"
              >
                <X size={28} />
              </button>

              <div className="text-center mb-8">
                <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Building2 size={40} className="text-white" />
                </div>
                <h2 className="text-3xl font-bold">Onboard New School</h2>
                <p className="text-slate-500 mt-2">
                  Create school + principal account instantly
                </p>
              </div>

              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  const data = {
                    school_name: formData.get("school_name") as string,
                    address: formData.get("address") as string,
                    principal_name: formData.get("principal_name") as string,
                    principal_email: formData.get("principal_email") as string,
                    principal_mobile: formData.get("mobile_number") as string,
                    principal_password:
                      (formData.get("principal_password") as string) ||
                      "Welcome123",
                    logo: logoUrl,
                  };

                  try {
                    const res = await fetch(
                      `${API_BASE_URL}/api/superadmin/schools/onboard`,
                      {
                        method: "POST",
                        headers: {
                          "Content-Type": "application/json",
                          Authorization: `Bearer ${localStorage.getItem(
                            "token"
                          )}`,
                        },
                        body: JSON.stringify(data),
                      }
                    );
                    console.log("data->", data);

                    const result = await res.json();
                    if (res.ok) {
                      toast.success(`School "${data.school_name}" created!`);
                      toast.success(
                        `Principal: ${data.principal_email} | Pass: ${data.principal_password}`
                      );
                      setShowCreateModal(false);
                    } else {
                      toast.error(result.message || "Failed to create school");
                    }
                  } catch (err) {
                    toast.error("Network error — is backend running?");
                  }
                }}
                className="space-y-6"
              >
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
                            `${API_BASE_URL}/api/superadmin/schools/logo`,
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
                          src={logoUrl}
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Input
                    name="school_name"
                    label="School Name"
                    placeholder="Delhi Public School"
                    required
                  />
                  <Input
                    name="address"
                    label="Address"
                    placeholder="Sector 12, Noida"
                  />
                  <Input
                    name="principal_name"
                    label="Principal Name"
                    placeholder="Mrs. Vanita Sharma"
                    required
                  />
                  <Input
                    name="principal_email"
                    label="Principal Email"
                    type="email"
                    placeholder="principal@dpsnoida.edu.in"
                    required
                  />
                  <Input
                    name="principal_password"
                    label="Password"
                    placeholder="Welcome123 (auto-generated if empty)"
                  />
                  <Input
                    name="mobile_number"
                    label="Mobile No."
                    placeholder="+910000000000"
                  />

                </div>

                <div className="flex justify-end gap-4 pt-6">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowCreateModal(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" className="px-8">
                    Create School & Principal
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {managingSchool && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh]">

              {/* Header */}
              <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
                <div className="flex items-center gap-4">
                  <img src={managingSchool.logo} className="w-14 h-14 rounded-xl bg-white shadow-sm object-cover" alt="logo" />
                  <div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">Manage Institution</h3>
                    <p className="text-sm text-slate-500">Configure settings for {managingSchool.school_name}</p>
                  </div>
                </div>
                <button onClick={() => setManagingSchool(null)} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors">
                  <X size={20} className="text-slate-500" />
                </button>
              </div>

              {/* Content Container */}
              <div className="flex flex-1 overflow-hidden">
                {/* Sidebar Tabs */}
                <div className="w-48 bg-slate-50 dark:bg-slate-900/50 border-r border-slate-100 dark:border-slate-800 p-4 space-y-1">
                  <button
                    onClick={() => setManageTab('details')}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl text-left transition-all ${manageTab === 'details' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'}`}
                  >
                    <Building2 size={16} /> Overview
                  </button>
                  <button
                    onClick={() => setManageTab('subscription')}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl text-left transition-all ${manageTab === 'subscription' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'}`}
                  >
                    <CreditCard size={16} /> Subscription
                  </button>
                  <button
                    onClick={() => setManageTab('danger')}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl text-left transition-all ${manageTab === 'danger' ? 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'}`}
                  >
                    <Trash2 size={16} /> Danger Zone
                  </button>
                </div>

                {/* Tab Panels */}
                <div className="flex-1 p-8 overflow-y-auto">
                  {manageTab === 'details' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                      <h4 className="font-bold text-lg mb-4">School Profile</h4>
                      <div className="grid grid-cols-2 gap-6">
                        <div className="col-span-2">
                          <Input label="School Name" defaultValue={managingSchool.school_name} />
                        </div>
                        <Input label="Phone Number" defaultValue={managingSchool.phone} icon={Phone} />
                        <Input label="Address" defaultValue={managingSchool.address} icon={MapPin} />

                        <div className="col-span-2 border-t border-slate-100 dark:border-slate-800 my-2"></div>

                        <h4 className="font-bold text-lg mb-2 col-span-2">Primary Contact</h4>
                        <Input label="Principal Name" defaultValue={managingSchool.principal_name} icon={UserCog} />
                        <Input label="Principal Email" defaultValue={managingSchool.principal_email} icon={Mail} />
                      </div>
                    </div>
                  )}

                  {manageTab === 'subscription' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                      <h4 className="font-bold text-lg mb-4">Plan & Limits</h4>

                      <div className="p-4 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/50 flex justify-between items-center">
                        <div>
                          <p className="text-indigo-900 dark:text-indigo-200 font-bold">Enterprise Plan</p>
                          <p className="text-xs text-indigo-600 dark:text-indigo-400">Next billing date: Oct 24, 2025</p>
                        </div>
                        <Badge variant="success">Active</Badge>
                      </div>

                      <div className="grid grid-cols-2 gap-6">
                        <div>
                          <label className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-1.5 block">Account Status</label>
                          <select className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none dark:border-slate-700 dark:bg-slate-800">
                            <option>Active</option>
                            <option>Suspended</option>
                            <option>Grace Period</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-1.5 block">Plan Type</label>
                          <select className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none dark:border-slate-700 dark:bg-slate-800">
                            <option>Enterprise</option>
                            <option>Growth</option>
                            <option>Starter</option>
                          </select>
                        </div>
                        <Input label="Max Students" type="number" defaultValue={String(managingSchool.studentCount + 500)} />
                        <Input label="Storage Limit (GB)" type="number" defaultValue="100" />
                      </div>
                    </div>
                  )}

                  {manageTab === 'danger' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                      <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/50">
                        <h4 className="font-bold text-red-700 dark:text-red-400 flex items-center gap-2"><AlertTriangle size={18} /> Suspend School Account</h4>
                        <p className="text-sm text-red-600/80 dark:text-red-400/70 mt-1 mb-4">
                          This will immediately lock access for all students, teachers, and admins of this school.
                        </p>
                        <Button variant="danger" size="sm">Suspend Access</Button>
                      </div>

                      <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                        <h4 className="font-bold text-slate-700 dark:text-slate-300">Delete School Data</h4>
                        <p className="text-sm text-slate-500 mt-1 mb-4">
                          Permanently remove all records, including student data and financial history. This action cannot be undone.
                        </p>
                        <Button variant="outline" className="text-red-600 hover:bg-red-50 hover:border-red-200">Delete Permanently</Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="p-6 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3 bg-slate-50/50 dark:bg-slate-900/50">
                <Button variant="outline" onClick={() => setManagingSchool(null)}>Cancel</Button>
                <Button icon={Save} onClick={handleSaveSchool}>Save Changes</Button>
              </div>
            </div>
          </div>
        )}

        {/* Impersonate Warning Modal */}
        {impersonatingSchool && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md p-8 shadow-2xl border border-slate-200 dark:border-slate-800 text-center">
              <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-full flex items-center justify-center mx-auto mb-6">
                <UserCog size={32} />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Impersonate Principal?</h3>
              <p className="text-slate-500 mb-6">
                You are about to sign in as <span className="font-semibold text-slate-900 dark:text-white">{impersonatingSchool.principalName}</span> at <span className="font-semibold text-slate-900 dark:text-white">{impersonatingSchool.name}</span>.
                <br /><br />
                This action will be logged in the system audit trail. You will have full administrative access to their school.
              </p>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setImpersonatingSchool(null)}>Cancel</Button>
                <Button className="flex-1 bg-amber-500 hover:bg-amber-600 text-white border-none shadow-amber-500/20" icon={LogIn} onClick={handleImpersonateLogin}>
                  Login as Admin
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // --- VIEW: GLOBAL SETTINGS ---
  if (currentView === "settings") {
    return (
      <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            Global Configurations
          </h2>
          <p className="text-slate-500">
            Manage system-wide settings, security policies, and billing
            parameters.
          </p>
        </div>

        <div className="flex flex-col md:flex-row gap-8">
          {/* Settings Sidebar */}
          <div className="w-full md:w-64 shrink-0">
            <div className="flex flex-col gap-1">
              <button
                onClick={() => setActiveSettingsTab("general")}
                className={`flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl text-left transition-colors ${activeSettingsTab === "general"
                  ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400"
                  : "text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800"
                  }`}
              >
                <Globe size={18} /> General
              </button>
              <button
                onClick={() => setActiveSettingsTab("security")}
                className={`flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl text-left transition-colors ${activeSettingsTab === "security"
                  ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400"
                  : "text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800"
                  }`}
              >
                <Shield size={18} /> Security
              </button>
              <button
                onClick={() => setActiveSettingsTab("billing")}
                className={`flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl text-left transition-colors ${activeSettingsTab === "billing"
                  ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400"
                  : "text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800"
                  }`}
              >
                <CreditCard size={18} /> Billing & Plans
              </button>
            </div>
          </div>

          {/* Settings Content */}
          <div className="flex-1">
            <Card>
              {activeSettingsTab === "general" && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                  <div>
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                      <Globe size={20} className="text-indigo-500" /> General
                      Information
                    </h3>
                    <div className="space-y-4">
                      <Input
                        label="Platform Name"
                        defaultValue="SchoolSystema SaaS"
                      />
                      <Input
                        label="Support Email"
                        defaultValue="support@schoolsystema.com"
                        type="email"
                      />
                      <div className="grid grid-cols-2 gap-4">
                        <Input
                          label="Default Language"
                          defaultValue="English (US)"
                        />
                        <Input label="Timezone" defaultValue="UTC" />
                      </div>
                    </div>
                  </div>
                  <div className="h-px bg-slate-100 dark:bg-slate-800"></div>
                  <div>
                    <h3 className="text-lg font-bold mb-4 text-amber-600 flex items-center gap-2">
                      <Activity size={20} /> System Status
                    </h3>
                    <div className="flex items-center justify-between p-4 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-800/50">
                      <div>
                        <p className="font-medium text-slate-900 dark:text-slate-200">
                          Maintenance Mode
                        </p>
                        <p className="text-sm text-slate-500">
                          Prevent users from accessing the system.
                        </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          checked={maintenanceMode}
                          onChange={() => setMaintenanceMode(!maintenanceMode)}
                        />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-amber-300 dark:peer-focus:ring-amber-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-amber-600"></div>
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {activeSettingsTab === "security" && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <Shield size={20} className="text-indigo-500" /> Security
                    Policies
                  </h3>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Enforce 2FA for Admins</p>
                        <p className="text-sm text-slate-500">
                          Require Two-Factor Authentication for all school
                          admins.
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        className="toggle"
                        defaultChecked
                      />
                    </div>
                    <div className="h-px bg-slate-100 dark:bg-slate-800"></div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Input
                        label="Min Password Length"
                        type="number"
                        defaultValue="8"
                      />
                      <Input
                        label="Session Timeout (mins)"
                        type="number"
                        defaultValue="30"
                      />
                    </div>
                    <div className="h-px bg-slate-100 dark:bg-slate-800"></div>
                    <div>
                      <p className="font-medium mb-2">
                        Allowed IP Ranges (CIDR)
                      </p>
                      <textarea
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3 text-sm h-24"
                        placeholder="0.0.0.0/0"
                      ></textarea>
                      <p className="text-xs text-slate-500 mt-1">
                        Leave empty to allow all IPs.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {activeSettingsTab === "billing" && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <CreditCard size={20} className="text-indigo-500" /> Billing
                    Defaults
                  </h3>
                  <div className="space-y-4">
                    <Input label="Default Currency" defaultValue="USD ($)" />
                    <div className="grid grid-cols-2 gap-4">
                      <Input
                        label="Trial Period (Days)"
                        type="number"
                        defaultValue="14"
                      />
                      <Input
                        label="Grace Period (Days)"
                        type="number"
                        defaultValue="7"
                      />
                    </div>
                    <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-medium">Standard Plan Price</span>
                        <span className="font-bold text-lg">$499/mo</span>
                      </div>
                      <input
                        type="range"
                        min="100"
                        max="1000"
                        step="50"
                        className="w-full accent-indigo-600"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                <Button onClick={handleSaveSettings} icon={Save}>
                  Save Changes
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default SuperAdminView;


