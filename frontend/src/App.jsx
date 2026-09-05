import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import CrudTable from './components/CrudTable';
import SalesPage from './components/SalesPage';
import ClientsPage from './components/ClientsPage';
import AdministrationPage from './components/AdministrationPage';
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell, LineChart, Line
} from 'recharts';
import { 
  Users, DoorOpen, ShieldAlert, LogOut, Plus, Menu, X, UserPlus,
  Package, Search, Bell, Layers, TrendingUp, AlertTriangle, CheckCircle, 
  Edit3, Check, EyeOff, Filter, Info, UserCheck, Briefcase, Calendar,
  DollarSign, Activity, Archive, Star, Clock, Zap, Box, UserCog, Eye, History,
  Mail, Phone, MapPin, Award, Target, ChevronLeft, ChevronRight,
  RefreshCw, Download, Loader2, Sun, Moon, Settings, HelpCircle,
  CreditCard, Gift, ShoppingBag, Scissors, Sparkles, Shield
} from 'lucide-react';

// ============ API CONFIGURATION ============
const API_BASE_URL = 'http://localhost:8000/api';

const DEMO_ACCOUNTS = {
  Superadmin: { username: 'demo_superadmin', password: 'DemoSuperadmin!2026' },
  Owner: { username: 'demo_owner', password: 'DemoOwner!2026' },
  'Branch Admin': { username: 'demo_branch_admin', password: 'DemoBranchAdmin!2026' },
  Cashier: { username: 'demo_cashier', password: 'DemoCashier!2026' },
  Staff: { username: 'demo_staff', password: 'DemoStaff!2026' },
};

const ROLE_CAPABILITIES = {
  Superadmin: ['dashboard', 'sales', 'clients', 'administration', 'users', 'user_manage', 'rooms', 'room_manage', 'inventory', 'inventory_manage', 'audit', 'catalog', 'catalog_manage', 'client_manage'],
  Owner: ['dashboard', 'sales', 'clients', 'users', 'rooms', 'inventory', 'audit', 'catalog'],
  'Branch Admin': ['dashboard', 'sales', 'clients', 'users', 'user_manage', 'rooms', 'room_manage', 'inventory', 'inventory_manage', 'audit', 'catalog', 'catalog_manage', 'client_manage'],
  Cashier: ['dashboard', 'sales', 'clients', 'rooms', 'room_manage', 'inventory', 'catalog', 'client_manage'],
  Staff: ['dashboard', 'clients', 'rooms', 'room_manage', 'catalog'],
};

const canAccess = (role, capability) => ROLE_CAPABILITIES[role]?.includes(capability);

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');
  if (token) {
    config.headers.Authorization = `Token ${token}`;
  }
  return config;
});

// ============ LOADING SPINNER ============
const LoadingSpinner = () => (
  <div className="flex items-center justify-center p-8">
    <Loader2 size={32} className="text-cyan-600 animate-spin" />
  </div>
);

const AccessDenied = () => (
  <div className="p-8 text-center text-slate-500">
    You do not have permission to view this page.
  </div>
);

// ============ SIDEBAR COMPONENT ============
function Sidebar({ sidebarCollapsed, setActiveTab, activeTab, currentUserRole, isDarkMode, toggleDarkMode, onLogout }) {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: <Activity size={16} /> },
    { id: 'sales', label: 'Sales & POS', icon: <CreditCard size={16} /> },
    { id: 'clients', label: 'Clients', icon: <Users size={16} /> },
    { id: 'administration', label: 'Administration', icon: <Settings size={16} /> },
    { id: 'users', label: 'User Profiling', icon: <Users size={16} /> },
    { id: 'rooms', label: 'Room Status', icon: <DoorOpen size={16} /> },
    { id: 'inventory', label: 'Inventory', icon: <Package size={16} /> },
    { id: 'audit_controls', label: 'Audit Logs', icon: <ShieldAlert size={16} /> },
  ].filter((item) => canAccess(currentUserRole, item.id === 'audit_controls' ? 'audit' : item.id));

  // ✅ TINANGGAL NA ANG PANGANAN MENU DITO
 const productMenus = [
  { path: '/vss-services', label: 'VSS Services', icon: <Scissors size={14} /> },
  { path: '/vreal-products', label: 'VREAL Products', icon: <Sparkles size={14} /> },
  { path: '/bb-products', label: 'BB Products', icon: <ShoppingBag size={14} /> },
  // ❌ TANGGALIN ANG PANGANAN MENU
].filter(() => canAccess(currentUserRole, 'catalog'));

  return (
    <aside className={`${sidebarCollapsed ? 'w-20' : 'w-64'} ${
      isDarkMode ? 'bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950' : 'bg-gradient-to-b from-slate-800 via-slate-800 to-slate-900'
    } text-slate-300 flex flex-col justify-between shadow-2xl transition-all duration-300 z-30 border-r ${
      isDarkMode ? 'border-slate-700/30' : 'border-slate-700/50'
    }`}>
      <div className="overflow-hidden">
        <div className={`p-5 border-b ${isDarkMode ? 'border-slate-700/30' : 'border-slate-700/50'} flex ${
          sidebarCollapsed ? 'justify-center' : 'justify-between'
        } items-center bg-gradient-to-r from-slate-800 to-slate-800/50`}>
          {!sidebarCollapsed ? (
            <div className="text-center w-full">
              <div className="flex items-center justify-center gap-2 mb-1">
                <div className="w-8 h-8 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-cyan-600/30">
                  <Zap size={18} className="text-white" />
                </div>
                <h1 className="text-base font-bold text-white tracking-tight">Bungad Villareal</h1>
              </div>
              <p className="text-[10px] text-cyan-400 font-semibold uppercase tracking-wider">Management Workspace</p>
            </div>
          ) : (
            <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center font-bold text-white text-sm shadow-lg shadow-cyan-600/30 mx-auto">
              BV
            </div>
          )}
        </div>

        <nav className="p-3 space-y-1.5 mt-2">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center' : 'space-x-3'} px-4 py-2.5 text-xs font-semibold uppercase tracking-wider rounded-xl transition-all duration-200 ${
                activeTab === item.id
                  ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg shadow-cyan-600/20'
                  : `${isDarkMode ? 'text-slate-400 hover:text-white hover:bg-slate-700/30' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'}`
              }`}
            >
              {item.icon}
              {!sidebarCollapsed && <span>{item.label}</span>}
            </button>
          ))}
        </nav>

        {/* Product Management Dropdown */}
        <div className="px-3 mt-4">
          <details className="group">
            <summary className={`cursor-pointer p-2.5 text-xs font-semibold uppercase tracking-wider ${
              isDarkMode ? 'text-slate-400 hover:text-white hover:bg-slate-700/30' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
            } rounded-xl transition-all duration-200 flex items-center`}>
              <Box size={16} className="mr-3" />
              {!sidebarCollapsed && <span>Product Management</span>}
              {!sidebarCollapsed && <ChevronRight size={12} className="ml-auto transition-transform group-open:rotate-90" />}
            </summary>
            <div className="ml-6 mt-1 space-y-1">
              {productMenus.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-2 p-2 text-xs ${
                    isDarkMode ? 'text-slate-400 hover:text-white hover:bg-slate-700/30' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                  } rounded-lg transition-all`}
                >
                  {item.icon} {item.label}
                </Link>
              ))}
            </div>
          </details>
        </div>
      </div>

      <div className="p-3 border-t border-slate-700/50 mt-auto space-y-2">
        {/* Dark Mode Toggle */}
        <button
          onClick={toggleDarkMode}
          className={`w-full ${
            isDarkMode ? 'bg-slate-800/50 hover:bg-slate-700/50 text-slate-400 hover:text-white' : 'bg-slate-800/50 hover:bg-slate-700/50 text-slate-400 hover:text-white'
          } font-semibold text-xs p-2.5 rounded-xl flex items-center ${sidebarCollapsed ? 'justify-center' : 'justify-start'} space-x-2 transition-all duration-200 border border-slate-700/50`}
        >
          {isDarkMode ? <Sun size={14} /> : <Moon size={14} />}
          {!sidebarCollapsed && <span>{isDarkMode ? 'Light Mode' : 'Dark Mode'}</span>}
        </button>

        {/* Logout Button */}
        <button onClick={onLogout} className={`w-full ${
          isDarkMode ? 'bg-slate-800/50 hover:bg-red-500/20 text-slate-400 hover:text-red-400' : 'bg-slate-800/50 hover:bg-red-500/20 text-slate-400 hover:text-red-400'
        } font-semibold text-xs p-2.5 rounded-xl flex items-center ${sidebarCollapsed ? 'justify-center' : 'justify-start'} space-x-2 transition-all duration-200 border border-slate-700/50 hover:border-red-500/30`}>
          <LogOut size={14} /> {!sidebarCollapsed && <span>Logout</span>}
        </button>
      </div>
    </aside>
  );
}

// ============ MAIN APP COMPONENT ============
export default function App() {
  // --- DARK MODE ---
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved ? JSON.parse(saved) : false;
  });

  useEffect(() => {
    localStorage.setItem('darkMode', JSON.stringify(isDarkMode));
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const toggleDarkMode = () => setIsDarkMode(!isDarkMode);

  // --- SYSTEM LOGIC & SESSION STATES ---
  const [isLoggedIn, setIsLoggedIn] = useState(() => Boolean(
    localStorage.getItem('authToken') && localStorage.getItem('authUser')
  ));
  const [loginForm, setLoginForm] = useState(DEMO_ACCOUNTS.Superadmin);
  const [loginError, setLoginError] = useState('');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [currentUserRole, setCurrentUserRole] = useState(() => {
    const savedUser = localStorage.getItem('authUser');
    return savedUser ? JSON.parse(savedUser).role : 'Superadmin';
  });

  useEffect(() => {
    const capability = activeTab === 'audit_controls' ? 'audit' : activeTab;
    if (activeTab !== 'dashboard' && !canAccess(currentUserRole, capability)) {
      setActiveTab('dashboard');
    }
  }, [activeTab, currentUserRole]);
  const [selectedProfileUser, setSelectedProfileUser] = useState(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // --- LIVE CLOCK ENGINE ---
  const [currentDateTime, setCurrentDateTime] = useState(new Date());
  useEffect(() => {
    const clockTimer = setInterval(() => {
      setCurrentDateTime(new Date());
    }, 1000);
    return () => clearInterval(clockTimer);
  }, []);

  const formattedDate = currentDateTime.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric'
  });
  const formattedTime = currentDateTime.toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
  });

  // --- MODALS & NOTIFICATION ALERTS ---
  const [showUserModal, setShowUserModal] = useState(false);
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [selectedRoomId, setSelectedRoomId] = useState(null);
  const [sweetAlert, setSweetAlert] = useState({ show: false, type: 'success', title: '', message: '' });

  // --- DATA FILTER CONTROLS ---
  const [userSearch, setUserSearch] = useState('');
  const [userGenderFilter, setUserGenderFilter] = useState('All');
  const [userStatusFilter, setUserStatusFilter] = useState('All');
  const [userRoleFilter, setUserRoleFilter] = useState('All');

  const [productSearch, setProductSearch] = useState('');
  const [productCategoryFilter, setProductCategoryFilter] = useState('All');
  const [productStockFilter, setProductStockFilter] = useState('All');

  const [auditSearch, setAuditSearch] = useState('');

  // --- DATA PAGINATION SYSTEM ---
  const [userPage, setUserPage] = useState(1);
  const [productPage, setProductPage] = useState(1);
  const [auditPage, setAuditPage] = useState(1);
  const entriesPerPage = 5;

  // --- INPUT FORM OBJECTS ---
  const [userForm, setUserForm] = useState({
    name: '',
    address: '',
    age: '',
    gender: 'Female',
    role: 'Cashier',
    email: '',
    phone: '',
    startDate: new Date().toISOString().split('T')[0]
  });
  const [roomForm, setRoomForm] = useState({
    staffId: '',
    customerName: '',
    serviceType: 'Pedicure & Manicure',
    minutes: '30'
  });
  const [productForm, setProductForm] = useState({
    name: '',
    category: 'Cosmetics',
    quantity: '',
    price: ''
  });

  // --- DEFAULT DATA REGISTRIES ---
  const [staffList, setStaffList] = useState([
    {
      id: 1,
      name: 'Maria Santos',
      address: 'Virac, Catanduanes',
      age: 28,
      gender: 'Female',
      role: 'Cashier',
      status: 'Active',
      assignment: 'Counter 1',
      email: 'maria.santos@bungad.com',
      phone: '+63 912 3456 789',
      startDate: '2024-01-15',
      history: ['Completed Cashier Training (Jan 2024)', 'Processed 500+ transactions', 'Employee of the Month - March 2024'],
      avatar: 'MS'
    },
    {
      id: 2,
      name: 'Jane Doe',
      address: 'San Andres, Catanduanes',
      age: 24,
      gender: 'Female',
      role: 'Staff Specialist',
      status: 'Active',
      assignment: 'Room 2',
      email: 'jane.doe@bungad.com',
      phone: '+63 923 4567 890',
      startDate: '2024-02-20',
      history: ['Specialist Certification (Feb 2024)', 'Handled 200+ client sessions', 'Received 5-star rating from 50 clients'],
      avatar: 'JD'
    },
    {
      id: 3,
      name: 'Grace Luna',
      address: 'Bato, Catanduanes',
      age: 31,
      gender: 'Female',
      role: 'Spa Therapist',
      status: 'Active',
      assignment: 'Room 7',
      email: 'grace.luna@bungad.com',
      phone: '+63 934 5678 901',
      startDate: '2023-11-10',
      history: ['Advanced Spa Therapy Workshop', 'Completed 300+ massage sessions', 'Top Rated Therapist - Q1 2024'],
      avatar: 'GL'
    },
    {
      id: 4,
      name: 'Rose Cruz',
      address: 'Baras, Catanduanes',
      age: 27,
      gender: 'Female',
      role: 'Massage Therapist',
      status: 'Deactivated',
      assignment: 'Unassigned',
      email: 'rose.cruz@bungad.com',
      phone: '+63 945 6789 012',
      startDate: '2024-03-05',
      history: ['Massage Certification (Mar 2024)', 'Handled 80+ sessions before deactivation'],
      avatar: 'RC'
    },
    {
      id: 5,
      name: 'Alex Gonzaga',
      address: 'Gigmoto, Catanduanes',
      age: 29,
      gender: 'Male',
      role: 'Admin',
      status: 'Active',
      assignment: 'Unassigned',
      email: 'alex.gonzaga@bungad.com',
      phone: '+63 956 7890 123',
      startDate: '2023-09-01',
      history: ['Admin Training Completion', 'System Management Expert', 'Staff Training Facilitator'],
      avatar: 'AG'
    },
  ]);

  const [inventoryList, setInventoryList] = useState([
    { id: 1, name: 'VReal Rejuvenating Set Classic', category: 'Cosmetics', quantity: 2, price: 350, sku: 'VR-001' },
    { id: 2, name: 'VReal Premium Sunshield SPF50', category: 'Cosmetics', quantity: 15, price: 220, sku: 'VR-002' },
    { id: 3, name: 'VReal Deep Cleansing Toner', category: 'Cosmetics', quantity: 3, price: 180, sku: 'VR-003' },
    { id: 4, name: 'Essential Lavender Massage Oil', category: 'Supplies', quantity: 25, price: 450, sku: 'SP-001' },
    { id: 5, name: 'Sterilized Nail Toolkit Pro', category: 'Equipment', quantity: 15, price: 1200, sku: 'EQ-001' },
  ]);

  const [auditLogs, setAuditLogs] = useState([
    { id: 1, time: '2026-05-27 02:12', type: 'VOID', target: 'VReal Rejuvenating Set', value: 350, agent: 'superadmin_vreal' },
    { id: 2, time: '2026-05-26 18:44', type: 'CANCEL', target: 'Pedicure Service - Walk-in', value: 250, agent: 'Cashier (Maria)' },
    { id: 3, time: '2026-05-26 14:10', type: 'RESTOCK', target: 'Supply - Lavender Oil', value: 4500, agent: 'superadmin_vreal' },
  ]);

  const [roomsState, setRoomsState] = useState([
    ...Array.from({ length: 5 }, (_, i) => ({
      id: i + 1,
      type: 'Pedicure & Manicure',
      customer: i === 0 ? 'John Smith' : '',
      service: i === 0 ? 'Pedicure & Manicure' : '',
      timeLeft: i === 0 ? 18 : 0,
      startTime: i === 0 ? new Date().toISOString() : null,
    })),
    ...Array.from({ length: 5 }, (_, i) => ({
      id: i + 6,
      type: 'Foot Spa',
      customer: '',
      service: '',
      timeLeft: 0,
      startTime: null,
    })),
    ...Array.from({ length: 5 }, (_, i) => ({
      id: i + 11,
      type: 'Massage',
      customer: '',
      service: '',
      timeLeft: 0,
      startTime: null,
    })),
  ]);

  const roomZones = [
    { title: "Pedicure & Manicure Section", min: 1, max: 5, icon: "💅" },
    { title: "Foot Spa Section", min: 6, max: 10, icon: "🦶" },
    { title: "Massage Rooms Section", min: 11, max: 15, icon: "💆" }
  ];

  // --- CHART DATA CONFIGURATION ---
  const revenueTrend = [
    { day: 'Mon', Sales: 24000, Expenses: 8000 },
    { day: 'Tue', Sales: 18000, Expenses: 6000 },
    { day: 'Wed', Sales: 32000, Expenses: 10000 },
    { day: 'Thu', Sales: 28000, Expenses: 9000 },
    { day: 'Fri', Sales: 40000, Expenses: 12000 },
    { day: 'Sat', Sales: 45000, Expenses: 14000 },
    { day: 'Sun', Sales: 38000, Expenses: 11000 },
  ];

  const popularServices = [
    { name: 'Pedicure', Bookings: 120, fill: '#0ea5e9' },
    { name: 'Manicure', Bookings: 95, fill: '#ec4899' },
    { name: 'Foot Spa', Bookings: 80, fill: '#10b981' },
    { name: 'Massage', Bookings: 65, fill: '#f59e0b' },
  ];

  const productDistribution = [
    { name: 'Rejuv Sets', value: 45, color: '#f97316', percentage: '45%' },
    { name: 'Sunshield', value: 25, color: '#22c55e', percentage: '25%' },
    { name: 'Toners', value: 18, color: '#a855f7', percentage: '18%' },
    { name: 'Oils & Tools', value: 12, color: '#3b82f6', percentage: '12%' },
  ];

  const activeCount = staffList.filter(s => s.status === 'Active').length;
  const deactivatedCount = staffList.filter(s => s.status === 'Deactivated').length;

  const userStatusDistribution = [
    { name: 'Active Users', value: activeCount, color: '#06b6d4', percentage: `${Math.round((activeCount / staffList.length) * 100)}%` },
    { name: 'Deactivated', value: deactivatedCount, color: '#f43f5e', percentage: `${Math.round((deactivatedCount / staffList.length) * 100)}%` }
  ];

  const lowStockItemsCount = inventoryList.filter(item => item.quantity <= 5).length;
  const occupiedRoomsCount = roomsState.filter(r => r.customer !== '').length;
  const totalSales = 284950;

  const systemNotifications = [
    ...(lowStockItemsCount > 0 ? [{ id: 'notif-1', text: `⚠️ Warning: ${lowStockItemsCount} items are low in stock.`, type: 'alert' }] : []),
    ...(occupiedRoomsCount > 0 ? [{ id: 'notif-2', text: `🟢 Activity: ${occupiedRoomsCount} treatment rooms are active.`, type: 'info' }] : []),
    { id: 'notif-3', text: '✅ Database sync status: Operational.', type: 'success' }
  ];

  // --- TIMER MECHANICS ---
  useEffect(() => {
    const interval = setInterval(() => {
      setRoomsState(prevRooms =>
        prevRooms.map(room => {
          if (room.timeLeft > 0) {
            return { ...room, timeLeft: room.timeLeft - 1 };
          } else if (room.timeLeft === 0 && room.customer !== '') {
            return { ...room, customer: '', service: '', timeLeft: 0, startTime: null };
          }
          return room;
        })
      );
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // --- ALERT HANDLERS ---
  const triggerSweetAlert = (type, title, message) => {
    setSweetAlert({ show: true, type, title, message });
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setLoginError('');

    try {
      const response = await api.post('/auth/login/', loginForm);
      localStorage.setItem('authToken', response.data.token);
      localStorage.setItem('authUser', JSON.stringify(response.data.user));
      setIsLoggedIn(true);
      setCurrentUserRole(response.data.user.role);
      triggerSweetAlert('success', 'Welcome Back!', `Successfully logged in as ${response.data.user.username}.`);
    } catch (error) {
      setLoginError(error.response?.data?.detail || 'Unable to connect to the authentication server.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('authUser');
    setIsLoggedIn(false);
    setLoginForm({ username: '', password: '' });
    setLoginError('');
  };

  const handleDemoRoleChange = (event) => {
    const role = event.target.value;
    setCurrentUserRole(role);
    setLoginForm(DEMO_ACCOUNTS[role]);
    setLoginError('');
  };

  const handleSaveUser = (e) => {
    e.preventDefault();
    setIsLoading(true);
    setTimeout(() => {
      if (editingUser) {
        setStaffList(staffList.map(s => s.id === editingUser.id ? { ...s, ...userForm, history: s.history || [] } : s));
        triggerSweetAlert('success', 'User Updated', `Successfully updated the profile of ${userForm.name}`);
        setEditingUser(null);
      } else {
        const newUser = {
          id: Date.now(),
          ...userForm,
          status: 'Active',
          assignment: 'Unassigned',
          history: [`Started employment on ${new Date(userForm.startDate).toLocaleDateString()}`],
          avatar: userForm.name.split(' ').map(n => n[0]).join('')
        };
        setStaffList([...staffList, newUser]);
        triggerSweetAlert('success', 'User Added', `${userForm.name} has been added to the system.`);
      }
      setShowUserModal(false);
      setUserForm({ name: '', address: '', age: '', gender: 'Female', role: 'Cashier', email: '', phone: '', startDate: new Date().toISOString().split('T')[0] });
      setIsLoading(false);
    }, 500);
  };

  const handleAddProduct = (e) => {
    e.preventDefault();
    const newProduct = {
      id: Date.now(),
      name: productForm.name,
      category: productForm.category,
      quantity: parseInt(productForm.quantity) || 0,
      price: parseFloat(productForm.price) || 0,
      sku: `${productForm.category.substring(0, 3)}-${String(Date.now()).slice(-4)}`
    };
    setInventoryList([...inventoryList, newProduct]);
    setShowProductModal(false);
    setProductForm({ name: '', category: 'Cosmetics', quantity: '', price: '' });
    triggerSweetAlert('success', 'Product Added', 'The item has been added to the inventory.');
  };

  const toggleUserStatus = (id, currentStatus) => {
    const nextStatus = currentStatus === 'Active' ? 'Deactivated' : 'Active';
    setStaffList(staffList.map(s => s.id === id ? { ...s, status: nextStatus } : s));
    triggerSweetAlert('info', 'Status Changed', `User state has been set to ${nextStatus}.`);
  };

  const initEditUser = (user) => {
    setEditingUser(user);
    setUserForm({
      name: user.name,
      address: user.address,
      age: user.age,
      gender: user.gender,
      role: user.role,
      email: user.email || '',
      phone: user.phone || '',
      startDate: user.startDate || new Date().toISOString().split('T')[0]
    });
    setShowUserModal(true);
  };

  const viewUserProfile = (user) => {
    setSelectedProfileUser(user);
    setShowProfileModal(true);
  };

  const handleDeployRoomServices = (e) => {
    e.preventDefault();
    if (!roomForm.staffId) return;

    setStaffList(staffList.map(s => s.id === parseInt(roomForm.staffId) ? { ...s, assignment: `Room ${selectedRoomId}` } : s));
    setRoomsState(roomsState.map(r => r.id === selectedRoomId ? {
      ...r,
      customer: roomForm.customerName,
      service: roomForm.serviceType,
      timeLeft: parseInt(roomForm.minutes),
      startTime: new Date().toISOString()
    } : r));

    setShowRoomModal(false);
    setRoomForm({ staffId: '', customerName: '', serviceType: 'Pedicure & Manicure', minutes: '30' });
    triggerSweetAlert('success', 'Room Timer Started', `Room ${selectedRoomId} is now active.`);
  };

  const handleEvacuateRoom = (roomId) => {
    setStaffList(staffList.map(s => s.assignment === `Room ${roomId}` ? { ...s, assignment: 'Unassigned' } : s));
    setRoomsState(roomsState.map(r => r.id === roomId ? { ...r, customer: '', service: '', timeLeft: 0, startTime: null } : r));
    triggerSweetAlert('info', 'Room Cleared', `Room ${roomId} is now vacant and ready.`);
  };

  const unassignedStaff = staffList.filter(s => s.assignment === 'Unassigned' && s.status === 'Active');

  // --- EXPORT FUNCTION ---
  const exportToCSV = (data, filename) => {
    if (data.length === 0) {
      triggerSweetAlert('info', 'No Data', 'There is no data to export.');
      return;
    }
    const headers = Object.keys(data[0]);
    const csv = [
      headers.join(','),
      ...data.map(row => headers.map(h => row[h] ?? '').join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    triggerSweetAlert('success', 'Export Complete', `File ${filename} has been exported.`);
  };

  // --- FILTERS LOGIC ---
  const filteredUsers = staffList.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(userSearch.toLowerCase()) || s.address.toLowerCase().includes(userSearch.toLowerCase());
    const matchesGender = userGenderFilter === 'All' || s.gender === userGenderFilter;
    const matchesStatus = userStatusFilter === 'All' || s.status === userStatusFilter;
    const matchesRole = userRoleFilter === 'All' || s.role === userRoleFilter;
    return matchesSearch && matchesGender && matchesStatus && matchesRole;
  });
  const totalUserPages = Math.ceil(filteredUsers.length / entriesPerPage) || 1;
  const paginatedUsers = filteredUsers.slice((userPage - 1) * entriesPerPage, userPage * entriesPerPage);

  const filteredProducts = inventoryList.filter(i => {
    const matchesSearch = i.name.toLowerCase().includes(productSearch.toLowerCase());
    const matchesCategory = productCategoryFilter === 'All' || i.category === productCategoryFilter;
    let matchesStock = true;
    if (productStockFilter === 'Stable') matchesStock = i.quantity > 5;
    if (productStockFilter === 'Low') matchesStock = i.quantity <= 5;
    return matchesSearch && matchesCategory && matchesStock;
  });
  const totalProductPages = Math.ceil(filteredProducts.length / entriesPerPage) || 1;
  const paginatedProducts = filteredProducts.slice((productPage - 1) * entriesPerPage, productPage * entriesPerPage);

  const filteredAudits = auditLogs.filter(a => a.target.toLowerCase().includes(auditSearch.toLowerCase()) || a.type.toLowerCase().includes(auditSearch.toLowerCase()));
  const totalAuditPages = Math.ceil(filteredAudits.length / entriesPerPage) || 1;
  const paginatedAudits = filteredAudits.slice((auditPage - 1) * entriesPerPage, auditPage * entriesPerPage);

  // --- LOGIN SCREEN ---
  if (!isLoggedIn) {
    return (
      <div className={`min-h-screen ${
        isDarkMode ? 'bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950' : 'bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900'
      } font-sans flex items-center justify-center p-4`}>
        <div className={`${
          isDarkMode ? 'bg-slate-800/50 border-slate-700/30' : 'bg-white/10'
        } backdrop-blur-xl border border-white/20 w-full max-w-md rounded-2xl p-8 shadow-2xl space-y-6`}>
          <div className="text-center">
            <div className="w-12 h-12 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-cyan-600/30">
              <Zap size={24} className="text-white" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-white">BUNGAD VILLAREAL</h1>
            <p className="text-[11px] text-cyan-300 font-semibold uppercase tracking-wider mt-1">Management Login Portal</p>
          </div>
          {loginError && <p className="text-xs text-red-300 text-center font-medium bg-red-500/20 p-2 rounded-lg border border-red-500/30">{loginError}</p>}
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-cyan-300 uppercase block">Select Demo Account</label>
              <select value={currentUserRole} onChange={handleDemoRoleChange} className="w-full bg-slate-800/50 border border-slate-700 rounded-xl p-3 text-sm focus:bg-slate-800 focus:border-cyan-500 outline-none transition-all text-white font-medium">
                <option value="Superadmin">Superadmin Node</option>
                <option value="Owner">Owner</option>
                <option value="Branch Admin">Branch Admin</option>
                <option value="Cashier">Cashier Account</option>
                <option value="Staff">Staff Account</option>
              </select>
              <p className="text-[10px] text-slate-400">Demo credentials are filled automatically for local testing.</p>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-cyan-300 uppercase block">Username</label>
              <input type="text" required value={loginForm.username} onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })} className="w-full bg-slate-800/50 border border-slate-700 rounded-xl p-3 text-sm focus:bg-slate-800 focus:border-cyan-500 outline-none transition-all text-white" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-cyan-300 uppercase block">Password</label>
              <input type="password" required value={loginForm.password} onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })} className="w-full bg-slate-800/50 border border-slate-700 rounded-xl p-3 text-sm focus:bg-slate-800 focus:border-cyan-500 outline-none transition-all text-white" />
            </div>
            <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 p-3 text-[10px] text-cyan-200">
              <p className="font-semibold uppercase tracking-wider mb-2">Available demo accounts</p>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                {Object.entries(DEMO_ACCOUNTS).map(([role, account]) => (
                  <button key={role} type="button" onClick={() => { setCurrentUserRole(role); setLoginForm(account); }} className="text-left hover:text-white">
                    <span className="font-semibold">{role}:</span> {account.username}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-slate-400">Demo passwords are for local development only.</p>
            </div>
            <button type="submit" className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-medium text-sm py-3 rounded-xl transition-all shadow-lg shadow-cyan-600/20">Access Dashboard</button>
          </form>
        </div>
      </div>
    );
  }

  // --- MAIN APP RENDER ---
  return (
    <BrowserRouter>
      <div className={`flex h-screen ${
        isDarkMode ? 'bg-slate-950 text-slate-200' : 'bg-gradient-to-br from-slate-50 to-slate-100 text-slate-700'
      } font-sans overflow-hidden`}>

        {/* SWEETALERT */}
        {sweetAlert.show && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
            <div className={`${
              isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
            } border rounded-2xl p-6 w-full max-w-sm shadow-2xl text-center space-y-4`}>
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 shadow-md">
                {sweetAlert.type === 'success' ? <CheckCircle size={28} className="text-white" /> : <Info size={28} className="text-white" />}
              </div>
              <div>
                <h3 className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{sweetAlert.title}</h3>
                <p className={`text-xs font-medium mt-1 leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{sweetAlert.message}</p>
              </div>
              <button onClick={() => setSweetAlert({ ...sweetAlert, show: false })} className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white font-semibold text-xs py-2 rounded-xl uppercase tracking-wider transition-all">
                Okay
              </button>
            </div>
          </div>
        )}

        {/* PROFILE MODAL */}
        {showProfileModal && selectedProfileUser && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div className={`${
              isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white'
            } rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto shadow-2xl border`}>
              <div className={`sticky top-0 ${
                isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
              } border-b p-4 flex justify-between items-center`}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center">
                    <UserCog size={20} className="text-white" />
                  </div>
                  <h3 className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Staff Profile Details</h3>
                </div>
                <button onClick={() => setShowProfileModal(false)} className={`p-2 ${
                  isDarkMode ? 'hover:bg-slate-700' : 'hover:bg-slate-100'
                } rounded-xl transition-all`}>
                  <X size={18} />
                </button>
              </div>

              <div className="p-6 space-y-6">
                <div className={`flex items-center gap-4 pb-4 border-b ${isDarkMode ? 'border-slate-700' : 'border-slate-100'}`}>
                  <div className={`w-20 h-20 ${
                    isDarkMode ? 'bg-slate-700' : 'bg-gradient-to-br from-cyan-100 to-blue-100'
                  } rounded-2xl flex items-center justify-center`}>
                    <Users size={36} className="text-cyan-600" />
                  </div>
                  <div>
                    <h2 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{selectedProfileUser.name}</h2>
                    <p className="text-sm text-cyan-600 font-medium">{selectedProfileUser.role}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        selectedProfileUser.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {selectedProfileUser.status}
                      </span>
                      <span className={`text-[10px] ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>ID: {selectedProfileUser.id}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className={`text-xs font-bold ${isDarkMode ? 'text-slate-400' : 'text-slate-400'} uppercase tracking-wider mb-3 flex items-center gap-2`}>
                    <UserCheck size={12} /> Personal Information
                  </h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div><p className={`${isDarkMode ? 'text-slate-500' : 'text-slate-400'} text-[10px] uppercase`}>Email Address</p><p className={`font-medium ${isDarkMode ? 'text-slate-300' : 'text-slate-700'} flex items-center gap-1`}><Mail size={12} /> {selectedProfileUser.email || 'Not provided'}</p></div>
                    <div><p className={`${isDarkMode ? 'text-slate-500' : 'text-slate-400'} text-[10px] uppercase`}>Phone Number</p><p className={`font-medium ${isDarkMode ? 'text-slate-300' : 'text-slate-700'} flex items-center gap-1`}><Phone size={12} /> {selectedProfileUser.phone || 'Not provided'}</p></div>
                    <div><p className={`${isDarkMode ? 'text-slate-500' : 'text-slate-400'} text-[10px] uppercase`}>Address</p><p className={`font-medium ${isDarkMode ? 'text-slate-300' : 'text-slate-700'} flex items-center gap-1`}><MapPin size={12} /> {selectedProfileUser.address}</p></div>
                    <div><p className={`${isDarkMode ? 'text-slate-500' : 'text-slate-400'} text-[10px] uppercase`}>Age / Gender</p><p className={`font-medium ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>{selectedProfileUser.age} years / {selectedProfileUser.gender}</p></div>
                    <div><p className={`${isDarkMode ? 'text-slate-500' : 'text-slate-400'} text-[10px] uppercase`}>Start Date</p><p className={`font-medium ${isDarkMode ? 'text-slate-300' : 'text-slate-700'} flex items-center gap-1`}><Calendar size={12} /> {new Date(selectedProfileUser.startDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p></div>
                    <div><p className={`${isDarkMode ? 'text-slate-500' : 'text-slate-400'} text-[10px] uppercase`}>Current Assignment</p><p className={`font-medium ${isDarkMode ? 'text-slate-300' : 'text-slate-700'} flex items-center gap-1`}><Target size={12} /> {selectedProfileUser.assignment}</p></div>
                  </div>
                </div>

                <div>
                  <h4 className={`text-xs font-bold ${isDarkMode ? 'text-slate-400' : 'text-slate-400'} uppercase tracking-wider mb-3 flex items-center gap-2`}>
                    <History size={12} /> Employment History & Achievements
                  </h4>
                  <div className="space-y-2">
                    {selectedProfileUser.history && selectedProfileUser.history.length > 0 ? (
                      selectedProfileUser.history.map((item, idx) => (
                        <div key={idx} className={`flex items-start gap-3 p-3 ${
                          isDarkMode ? 'bg-slate-700/50 border-slate-700' : 'bg-slate-50 border-slate-100'
                        } rounded-xl border`}>
                          <div className="w-5 h-5 bg-cyan-100 rounded-full flex items-center justify-center mt-0.5">
                            <Award size={10} className="text-cyan-600" />
                          </div>
                          <p className={`text-xs font-medium ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>{item}</p>
                        </div>
                      ))
                    ) : (
                      <p className={`text-xs italic ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>No history records available.</p>
                    )}
                  </div>
                </div>

                <div className="flex gap-3 pt-4 border-t border-slate-100">
                  {canAccess(currentUserRole, 'user_manage') && <button onClick={() => { setShowProfileModal(false); initEditUser(selectedProfileUser); }} className={`flex-1 ${
                    isDarkMode ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  } font-semibold text-xs py-2 rounded-xl transition-all flex items-center justify-center gap-1`}>
                    <Edit3 size={12} /> Edit Profile
                  </button>}
                  <button onClick={() => setShowProfileModal(false)} className="flex-1 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white font-semibold text-xs py-2 rounded-xl transition-all flex items-center justify-center gap-1">
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* USER MODAL */}
        {showUserModal && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-40">
            <div className={`${
              isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
            } border rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4`}>
              <div className="flex justify-between items-center border-b pb-2">
                <h3 className={`text-xs font-bold uppercase tracking-wider ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                  {editingUser ? 'Edit User Profile' : 'Register New User'}
                </h3>
                <button onClick={() => { setShowUserModal(false); setEditingUser(null); }} className="text-slate-400 hover:text-slate-900"><X size={16} /></button>
              </div>
              <form onSubmit={handleSaveUser} className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
                <div>
                  <label className={`block text-xs font-semibold uppercase ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Full Name</label>
                  <input type="text" required value={userForm.name} onChange={(e) => setUserForm({ ...userForm, name: e.target.value })} className={`w-full ${
                    isDarkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-slate-50 border-slate-200'
                  } border p-2 text-sm rounded-xl`} />
                </div>
                <div>
                  <label className={`block text-xs font-semibold uppercase ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Email Address</label>
                  <input type="email" value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} className={`w-full ${
                    isDarkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-slate-50 border-slate-200'
                  } border p-2 text-sm rounded-xl`} />
                </div>
                <div>
                  <label className={`block text-xs font-semibold uppercase ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Phone Number</label>
                  <input type="text" value={userForm.phone} onChange={(e) => setUserForm({ ...userForm, phone: e.target.value })} className={`w-full ${
                    isDarkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-slate-50 border-slate-200'
                  } border p-2 text-sm rounded-xl`} />
                </div>
                <div>
                  <label className={`block text-xs font-semibold uppercase ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Address</label>
                  <input type="text" required value={userForm.address} onChange={(e) => setUserForm({ ...userForm, address: e.target.value })} className={`w-full ${
                    isDarkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-slate-50 border-slate-200'
                  } border p-2 text-sm rounded-xl`} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={`block text-xs font-semibold uppercase ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Age</label>
                    <input type="number" required value={userForm.age} onChange={(e) => setUserForm({ ...userForm, age: e.target.value })} className={`w-full ${
                      isDarkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-slate-50 border-slate-200'
                    } border p-2 text-sm rounded-xl`} />
                  </div>
                  <div>
                    <label className={`block text-xs font-semibold uppercase ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Gender</label>
                    <select value={userForm.gender} onChange={(e) => setUserForm({ ...userForm, gender: e.target.value })} className={`w-full ${
                      isDarkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-slate-50 border-slate-200'
                    } border p-2 text-sm rounded-xl font-medium`}>
                      <option value="Female">Female</option>
                      <option value="Male">Male</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className={`block text-xs font-semibold uppercase ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Start Date</label>
                  <input type="date" required value={userForm.startDate} onChange={(e) => setUserForm({ ...userForm, startDate: e.target.value })} className={`w-full ${
                    isDarkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-slate-50 border-slate-200'
                  } border p-2 text-sm rounded-xl`} />
                </div>
                <div>
                  <label className={`block text-xs font-semibold uppercase ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>System Role Assigned</label>
                  <select value={userForm.role} onChange={(e) => setUserForm({ ...userForm, role: e.target.value })} className={`w-full ${
                    isDarkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-slate-50 border-slate-200'
                  } border p-2 text-sm rounded-xl font-medium`}>
                    <option value="Cashier">Cashier</option>
                    <option value="Owner">Owner</option>
                    <option value="Branch Admin">Branch Admin</option>
                    <option value="Staff">Staff</option>
                  </select>
                </div>
                <button type="submit" disabled={isLoading} className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white font-semibold text-xs py-2.5 rounded-xl uppercase tracking-wider transition-all disabled:opacity-70 flex items-center justify-center gap-2">
                  {isLoading ? <Loader2 size={16} className="animate-spin" /> : null}
                  {isLoading ? 'Saving...' : 'Save Account'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ROOM MODAL */}
        {showRoomModal && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-40">
            <div className={`${
              isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
            } border rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-4`}>
              <div className="flex justify-between items-center border-b pb-2">
                <h3 className={`text-xs font-bold uppercase tracking-wider ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Assign Room {selectedRoomId}</h3>
                <button onClick={() => setShowRoomModal(false)} className="text-slate-400 hover:text-slate-900"><X size={16} /></button>
              </div>
              <form onSubmit={handleDeployRoomServices} className="space-y-3">
                <div>
                  <label className={`block text-xs font-semibold uppercase ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Assign Available Specialist</label>
                  <select required value={roomForm.staffId} onChange={(e) => setRoomForm({ ...roomForm, staffId: e.target.value })} className={`w-full ${
                    isDarkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-slate-50 border-slate-200'
                  } border p-2 text-sm rounded-xl font-medium`}>
                    <option value="">-- Select Available Specialist --</option>
                    {unassignedStaff.map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.role})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={`block text-xs font-semibold uppercase ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Customer Name</label>
                  <input type="text" required value={roomForm.customerName} onChange={(e) => setRoomForm({ ...roomForm, customerName: e.target.value })} className={`w-full ${
                    isDarkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-slate-50 border-slate-200'
                  } border p-2 text-sm rounded-xl`} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={`block text-xs font-semibold uppercase ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Service Type</label>
                    <select value={roomForm.serviceType} onChange={(e) => setRoomForm({ ...roomForm, serviceType: e.target.value })} className={`w-full ${
                      isDarkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-slate-50 border-slate-200'
                    } border p-2 text-xs rounded-xl font-medium`}>
                      <option value="Pedicure & Manicure">Pedicure & Manicure</option>
                      <option value="Foot Spa Therapy">Foot Spa Therapy</option>
                      <option value="Therapeutic Massage">Therapeutic Massage</option>
                    </select>
                  </div>
                  <div>
                    <label className={`block text-xs font-semibold uppercase ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Duration</label>
                    <select value={roomForm.minutes} onChange={(e) => setRoomForm({ ...roomForm, minutes: e.target.value })} className={`w-full ${
                      isDarkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-slate-50 border-slate-200'
                    } border p-2 text-xs rounded-xl font-medium`}>
                      <option value="1">1 Minute (Test)</option>
                      <option value="30">30 Minutes</option>
                      <option value="60">60 Minutes (1 Hour)</option>
                      <option value="90">90 Minutes</option>
                    </select>
                  </div>
                </div>
                <button type="submit" className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white font-semibold text-xs py-2.5 rounded-xl uppercase tracking-wider transition-all">Deploy Timer</button>
              </form>
            </div>
          </div>
        )}

        {/* PRODUCT MODAL */}
        {showProductModal && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-40">
            <div className={`${
              isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
            } border rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-4`}>
              <div className="flex justify-between items-center border-b pb-2">
                <h3 className={`text-xs font-bold uppercase tracking-wider ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Add New Product</h3>
                <button onClick={() => setShowProductModal(false)} className="text-slate-400 hover:text-slate-900"><X size={16} /></button>
              </div>
              <form onSubmit={handleAddProduct} className="space-y-3">
                <div>
                  <label className={`block text-xs font-semibold uppercase ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Product Name</label>
                  <input type="text" required value={productForm.name} onChange={(e) => setProductForm({ ...productForm, name: e.target.value })} className={`w-full ${
                    isDarkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-slate-50 border-slate-200'
                  } border p-2 text-sm rounded-xl`} />
                </div>
                <div>
                  <label className={`block text-xs font-semibold uppercase ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Category</label>
                  <select value={productForm.category} onChange={(e) => setProductForm({ ...productForm, category: e.target.value })} className={`w-full ${
                    isDarkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-slate-50 border-slate-200'
                  } border p-2 text-sm rounded-xl font-medium`}>
                    <option value="Cosmetics">Cosmetics</option>
                    <option value="Supplies">Supplies</option>
                    <option value="Equipment">Equipment</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={`block text-xs font-semibold uppercase ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Quantity</label>
                    <input type="number" required value={productForm.quantity} onChange={(e) => setProductForm({ ...productForm, quantity: e.target.value })} className={`w-full ${
                      isDarkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-slate-50 border-slate-200'
                    } border p-2 text-sm rounded-xl`} />
                  </div>
                  <div>
                    <label className={`block text-xs font-semibold uppercase ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Price (₱)</label>
                    <input type="number" required value={productForm.price} onChange={(e) => setProductForm({ ...productForm, price: e.target.value })} className={`w-full ${
                      isDarkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-slate-50 border-slate-200'
                    } border p-2 text-sm rounded-xl`} />
                  </div>
                </div>
                <button type="submit" className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white font-semibold text-xs py-2.5 rounded-xl uppercase tracking-wider transition-all">Confirm Stock Entry</button>
              </form>
            </div>
          </div>
        )}

        {/* SIDEBAR */}
        <Sidebar
          sidebarCollapsed={sidebarCollapsed}
          setActiveTab={setActiveTab}
          activeTab={activeTab}
          currentUserRole={currentUserRole}
          isDarkMode={isDarkMode}
          toggleDarkMode={toggleDarkMode}
          onLogout={handleLogout}
        />

        {/* MAIN CONTENT */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {/* HEADER */}
          <header className={`${
            isDarkMode ? 'bg-slate-900/80 border-slate-700/30' : 'bg-white/80 border-slate-200'
          } backdrop-blur-sm border-b px-6 py-3 flex justify-between items-center shadow-sm z-20`}>
            <div className="flex items-center space-x-3">
              <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)} className={`p-2 border ${
                isDarkMode ? 'border-slate-700 hover:bg-slate-800 text-slate-400' : 'border-slate-200 hover:bg-slate-100 text-slate-600'
              } rounded-xl transition-all`}>
                <Menu size={15} />
              </button>
              <h2 className={`text-base font-bold ${
                isDarkMode ? 'text-white' : 'bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent'
              }`}>
                {activeTab === 'dashboard' && "System Performance Insights"}
                {activeTab === 'sales' && "Sales & Point of Sale"}
                {activeTab === 'clients' && "Client Directory"}
                {activeTab === 'administration' && "System Administration"}
                {activeTab === 'users' && "User Management Directory"}
                {activeTab === 'rooms' && "Live Service Room Tracking"}
                {activeTab === 'inventory' && "Product & Sales Stock Registry"}
                {activeTab === 'audit_controls' && "Security Exception Records"}
              </h2>
            </div>

            <div className="flex items-center space-x-4">
              <div className={`text-right font-mono text-xs ${
                isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-200'
              } border px-3 py-1.5 rounded-xl`}>
                <span className="text-slate-400 mr-1.5">{formattedDate}</span>
                <span className="text-cyan-600 font-semibold">{formattedTime}</span>
              </div>

              <div className={`flex items-center gap-2 ${
                isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-gradient-to-r from-slate-100 to-slate-50 border-slate-200'
              } border px-3 py-1 rounded-xl text-xs`}>
                <UserCheck size={14} className="text-cyan-600" />
                <span className={`font-semibold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Role:</span>
                <span className={`font-bold ${isDarkMode ? 'text-cyan-400' : 'text-cyan-700'}`}>
                  {currentUserRole}
                </span>
              </div>

              <div className={`h-5 w-px ${isDarkMode ? 'bg-slate-700' : 'bg-slate-200'}`}></div>

              <div className="relative">
                <button onClick={() => setShowNotifDropdown(!showNotifDropdown)} className={`p-2 border ${
                  isDarkMode ? 'border-slate-700 hover:bg-slate-800 text-slate-400' : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                } rounded-xl relative transition-all`}>
                  <Bell size={15} />
                  <span className="absolute -top-1 -right-1 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-bold text-[8px] w-4 h-4 flex items-center justify-center rounded-full shadow-md">{systemNotifications.length}</span>
                </button>

                {showNotifDropdown && (
                  <div className={`absolute right-0 mt-2 w-72 ${
                    isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
                  } border rounded-xl shadow-xl p-2 z-50 space-y-1`}>
                    <div className={`px-2 py-1 border-b ${isDarkMode ? 'border-slate-700' : 'border-slate-100'} flex justify-between items-center`}>
                      <span className={`text-[10px] font-bold ${isDarkMode ? 'text-slate-400' : 'text-slate-400'} uppercase`}>Notifications</span>
                      <button onClick={() => setShowNotifDropdown(false)} className="text-[10px] text-cyan-600">Dismiss</button>
                    </div>
                    {systemNotifications.map(n => (
                      <div key={n.id} className={`p-2 rounded-lg text-xs flex items-start gap-2 ${
                        isDarkMode ? 'hover:bg-slate-700' : 'hover:bg-slate-50'
                      }`}>
                        <span className={`w-1.5 h-1.5 mt-1.5 rounded-full shrink-0 ${
                          n.type === 'alert' ? 'bg-orange-500' : n.type === 'success' ? 'bg-emerald-500' : 'bg-blue-500'
                        }`}></span>
                        <p className={`font-medium leading-snug ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>{n.text}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </header>

          {/* WORKSPACE CONTENT */}
          <div className={`flex-1 overflow-y-auto p-6 space-y-6 ${
            isDarkMode ? 'bg-slate-950/50' : 'bg-slate-50/30'
          }`}>

            {activeTab === 'sales' && canAccess(currentUserRole, 'sales') && (
              <SalesPage isDarkMode={isDarkMode} readOnly={currentUserRole === 'Owner'} />
            )}

            {activeTab === 'clients' && canAccess(currentUserRole, 'clients') && (
              <ClientsPage
                isDarkMode={isDarkMode}
                readOnly={!canAccess(currentUserRole, 'client_manage')}
              />
            )}

            {activeTab === 'administration' && canAccess(currentUserRole, 'administration') && (
              <AdministrationPage isDarkMode={isDarkMode} />
            )}

            {/* DASHBOARD */}
            {activeTab === 'dashboard' && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                  <div className={`${
                    isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-gradient-to-br from-cyan-50 to-blue-50 border-cyan-100'
                  } border rounded-xl p-4 shadow-sm hover:shadow-md transition-all duration-200 flex items-center justify-between group`}>
                    <div>
                      <span className={`text-xs font-medium uppercase tracking-wide ${isDarkMode ? 'text-cyan-400' : 'text-cyan-600'}`}>Active Rooms</span>
                      <h3 className={`text-2xl font-bold mt-1 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{occupiedRoomsCount} / 15</h3>
                    </div>
                    <div className={`p-3 ${isDarkMode ? 'bg-slate-700' : 'bg-gradient-to-br from-cyan-100 to-blue-100'} rounded-xl group-hover:scale-110 transition-transform duration-200 ${isDarkMode ? 'text-cyan-400' : 'text-cyan-600'}`}>
                      <Layers size={20} />
                    </div>
                  </div>

                  <div className={`${
                    isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-100'
                  } border rounded-xl p-4 shadow-sm hover:shadow-md transition-all duration-200 flex items-center justify-between group`}>
                    <div>
                      <span className={`text-xs font-medium uppercase tracking-wide ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`}>Available Staff</span>
                      <h3 className={`text-2xl font-bold mt-1 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{unassignedStaff.length} Standby</h3>
                    </div>
                    <div className={`p-3 ${isDarkMode ? 'bg-slate-700' : 'bg-gradient-to-br from-emerald-100 to-teal-100'} rounded-xl group-hover:scale-110 transition-transform duration-200 ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`}>
                      <Briefcase size={20} />
                    </div>
                  </div>

                  <div className={`${
                    isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-gradient-to-br from-amber-50 to-orange-50 border-amber-100'
                  } border rounded-xl p-4 shadow-sm hover:shadow-md transition-all duration-200 flex items-center justify-between group`}>
                    <div>
                      <span className={`text-xs font-medium uppercase tracking-wide ${isDarkMode ? 'text-amber-400' : 'text-amber-600'}`}>Stock Warnings</span>
                      <h3 className={`text-2xl font-bold mt-1 ${isDarkMode ? 'text-orange-400' : 'text-orange-600'}`}>{lowStockItemsCount} Alerts</h3>
                    </div>
                    <div className={`p-3 ${isDarkMode ? 'bg-slate-700' : 'bg-gradient-to-br from-amber-100 to-orange-100'} rounded-xl group-hover:scale-110 transition-transform duration-200 ${isDarkMode ? 'text-amber-400' : 'text-orange-600'}`}>
                      <AlertTriangle size={20} />
                    </div>
                  </div>

                  <div className={`${
                    isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-100'
                  } border rounded-xl p-4 shadow-sm hover:shadow-md transition-all duration-200 flex items-center justify-between group`}>
                    <div>
                      <span className={`text-xs font-medium uppercase tracking-wide ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>Today's Sales</span>
                      <h3 className={`text-2xl font-bold mt-1 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>₱{totalSales.toLocaleString()}</h3>
                    </div>
                    <div className={`p-3 ${isDarkMode ? 'bg-slate-700' : 'bg-gradient-to-br from-blue-100 to-indigo-100'} rounded-xl group-hover:scale-110 transition-transform duration-200 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                      <DollarSign size={20} />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className={`${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} border p-5 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 lg:col-span-2`}>
                    <div className="mb-4">
                      <div className="flex items-center gap-2">
                        <TrendingUp size={16} className="text-cyan-600" />
                        <h4 className={`text-xs font-bold uppercase tracking-wide ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Weekly Store Sales Overview</h4>
                      </div>
                      <p className={`text-[11px] font-medium mt-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-400'}`}>Tracks total currency sales turnover across weekly channels</p>
                    </div>
                    <div className="h-64 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={revenueTrend}>
                          <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#334155' : '#f1f5f9'} />
                          <XAxis dataKey="day" fontSize={11} stroke={isDarkMode ? '#64748b' : '#94a3b8'} />
                          <YAxis fontSize={11} stroke={isDarkMode ? '#64748b' : '#94a3b8'} />
                          <Tooltip contentStyle={{ backgroundColor: isDarkMode ? '#1e293b' : 'white', borderRadius: '8px', border: isDarkMode ? '1px solid #334155' : '1px solid #e2e8f0', fontSize: '11px', color: isDarkMode ? 'white' : 'black' }} />
                          <Legend wrapperStyle={{ fontSize: '11px', pt: '10px', color: isDarkMode ? 'white' : 'black' }} />
                          <Line type="monotone" dataKey="Sales" stroke="#0284c7" strokeWidth={2.5} activeDot={{ r: 5 }} dot={{ fill: '#0284c7', strokeWidth: 2 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className={`${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} border p-5 rounded-xl shadow-sm hover:shadow-md transition-all duration-200`}>
                    <div className="mb-4">
                      <div className="flex items-center gap-2">
                        <Archive size={16} className="text-cyan-600" />
                        <h4 className={`text-xs font-bold uppercase tracking-wide ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Product Stock Share</h4>
                      </div>
                      <p className={`text-[11px] font-medium mt-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-400'}`}>Volumetric share metrics by distribution types</p>
                    </div>
                    <div className="h-52 w-full flex items-center justify-center relative">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={productDistribution} cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={4} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={true}>
                            {productDistribution.map((entry, idx) => <Cell key={idx} fill={entry.color} stroke="#fff" strokeWidth={2} />)}
                          </Pie>
                          <Tooltip contentStyle={{ backgroundColor: isDarkMode ? '#1e293b' : 'white', borderRadius: '8px', border: isDarkMode ? '1px solid #334155' : '1px solid #e2e8f0', fontSize: '11px', color: isDarkMode ? 'white' : 'black' }} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute text-center">
                        <span className={`text-sm font-bold block ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>₱284.9K</span>
                        <span className="text-[9px] text-slate-400 font-medium uppercase tracking-wider">Total</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[10px] font-semibold pt-3 border-t mt-2">
                      {productDistribution.map((pt, i) => (
                        <div key={i} className={`flex items-center gap-1.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                          <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: pt.color }}></span>
                          <span>{pt.name} ({pt.percentage})</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className={`${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} border p-5 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 lg:col-span-2`}>
                    <div className="mb-4">
                      <div className="flex items-center gap-2">
                        <Star size={16} className="text-cyan-600" />
                        <h4 className={`text-xs font-bold uppercase tracking-wide ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Most Booked Services</h4>
                      </div>
                      <p className={`text-[11px] font-medium mt-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-400'}`}>Distinctly mapped colors assigned per service for instant identification</p>
                    </div>
                    <div className="h-64 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={popularServices}>
                          <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#334155' : '#f1f5f9'} />
                          <XAxis dataKey="name" fontSize={11} stroke={isDarkMode ? '#64748b' : '#94a3b8'} />
                          <YAxis fontSize={11} stroke={isDarkMode ? '#64748b' : '#94a3b8'} />
                          <Tooltip contentStyle={{ backgroundColor: isDarkMode ? '#1e293b' : 'white', borderRadius: '8px', border: isDarkMode ? '1px solid #334155' : '1px solid #e2e8f0', fontSize: '11px', color: isDarkMode ? 'white' : 'black' }} />
                          <Bar dataKey="Bookings" radius={[4, 4, 0, 0]}>
                            {popularServices.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className={`${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} border p-5 rounded-xl shadow-sm hover:shadow-md transition-all duration-200`}>
                    <div className="mb-4">
                      <div className="flex items-center gap-2">
                        <Users size={16} className="text-cyan-600" />
                        <h4 className={`text-xs font-bold uppercase tracking-wide ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>User Account Status</h4>
                      </div>
                      <p className={`text-[11px] font-medium mt-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-400'}`}>Active Users vs Deactivated Accounts</p>
                    </div>
                    <div className="h-52 w-full flex items-center justify-center">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={userStatusDistribution} cx="50%" cy="50%" outerRadius={70} dataKey="value" stroke="#fff" strokeWidth={2} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={true}>
                            {userStatusDistribution.map((entry, idx) => <Cell key={idx} fill={entry.color} />)}
                          </Pie>
                          <Tooltip contentStyle={{ backgroundColor: isDarkMode ? '#1e293b' : 'white', borderRadius: '8px', border: isDarkMode ? '1px solid #334155' : '1px solid #e2e8f0', fontSize: '11px', color: isDarkMode ? 'white' : 'black' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className={`flex justify-center gap-4 text-[10px] font-semibold pt-3 border-t mt-2 ${isDarkMode ? 'text-slate-400 border-slate-700' : 'text-slate-500 border-slate-100'}`}>
                      {userStatusDistribution.map((cc, i) => (
                        <div key={i} className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: cc.color }}></span>
                          <span>{cc.name} ({cc.percentage})</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* USERS TAB */}
            {canAccess(currentUserRole, 'users') && activeTab === 'users' && (
              <div className={`${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} border p-5 rounded-xl shadow-sm space-y-4`}>
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 border-b pb-3">
                  <div>
                    <h3 className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>User Management Directory</h3>
                    <p className={`text-xs font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-400'}`}>
                      {staffList.length} total users · {staffList.filter(s => s.status === 'Active').length} active
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => exportToCSV(staffList, 'users')}
                      className={`border ${isDarkMode ? 'border-slate-700 hover:bg-slate-700 text-slate-400 hover:text-white' : 'border-slate-200 hover:bg-slate-50 text-slate-600'} font-medium text-xs px-3 py-2 rounded-xl flex items-center gap-1.5 transition-all`}
                    >
                      <Download size={14} /> Export
                    </button>
                    {canAccess(currentUserRole, 'user_manage') && <button onClick={() => setShowUserModal(true)} className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white font-medium text-xs px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-all shadow-md">
                      <UserPlus size={14} /> Add User
                      </button>}
                  </div>
                </div>

                <div className={`${isDarkMode ? 'bg-slate-700/50 border-slate-700' : 'bg-gradient-to-r from-slate-50 to-slate-100/50 border-slate-200'} border p-3 rounded-xl flex flex-col md:flex-row items-center gap-3 text-xs font-semibold`}>
                  <div className="flex items-center gap-1 text-slate-600"><Filter size={13} /> <span>Filters:</span></div>

                  <div className="w-full md:w-44 space-y-0.5">
                    <span className="text-[10px] text-slate-400 block uppercase">Search</span>
                    <input type="text" placeholder="Type name or address..." value={userSearch} onChange={(e) => { setUserSearch(e.target.value); setUserPage(1); }} className={`w-full ${isDarkMode ? 'bg-slate-800 border-slate-600 text-white' : 'bg-white border-slate-200'} border p-1.5 rounded-lg outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all`} />
                  </div>

                  <div className="w-full md:w-40 space-y-0.5">
                    <span className="text-[10px] text-slate-400 block uppercase">Role</span>
                    <select value={userRoleFilter} onChange={(e) => { setUserRoleFilter(e.target.value); setUserPage(1); }} className={`w-full ${isDarkMode ? 'bg-slate-800 border-slate-600 text-white' : 'bg-white border-slate-200'} border p-1.5 rounded-lg font-medium outline-none focus:border-cyan-500`}>
                      <option value="All">All Roles</option>
                      <option value="Cashier">Cashier</option>
                      <option value="Owner">Owner</option>
                      <option value="Branch Admin">Branch Admin</option>
                      <option value="Staff">Staff</option>
                    </select>
                  </div>

                  <div className="w-full md:w-36 space-y-0.5">
                    <span className="text-[10px] text-slate-400 block uppercase">Gender</span>
                    <select value={userGenderFilter} onChange={(e) => { setUserGenderFilter(e.target.value); setUserPage(1); }} className={`w-full ${isDarkMode ? 'bg-slate-800 border-slate-600 text-white' : 'bg-white border-slate-200'} border p-1.5 rounded-lg font-medium outline-none focus:border-cyan-500`}>
                      <option value="All">All Genders</option>
                      <option value="Female">Female</option>
                      <option value="Male">Male</option>
                    </select>
                  </div>

                  <div className="w-full md:w-36 space-y-0.5">
                    <span className="text-[10px] text-slate-400 block uppercase">Status</span>
                    <select value={userStatusFilter} onChange={(e) => { setUserStatusFilter(e.target.value); setUserPage(1); }} className={`w-full ${isDarkMode ? 'bg-slate-800 border-slate-600 text-white' : 'bg-white border-slate-200'} border p-1.5 rounded-lg font-medium outline-none focus:border-cyan-500`}>
                      <option value="All">All Statuses</option>
                      <option value="Active">Active</option>
                      <option value="Deactivated">Deactivated</option>
                    </select>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className={`border-b ${isDarkMode ? 'border-slate-700 text-slate-400' : 'border-slate-200 text-slate-400'} text-xs font-semibold uppercase ${isDarkMode ? 'bg-slate-700/50' : 'bg-gradient-to-r from-slate-50 to-slate-100'}`}>
                        <th className="py-2.5 px-4">User</th>
                        <th className="py-2.5 px-4">Role</th>
                        <th className="py-2.5 px-4">Assignment</th>
                        <th className="py-2.5 px-4 text-center">Status</th>
                        <th className="py-2.5 px-4 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${isDarkMode ? 'divide-slate-700' : 'divide-slate-100'}`}>
                      {paginatedUsers.map((staff) => (
                        <tr key={staff.id} className={`${isDarkMode ? 'hover:bg-slate-700/50' : 'hover:bg-slate-50/30'} transition-colors ${staff.status === 'Deactivated' ? 'opacity-60' : ''}`}>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 ${
                                isDarkMode ? 'bg-slate-700 text-cyan-400' : 'bg-gradient-to-br from-cyan-100 to-blue-100 text-cyan-600'
                              } rounded-full flex items-center justify-center font-bold text-xs`}>
                                {staff.avatar || staff.name.split(' ').map(n => n[0]).join('')}
                              </div>
                              <div>
                                <p className={`font-semibold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{staff.name}</p>
                                <p className={`text-[10px] ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>{staff.email || 'No email'}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${
                              staff.role === 'Admin' ? 'bg-purple-100 text-purple-700' :
                              staff.role === 'Cashier' ? 'bg-cyan-100 text-cyan-700' :
                              staff.role === 'Spa Therapist' ? 'bg-pink-100 text-pink-700' :
                              'bg-slate-100 text-slate-700'
                            }`}>
                              {staff.role}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className={`text-xs font-medium ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                              {staff.assignment === 'Unassigned' ?
                                <span className="text-amber-600">🔄 Unassigned</span> :
                                <span className="text-cyan-600">📍 {staff.assignment}</span>
                              }
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full ${
                              staff.status === 'Active' ?
                              'bg-emerald-50 text-emerald-600 border border-emerald-200' :
                              'bg-red-50 text-red-600 border border-red-200'
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${staff.status === 'Active' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                              {staff.status.toUpperCase()}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center justify-center gap-1.5">
                              <button onClick={() => viewUserProfile(staff)} className={`p-1.5 ${
                                isDarkMode ? 'bg-slate-700 border-slate-600 text-cyan-400 hover:bg-slate-600' : 'bg-cyan-50 border-cyan-200 text-cyan-600 hover:bg-cyan-100'
                              } border rounded-lg transition-all hover:scale-110`} title="View Profile">
                                <Eye size={13} />
                              </button>
                              {canAccess(currentUserRole, 'user_manage') && <button onClick={() => initEditUser(staff)} className={`p-1.5 ${
                                isDarkMode ? 'bg-slate-700 border-slate-600 text-slate-400 hover:text-white hover:bg-slate-600' : 'bg-white border-slate-200 text-slate-500 hover:text-slate-800 hover:border-slate-300'
                              } border rounded-lg transition-all hover:scale-110`} title="Edit">
                                <Edit3 size={13} />
                              </button>}
                              {canAccess(currentUserRole, 'user_manage') && <button onClick={() => toggleUserStatus(staff.id, staff.status)} className={`p-1.5 border rounded-lg transition-all hover:scale-110 ${(
                                staff.status === 'Active' ?
                                'bg-red-50 border-red-100 text-red-500 hover:bg-red-100' :
                                'bg-emerald-50 border-emerald-100 text-emerald-500 hover:bg-emerald-100'
                              )}`} title={staff.status === 'Active' ? 'Deactivate' : 'Activate'}>
                                {staff.status === 'Active' ? <EyeOff size={13} /> : <Check size={13} />}
                              </button>}
                            </div>
                          </td>
                        </tr>
                      ))}
                      {paginatedUsers.length === 0 && (
                        <tr><td colSpan="5" className={`text-center py-6 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'} italic`}>No user accounts found.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className={`flex justify-between items-center border-t pt-3 text-xs font-semibold ${isDarkMode ? 'text-slate-400 border-slate-700' : 'text-slate-400 border-slate-100'}`}>
                  <div>Showing {paginatedUsers.length} of {filteredUsers.length} users</div>
                  <div className="flex items-center gap-1">
                    <button disabled={userPage === 1} onClick={() => setUserPage(userPage - 1)} className={`px-3 py-1 border rounded-lg ${isDarkMode ? 'border-slate-700 bg-slate-800 text-white hover:bg-slate-700' : 'border-slate-200 bg-white hover:bg-slate-50'} disabled:opacity-40 text-xs transition-all flex items-center gap-1`}>
                      <ChevronLeft size={12} /> Prev
                    </button>
                    {Array.from({ length: Math.min(totalUserPages, 5) }, (_, i) => {
                      const pageNum = i + 1;
                      return (
                        <button key={pageNum} onClick={() => setUserPage(pageNum)} className={`w-7 h-7 rounded-lg text-xs font-bold transition-all ${
                          userPage === pageNum ?
                          'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-sm' :
                          isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700' : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50'
                        }`}>
                          {pageNum}
                        </button>
                      );
                    })}
                    {totalUserPages > 5 && <span className="text-slate-400">...</span>}
                    <button disabled={userPage === totalUserPages} onClick={() => setUserPage(userPage + 1)} className={`px-3 py-1 border rounded-lg ${isDarkMode ? 'border-slate-700 bg-slate-800 text-white hover:bg-slate-700' : 'border-slate-200 bg-white hover:bg-slate-50'} disabled:opacity-40 text-xs transition-all flex items-center gap-1`}>
                      Next <ChevronRight size={12} />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ROOMS TAB */}
            {canAccess(currentUserRole, 'rooms') && activeTab === 'rooms' && (
              <div className="space-y-6">
                <div className={`grid grid-cols-1 md:grid-cols-3 gap-4 ${
                  isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-gradient-to-r from-blue-50 via-cyan-50 to-sky-50 border-cyan-100'
                } p-5 border rounded-xl shadow-sm`}>
                  <div className="text-center md:border-r border-cyan-100">
                    <span className={`text-xs block ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Occupied Rooms</span>
                    <div className={`text-2xl font-bold mt-1 ${isDarkMode ? 'text-cyan-400' : 'text-cyan-600'}`}>{roomsState.filter(r => r.customer !== '').length} Active</div>
                  </div>
                  <div className="text-center md:border-r border-cyan-100">
                    <span className={`text-xs block ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Vacant Rooms</span>
                    <div className={`text-2xl font-bold mt-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{roomsState.filter(r => r.customer === '').length} Ready</div>
                  </div>
                  <div className="text-center">
                    <span className={`text-xs block ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Available Staff</span>
                    <div className={`text-2xl font-bold mt-1 ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`}>{unassignedStaff.length} Standby</div>
                  </div>
                </div>

                {roomZones.map((zone, idx) => (
                  <div key={idx} className="space-y-3">
                    <h4 className={`text-[11px] font-bold uppercase ${
                      isDarkMode ? 'text-slate-400 bg-slate-800 border-slate-700' : 'text-slate-500 bg-slate-100 border-slate-200'
                    } border px-3 py-1.5 rounded-lg w-fit tracking-wide`}>
                      {zone.icon} {zone.title}
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                      {roomsState.filter(r => r.id >= zone.min && r.id <= zone.max).map((room) => {
                        const assignedCrew = staffList.filter(s => s.assignment === `Room ${room.id}`);
                        const isOccupied = room.customer !== '';

                        return (
                          <div key={room.id} className={`${
                            isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
                          } border rounded-xl p-4 shadow-sm flex flex-col justify-between transition-all duration-200 hover:shadow-md ${
                            isOccupied ? 'border-cyan-500' : 'hover:border-slate-300'
                          }`}>
                            <div className="flex justify-between items-center border-b pb-2">
                              <span className={`font-bold text-sm ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Room Suite {room.id}</span>
                              <span className={`text-[8px] font-bold px-2 py-0.5 rounded-full ${
                                isOccupied ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-sm' : 'bg-slate-100 text-slate-400'
                              }`}>
                                {isOccupied ? 'RUNNING' : 'VACANT'}
                              </span>
                            </div>

                            <div className="mt-3 space-y-2 text-xs font-medium">
                              {isOccupied ? (
                                <div className={`${isDarkMode ? 'bg-slate-700 border-slate-600' : 'bg-slate-50 border-slate-200'} border rounded-lg p-2 space-y-1 text-[11px]`}>
                                  <p className={`font-semibold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Guest: <span className="underline">{room.customer}</span></p>
                                  <p className={isDarkMode ? 'text-slate-400' : 'text-slate-500'}>Type: {room.service}</p>
                                  <div className={`${isDarkMode ? 'text-cyan-400' : 'text-cyan-600'} font-bold pt-1 mt-1 border-t border-dashed ${isDarkMode ? 'border-slate-600' : 'border-slate-200'} flex items-center gap-1`}>
                                    <Clock size={10} /> Time Left: {room.timeLeft} mins
                                  </div>
                                </div>
                              ) : (
                                <p className={`${isDarkMode ? 'text-slate-500' : 'text-slate-400'} italic text-[11px] py-2`}>Ready for check-in</p>
                              )}

                              <div className="pt-2 border-t text-[10px]">
                                <span className={`${isDarkMode ? 'text-slate-400' : 'text-slate-400'} block uppercase font-semibold mb-1`}>Assigned Staff:</span>
                                {assignedCrew.length > 0 ? (
                                  assignedCrew.map((c, cIdx) => (
                                    <div key={cIdx} className={`font-semibold flex items-center gap-1.5 text-[11px] ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                                      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span> {c.name} ({c.role})
                                    </div>
                                  ))
                                ) : (
                                  <span className="text-[9px] font-semibold text-red-500 bg-red-50 rounded px-1.5 py-0.5 inline-block">Unstaffed</span>
                                )}
                              </div>
                            </div>

                            <div className="mt-4 pt-2 border-t">
                              {isOccupied && canAccess(currentUserRole, 'room_manage') ? (
                                <button onClick={() => handleEvacuateRoom(room.id)} className="w-full bg-red-50 hover:bg-red-100 text-red-600 font-semibold text-[11px] py-1.5 rounded-lg transition-all">
                                  Release Room
                                </button>
                              ) : !isOccupied && canAccess(currentUserRole, 'room_manage') ? (
                                <button disabled={unassignedStaff.length === 0} onClick={() => { setSelectedRoomId(room.id); setShowRoomModal(true); }} className={`w-full ${(
                                  unassignedStaff.length === 0 ?
                                  'bg-slate-100 text-slate-400 cursor-not-allowed' :
                                  'bg-slate-50 hover:bg-gradient-to-r hover:from-cyan-600 hover:to-blue-600 hover:text-white border border-slate-200'
                                )} font-semibold text-[11px] py-1.5 rounded-lg flex items-center justify-center space-x-1 transition-all`}>
                                  <Plus size={12} /> <span>Check-In</span>
                                </button>
                              ) : (
                                <span className="block text-center text-[10px] italic text-slate-400">Read-only view</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* INVENTORY TAB */}
            {canAccess(currentUserRole, 'inventory') && activeTab === 'inventory' && (
              <div className={`${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} border p-5 rounded-xl shadow-sm space-y-4`}>
                <div className="flex justify-between items-center border-b pb-3">
                  <div>
                    <h3 className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Product Warehouse Stock Registry</h3>
                    <p className={`text-xs font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-400'}`}>
                      {inventoryList.length} total items · {inventoryList.filter(i => i.quantity <= 5).length} low stock
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => exportToCSV(inventoryList, 'inventory')}
                      className={`border ${isDarkMode ? 'border-slate-700 hover:bg-slate-700 text-slate-400 hover:text-white' : 'border-slate-200 hover:bg-slate-50 text-slate-600'} font-medium text-xs px-3 py-2 rounded-xl flex items-center gap-1.5 transition-all`}
                    >
                      <Download size={14} /> Export
                    </button>
                    {canAccess(currentUserRole, 'inventory_manage') && <button onClick={() => setShowProductModal(true)} className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white font-medium text-xs px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-all shadow-md">
                      <Plus size={14} /> Add Product
                    </button>}
                  </div>
                </div>

                <div className={`${isDarkMode ? 'bg-slate-700/50 border-slate-700' : 'bg-gradient-to-r from-slate-50 to-slate-100/50 border-slate-200'} border p-3 rounded-xl flex flex-col md:flex-row items-center gap-3 text-xs font-semibold`}>
                  <div className="flex items-center gap-1 text-slate-600"><Filter size={13} /> <span>Filters:</span></div>

                  <div className="w-full md:w-44 space-y-0.5">
                    <span className="text-[10px] text-slate-400 block uppercase">Search</span>
                    <input type="text" placeholder="Search product..." value={productSearch} onChange={(e) => { setProductSearch(e.target.value); setProductPage(1); }} className={`w-full ${isDarkMode ? 'bg-slate-800 border-slate-600 text-white' : 'bg-white border-slate-200'} border p-1.5 rounded-lg outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all`} />
                  </div>

                  <div className="w-full md:w-40 space-y-0.5">
                    <span className="text-[10px] text-slate-400 block uppercase">Category</span>
                    <select value={productCategoryFilter} onChange={(e) => { setProductCategoryFilter(e.target.value); setProductPage(1); }} className={`w-full ${isDarkMode ? 'bg-slate-800 border-slate-600 text-white' : 'bg-white border-slate-200'} border p-1.5 rounded-lg font-medium outline-none focus:border-cyan-500`}>
                      <option value="All">All Categories</option>
                      <option value="Cosmetics">Cosmetics</option>
                      <option value="Supplies">Supplies</option>
                      <option value="Equipment">Equipment</option>
                    </select>
                  </div>

                  <div className="w-full md:w-40 space-y-0.5">
                    <span className="text-[10px] text-slate-400 block uppercase">Stock Level</span>
                    <select value={productStockFilter} onChange={(e) => { setProductStockFilter(e.target.value); setProductPage(1); }} className={`w-full ${isDarkMode ? 'bg-slate-800 border-slate-600 text-white' : 'bg-white border-slate-200'} border p-1.5 rounded-lg font-medium outline-none focus:border-cyan-500`}>
                      <option value="All">All Items</option>
                      <option value="Stable">Stable (&gt; 5)</option>
                      <option value="Low">Low Stock (&le; 5)</option>
                    </select>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className={`border-b ${isDarkMode ? 'border-slate-700 text-slate-400' : 'border-slate-200 text-slate-400'} text-xs font-semibold uppercase ${isDarkMode ? 'bg-slate-700/50' : 'bg-gradient-to-r from-slate-50 to-slate-100'}`}>
                        <th className="py-2.5 px-4">Product</th>
                        <th className="py-2.5 px-4">Category</th>
                        <th className="py-2.5 px-4">Quantity</th>
                        <th className="py-2.5 px-4">Price</th>
                        <th className="py-2.5 px-4 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${isDarkMode ? 'divide-slate-700' : 'divide-slate-100'}`}>
                      {paginatedProducts.map((item) => {
                        const stockLevel = item.quantity <= 0 ? 'out' : item.quantity <= 5 ? 'low' : 'high';
                        const stockColors = {
                          out: 'bg-red-100 text-red-700 border-red-200',
                          low: 'bg-orange-100 text-orange-700 border-orange-200',
                          high: 'bg-emerald-100 text-emerald-700 border-emerald-200'
                        };

                        return (
                          <tr key={item.id} className={isDarkMode ? 'hover:bg-slate-700/50' : 'hover:bg-slate-50/30'} transition-colors>
                            <td className={`py-3 px-4 font-semibold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{item.name}</td>
                            <td className="py-3 px-4">
                              <span className={`text-xs ${isDarkMode ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-600'} px-2 py-1 rounded-full`}>
                                {item.category}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-3">
                                <span className={`font-mono font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{item.quantity}</span>
                                <div className="flex-1 min-w-[40px]">
                                  <div className={`w-full ${isDarkMode ? 'bg-slate-700' : 'bg-slate-200'} rounded-full h-1.5`}>
                                    <div className={`h-1.5 rounded-full transition-all duration-500 ${
                                      stockLevel === 'low' ? 'bg-orange-500' : 'bg-emerald-500'
                                    }`} style={{ width: `${Math.min((item.quantity / 50) * 100, 100)}%` }} />
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className={`py-3 px-4 font-semibold ${isDarkMode ? 'text-cyan-400' : 'text-cyan-600'}`}>₱{item.price.toFixed(2)}</td>
                            <td className="py-3 px-4 text-center">
                              <span className={`text-[9px] font-bold px-2.5 py-1 rounded-full border ${stockColors[stockLevel]}`}>
                                {stockLevel === 'out' ? '🚫 OUT' : stockLevel === 'low' ? '🔴 LOW' : '🟢 STABLE'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                      {paginatedProducts.length === 0 && (
                        <tr><td colSpan="5" className={`text-center py-6 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'} italic`}>No products found.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className={`flex justify-between items-center border-t pt-3 text-xs font-semibold ${isDarkMode ? 'text-slate-400 border-slate-700' : 'text-slate-400 border-slate-100'}`}>
                  <div>Showing {paginatedProducts.length} of {filteredProducts.length} items</div>
                  <div className="flex items-center gap-1">
                    <button disabled={productPage === 1} onClick={() => setProductPage(productPage - 1)} className={`px-3 py-1 border rounded-lg ${isDarkMode ? 'border-slate-700 bg-slate-800 text-white hover:bg-slate-700' : 'border-slate-200 bg-white hover:bg-slate-50'} disabled:opacity-40 text-xs transition-all flex items-center gap-1`}>
                      <ChevronLeft size={12} /> Prev
                    </button>
                    {Array.from({ length: Math.min(totalProductPages, 5) }, (_, i) => {
                      const pageNum = i + 1;
                      return (
                        <button key={pageNum} onClick={() => setProductPage(pageNum)} className={`w-7 h-7 rounded-lg text-xs font-bold transition-all ${
                          productPage === pageNum ?
                          'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-sm' :
                          isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700' : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50'
                        }`}>
                          {pageNum}
                        </button>
                      );
                    })}
                    {totalProductPages > 5 && <span className="text-slate-400">...</span>}
                    <button disabled={productPage === totalProductPages} onClick={() => setProductPage(productPage + 1)} className={`px-3 py-1 border rounded-lg ${isDarkMode ? 'border-slate-700 bg-slate-800 text-white hover:bg-slate-700' : 'border-slate-200 bg-white hover:bg-slate-50'} disabled:opacity-40 text-xs transition-all flex items-center gap-1`}>
                      Next <ChevronRight size={12} />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* AUDIT LOGS TAB */}
            {canAccess(currentUserRole, 'audit') && activeTab === 'audit_controls' && (
              <div className={`${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} border p-5 rounded-xl shadow-sm space-y-4`}>
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Security Audit Log Records</h3>
                    <p className={`text-xs font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-400'}`}>System tracking log mapping security updates and modifications.</p>
                  </div>
                  <button
                    onClick={() => exportToCSV(auditLogs, 'audit_logs')}
                    className={`border ${isDarkMode ? 'border-slate-700 hover:bg-slate-700 text-slate-400 hover:text-white' : 'border-slate-200 hover:bg-slate-50 text-slate-600'} font-medium text-xs px-3 py-2 rounded-xl flex items-center gap-1.5 transition-all`}
                  >
                    <Download size={14} /> Export
                  </button>
                </div>

                <div className="relative w-full max-w-sm">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 text-slate-400"><Search size={13} /></span>
                  <input type="text" placeholder="Search logs..." value={auditSearch} onChange={(e) => { setAuditSearch(e.target.value); setAuditPage(1); }} className={`w-full ${isDarkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-slate-50 border-slate-200'} border pl-8 pr-3 py-1.5 text-xs rounded-lg outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all font-medium`} />
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className={`border-b ${isDarkMode ? 'border-slate-700 text-slate-400' : 'border-slate-200 text-slate-400'} text-xs font-semibold uppercase ${isDarkMode ? 'bg-slate-700/50' : 'bg-gradient-to-r from-slate-50 to-slate-100'}`}>
                        <th className="py-2.5 px-4">Timestamp</th>
                        <th className="py-2.5 px-4">Action</th>
                        <th className="py-2.5 px-4">Target</th>
                        <th className="py-2.5 px-4">Value</th>
                        <th className="py-2.5 px-4">Agent</th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${isDarkMode ? 'divide-slate-700' : 'divide-slate-100'}`}>
                      {paginatedAudits.map((log) => (
                        <tr key={log.id} className={isDarkMode ? 'hover:bg-slate-700/50' : 'hover:bg-slate-50/30'} transition-colors>
                          <td className={`py-3 px-4 font-mono ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{log.time}</td>
                          <td className="py-3 px-4">
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                              log.type === 'VOID' ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-amber-50 text-amber-600 border border-amber-100'
                            }`}>
                              {log.type}
                            </span>
                          </td>
                          <td className={`py-3 px-4 font-semibold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{log.target}</td>
                          <td className={`py-3 px-4 font-mono font-semibold ${isDarkMode ? 'text-cyan-400' : 'text-cyan-600'}`}>₱{log.value.toFixed(2)}</td>
                          <td className={`py-3 px-4 font-semibold ${isDarkMode ? 'text-slate-300' : 'text-slate-500'}`}>{log.agent}</td>
                        </tr>
                      ))}
                      {paginatedAudits.length === 0 && (
                        <tr><td colSpan="5" className={`text-center py-6 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'} italic`}>No audit records found.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className={`flex justify-between items-center border-t pt-3 text-xs font-semibold ${isDarkMode ? 'text-slate-400 border-slate-700' : 'text-slate-400 border-slate-100'}`}>
                  <div>Showing {paginatedAudits.length} of {filteredAudits.length} events</div>
                  <div className="flex items-center gap-1">
                    <button disabled={auditPage === 1} onClick={() => setAuditPage(auditPage - 1)} className={`px-3 py-1 border rounded-lg ${isDarkMode ? 'border-slate-700 bg-slate-800 text-white hover:bg-slate-700' : 'border-slate-200 bg-white hover:bg-slate-50'} disabled:opacity-40 text-xs transition-all flex items-center gap-1`}>
                      <ChevronLeft size={12} /> Prev
                    </button>
                    {Array.from({ length: Math.min(totalAuditPages, 5) }, (_, i) => {
                      const pageNum = i + 1;
                      return (
                        <button key={pageNum} onClick={() => setAuditPage(pageNum)} className={`w-7 h-7 rounded-lg text-xs font-bold transition-all ${
                          auditPage === pageNum ?
                          'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-sm' :
                          isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700' : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50'
                        }`}>
                          {pageNum}
                        </button>
                      );
                    })}
                    {totalAuditPages > 5 && <span className="text-slate-400">...</span>}
                    <button disabled={auditPage === totalAuditPages} onClick={() => setAuditPage(auditPage + 1)} className={`px-3 py-1 border rounded-lg ${isDarkMode ? 'border-slate-700 bg-slate-800 text-white hover:bg-slate-700' : 'border-slate-200 bg-white hover:bg-slate-50'} disabled:opacity-40 text-xs transition-all flex items-center gap-1`}>
                      Next <ChevronRight size={12} />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* PRODUCT MANAGEMENT ROUTES - ✅ WALA NA ANG PANGANAN MENU DITO */}
           <Routes>
  <Route path="/vss-services" element={canAccess(currentUserRole, 'catalog') ?
    <CrudTable
      title="VSS Services"
      apiEndpoint="vss-services"
      columns={['Category', 'Description', 'Price']}
      isDarkMode={isDarkMode}
      readOnly={!canAccess(currentUserRole, 'catalog_manage')}
    />
    : <AccessDenied />
  } />
  <Route path="/vreal-products" element={canAccess(currentUserRole, 'catalog') ?
    <CrudTable
      title="VREAL Products"
      apiEndpoint="vreal-products"
      columns={['Category', 'Product', 'Price']}
      isDarkMode={isDarkMode}
      readOnly={!canAccess(currentUserRole, 'catalog_manage')}
    />
    : <AccessDenied />
  } />
  <Route path="/bb-products" element={canAccess(currentUserRole, 'catalog') ?
    <CrudTable
      title="BB Products"
      apiEndpoint="bb-products"
      columns={['Product Name', 'Price']}
      isDarkMode={isDarkMode}
      readOnly={!canAccess(currentUserRole, 'catalog_manage')}
    />
    : <AccessDenied />
  } />
  {/* ❌ TANGGALIN ANG PANGANAN MENU ROUTE */}
</Routes>

          </div>
        </main>
      </div>
    </BrowserRouter>
  );
}