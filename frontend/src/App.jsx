import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import CrudTable from './components/CrudTable';
import SalesPage from './components/SalesPage';
import ClientsPage from './components/ClientsPage';
import AdministrationPage from './components/AdministrationPage';
import CashierPOS from './components/CashierPOS';
import CustomersRewardsPage from './components/CustomersRewardsPage';
import DocumentationPage from './components/DocumentationPage';
import {
  applyBusinessHeader, getActiveBusinessSlug, getGrantedBusinesses,
  rememberBusinesses, forgetBusinessContext, setActiveBusiness,
} from './utils/session';
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL as SHARED_API_BASE_URL } from './utils/api';
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
  Download, Loader2, Sun, Moon, Settings,
  CreditCard, ShoppingBag, Scissors,
  Crown, BookOpen, Building2
} from 'lucide-react';

// ============ API CONFIGURATION ============
// Origin comes from VITE_API_BASE_URL (see utils/api.js); the fallback keeps a
// fresh clone runnable. The old copy here used `localhost` while every other
// page used `127.0.0.1` — the same backend, two very different hosts.
const API_BASE_URL = SHARED_API_BASE_URL;

// One-click sign-in shortcuts. These mirror the demo accounts created by
// `manage.py create_demo_users` — one per seeded role, so each login shows a
// different dashboard. SUPERADMIN (platform operator) and OWNER (company owner)
// are separate roles: same wildcard, different denied actions.
// 2026-10-01: the Company Admin, Accountant and Supervisor nodes were removed
// together with their demo accounts. The roles stay in UserAccess.ROLE_CHOICES
// and remain assignable in Administration; only the one-click nodes are gone.
const DEMO_ACCOUNTS = {
  'Superadmin': { username: 'demo_superadmin', password: 'DemoSuperadmin!2026' },
  'Owner': { username: 'demo_owner', password: 'DemoOwner!2026' },
  'Business Manager': { username: 'demo_business_manager', password: 'DemoBusinessManager!2026' },
  'Cashier': { username: 'demo_cashier', password: 'DemoCashier!2026' },
  'Staff': { username: 'demo_staff', password: 'DemoStaff!2026' },
};

// Full demo-login roster as created by `manage.py reseed_demo` (mirrors
// DEMO_LOGINS.md, one cashier + two staff per branch). The dropdown above
// keeps the five role-picks; this directory feeds the browsable panel on the
// login screen so every generated account is discoverable without the file.
// Deterministic seeds — re-running reseed_demo reproduces the same names.
const MGR_PW = 'DemoManager!2026';
const CASHIER_PW = 'DemoCashier!2026';
const STAFF_PW = 'DemoStaff!2026';
const DEMO_DIRECTORY = [
  {
    group: 'Company',
    accounts: [
      { label: 'Owner · all businesses', username: 'demo_owner', password: 'DemoOwner!2026' },
      { label: 'Superadmin · platform', username: 'demo_superadmin', password: 'DemoSuperadmin!2026' },
    ],
  },
  {
    group: 'Villareal Spa Services',
    accounts: [
      { label: 'Manager · all branches', username: 'demo_business_manager', password: 'DemoBusinessManager!2026' },
      { label: 'Cashier · Main', username: 'demo_cashier', password: CASHIER_PW },
      { label: 'Staff 1 · Main', username: 'demo_staff', password: STAFF_PW },
      { label: 'Staff 2 · Main', username: 'staff_vss_main_2', password: STAFF_PW },
      { label: 'Cashier · Diamond', username: 'cashier_vss_dia', password: CASHIER_PW },
      { label: 'Staff 1 · Diamond', username: 'staff_vss_dia_1', password: STAFF_PW },
      { label: 'Staff 2 · Diamond', username: 'staff_vss_dia_2', password: STAFF_PW },
    ],
  },
  {
    group: 'VReal Products',
    accounts: [
      { label: 'Manager · all branches', username: 'bm_vreal', password: MGR_PW },
      { label: 'Cashier · Main', username: 'cashier_vreal_main', password: CASHIER_PW },
      { label: 'Staff 1 · Main', username: 'staff_vreal_main_1', password: STAFF_PW },
      { label: 'Staff 2 · Main', username: 'staff_vreal_main_2', password: STAFF_PW },
      { label: 'Cashier · Ayala', username: 'cashier_vreal_ayl', password: CASHIER_PW },
      { label: 'Staff 1 · Ayala', username: 'staff_vreal_ayl_1', password: STAFF_PW },
      { label: 'Staff 2 · Ayala', username: 'staff_vreal_ayl_2', password: STAFF_PW },
    ],
  },
  {
    group: 'BB Retail',
    accounts: [
      { label: 'Manager · all branches', username: 'bm_bb', password: MGR_PW },
      { label: 'Cashier · Main', username: 'cashier_bb_main', password: CASHIER_PW },
      { label: 'Staff 1 · Main', username: 'staff_bb_main_1', password: STAFF_PW },
      { label: 'Staff 2 · Main', username: 'staff_bb_main_2', password: STAFF_PW },
    ],
  },
  {
    group: 'Panganan Menu',
    accounts: [
      { label: 'Manager · all branches', username: 'bm_panganan', password: MGR_PW },
      { label: 'Cashier · Main', username: 'cashier_panganan_main', password: CASHIER_PW },
      { label: 'Staff 1 · Main', username: 'staff_panganan_main_1', password: STAFF_PW },
      { label: 'Staff 2 · Main', username: 'staff_panganan_main_2', password: STAFF_PW },
    ],
  },
  {
    group: 'KB Items · no branch',
    accounts: [
      { label: 'Manager · business-wide', username: 'bm_kb', password: MGR_PW },
      { label: 'Cashier · business-wide', username: 'cashier_kb', password: CASHIER_PW },
      { label: 'Staff 1 · business-wide', username: 'staff_kb_1', password: STAFF_PW },
      { label: 'Staff 2 · business-wide', username: 'staff_kb_2', password: STAFF_PW },
    ],
  },
  {
    group: 'Auto Spa Services',
    accounts: [
      { label: 'Manager · all branches', username: 'bm_autospa', password: MGR_PW },
      { label: 'Cashier · Main', username: 'cashier_autospa_main', password: CASHIER_PW },
      { label: 'Staff 1 · Main', username: 'staff_autospa_main_1', password: STAFF_PW },
      { label: 'Staff 2 · Main', username: 'staff_autospa_main_2', password: STAFF_PW },
    ],
  },
];

// Which role code each demo node / directory row stands for. The quick-pick
// map names it explicitly; the 32 directory rows carry labels that always
// start with the role word ("Cashier · Main"), so their code is derived —
// one statement of the mapping instead of thirty-two hand-copied ones.
const DEMO_ACCOUNT_ROLES = {
  'Superadmin': 'SUPERADMIN',
  'Owner': 'OWNER',
  'Business Manager': 'BUSINESS_MANAGER',
  'Cashier': 'CASHIER',
  'Staff': 'STAFF',
};

const roleCodeFromLabel = (label) => {
  const first = String(label || '').split('·')[0].trim().toLowerCase().split(/\s+/)[0];
  if (first === 'manager') return 'BUSINESS_MANAGER';
  return Object.values(DEMO_ACCOUNT_ROLES).find((code) => code.toLowerCase() === first) || '';
};

// Capabilities and role list come from GET /auth/capabilities/, which derives
// them from the live ROLE_ACTIONS matrix. This client used to carry its own
// ROLE_CAPABILITIES copy, free to drift from the server's policy; now it holds
// only what the caller is actually allowed, and falls back to "show nothing
// privileged" until that request resolves.
const ROLE_CAPABILITIES = {};

/**
 * The nav entries, used only as a safety net.
 *
 * If /auth/capabilities/ cannot be reached we do NOT lock the operator out of a
 * blank shell: every action is still authorized server-side, so showing the nav
 * costs nothing security-wise and avoids a dead UI. Capability checks stay
 * "closed" while the real list is in flight.
 */
const FALLBACK_CAPABILITIES = [
  'dashboard', 'sales', 'clients', 'client_manage', 'customer_rewards',
  'administration', 'users', 'user_manage', 'rooms', 'room_manage',
  'inventory', 'inventory_manage', 'catalog', 'catalog_manage', 'audit',
  'documentation',
];

/** Only used if /auth/capabilities/ is unreachable; the API has the real list. */
const FALLBACK_ROLE_OPTIONS = [
  { code: 'CASHIER', label: 'Cashier' },
  { code: 'STAFF', label: 'Staff' },
  { code: 'SUPERVISOR', label: 'Supervisor' },
  { code: 'BUSINESS_MANAGER', label: 'Business Manager' },
];

/** Company-wide roles must NOT carry a branch (UserAccess check constraint). */
const COMPANY_ROLE_CODES = new Set(['SUPERADMIN', 'OWNER', 'COMPANY_ADMIN', 'ACCOUNTANT']);
const isCompanyWideRole = (label) => COMPANY_ROLE_CODES.has(
  String(label || '').replace(/[\s_]+/g, '_').toUpperCase(),
);

/**
 * 'BUSINESS_MANAGER' -> 'Business Manager'.
 *
 * The login payload exposes roles as a display name (the backend does
 * `role.replace('_', ' ').title()`) while /auth/capabilities/ reports the
 * canonical code. Keys are stored under both so a lookup by either matches.
 */
const displayRole = (role) =>
  String(role || '').replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

const canAccess = (role, capability) => {
  if (!role) return false;
  const caps = ROLE_CAPABILITIES[role] ?? ROLE_CAPABILITIES[displayRole(role)];
  return Array.isArray(caps) ? caps.includes(capability) : false;
};

// The shared client already attaches `Authorization` and `X-Business`; this
// instance only adds a request timeout.
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 10000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');
  if (token) config.headers.Authorization = `Token ${token}`;
  // Scope every call to the business the user last picked (backend resolves it per request).
  return applyBusinessHeader(config);
});

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
    { id: 'customer_rewards', label: 'Customer Rewards', icon: <Crown size={16} /> },
    { id: 'administration', label: 'Administration', icon: <Settings size={16} /> },
    { id: 'users', label: 'User Profiling', icon: <Users size={16} /> },
    { id: 'rooms', label: 'Room Status', icon: <DoorOpen size={16} /> },
    { id: 'inventory', label: 'Inventory', icon: <Package size={16} /> },
    { id: 'audit_controls', label: 'Audit Logs', icon: <ShieldAlert size={16} /> },
    { id: 'documentation', label: 'Documentation', icon: <BookOpen size={16} /> },
  ].filter((item) => canAccess(currentUserRole, item.id === 'audit_controls' ? 'audit' : item.id));

  // The seven per-catalog pages collapsed into one unified catalog (Phase 3);
  // these routes used to point at the retired /vss-services/ etc. shims.
  const productMenus = [
    { path: '/catalog/services', label: 'Services', icon: <Scissors size={14} /> },
    { path: '/catalog/products', label: 'Products', icon: <ShoppingBag size={14} /> },
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
        <button
          onClick={toggleDarkMode}
          className={`w-full ${
            isDarkMode ? 'bg-slate-800/50 hover:bg-slate-700/50 text-slate-400 hover:text-white' : 'bg-slate-800/50 hover:bg-slate-700/50 text-slate-400 hover:text-white'
          } font-semibold text-xs p-2.5 rounded-xl flex items-center ${sidebarCollapsed ? 'justify-center' : 'justify-start'} space-x-2 transition-all duration-200 border border-slate-700/50`}
        >
          {isDarkMode ? <Sun size={14} /> : <Moon size={14} />}
          {!sidebarCollapsed && <span>{isDarkMode ? 'Light Mode' : 'Dark Mode'}</span>}
        </button>

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

  // --- FULL SCREEN POS MODE ---
  const [isPOSFullScreen, setIsPOSFullScreen] = useState(false);

  // --- SYSTEM LOGIC & SESSION STATES ---
  const [isLoggedIn, setIsLoggedIn] = useState(() => Boolean(
    localStorage.getItem('authToken') && localStorage.getItem('authUser')
  ));
  // Default to the first demo account. Deriving from the list (rather than
  // naming a key) means renaming or reordering a demo account can never leave
  // `loginForm` undefined and crash the login screen.
  const [loginForm, setLoginForm] = useState(
    () => Object.values(DEMO_ACCOUNTS)[0] || { username: '', password: '' }
  );
  const [loginError, setLoginError] = useState('');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  // Role comes from the signed-in account only. This used to fall back to a
  // hardcoded 'Superadmin' when nothing was stored, which made the header show
  // a role before the real one arrived and then flip. Empty until known, and
  // canAccess() treats an empty role as "no capabilities", so nothing privileged
  // is shown before the real role arrives.
  const [currentUserRole, setCurrentUserRole] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('authUser'))?.role || '';
    } catch {
      return '';
    }
  });
  // Kept for the header badge, which keys off `role_code` — the SUPERADMIN role
  // is distinct from OWNER, and distinct again from Django's is_superuser flag.
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('authUser')) || {};
    } catch {
      return {};
    }
  });

  // --- ACTIVE BUSINESS (what X-Business sends) ---
  // The login payload lists every Business this account may open; the chosen slug is kept
  // in localStorage so all seven axios instances attach it without prop drilling.
  const [grantedBusinesses, setGrantedBusinesses] = useState(getGrantedBusinesses);
  const [storedBusiness, setStoredBusiness] = useState(getActiveBusinessSlug);

  // Derived instead of re-synced: if a grant was revoked between sessions, the render falls
  // back to the first remaining business so an invalid slug is never sent to the backend.
  const activeBusiness = grantedBusinesses.length && !grantedBusinesses.some((b) => b.slug === storedBusiness)
    ? (grantedBusinesses[0].slug || '')
    : storedBusiness;

  // Keeps localStorage aligned with the derived slug - writes only, no state update.
  useEffect(() => {
    setActiveBusiness(activeBusiness);
  }, [activeBusiness]);

  const chooseBusiness = (slug) => {
    setActiveBusiness(slug);
    setStoredBusiness(slug);
  };

  useEffect(() => {
    const capability = activeTab === 'audit_controls' ? 'audit' : activeTab;
    if (activeTab !== 'dashboard' && !canAccess(currentUserRole, capability)) {
      setActiveTab('dashboard');
    }
  }, [activeTab, currentUserRole]);

  // Auto-exit full screen when leaving Sales tab
  useEffect(() => {
    if (activeTab !== 'sales' && isPOSFullScreen) {
      setIsPOSFullScreen(false);
    }
  }, [activeTab]);

  // F11 keyboard shortcut for full screen POS (Cashier only)
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'F11' && (currentUserRole === 'Cashier' || currentUserRole === 'CASHIER')) {
        e.preventDefault();
        setIsPOSFullScreen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [currentUserRole]);

  const togglePOSFullScreen = () => setIsPOSFullScreen(prev => !prev);

  const [selectedProfileUser, setSelectedProfileUser] = useState(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSavingProduct, setIsSavingProduct] = useState(false);

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
    name: '', address: '', age: '', gender: 'Female', role: 'Cashier', branch: '',
    email: '', phone: '', startDate: new Date().toISOString().split('T')[0]
  });
  const [roomForm, setRoomForm] = useState({
    staffId: '', customerName: '', serviceType: 'Pedicure & Manicure', minutes: '30'
  });
  // Outlets of the active business + the role list, both read from the API so the
  // "add user" form can never offer a retired role or omit a required outlet.
  const [branches, setBranches] = useState([]);
  const [roleOptions, setRoleOptions] = useState([]);
  const [productForm, setProductForm] = useState({
    name: '', category: 'Cosmetics', quantity: '', price: ''
  });

  // --- DEFAULT DATA REGISTRIES ---
  // These were hardcoded demo rows (fake staff, fake products, fake receipts,
  // fake rooms, fake charts). Every one now comes from the API via loadFromApi
  // below, scoped by the active business, and starts empty so the UI can never
  // show invented data.
  const [staffList, setStaffList] = useState([]);

  const [inventoryList, setInventoryList] = useState([]);

  const [auditLogs, setAuditLogs] = useState([]);

  const [roomsState, setRoomsState] = useState([]);
  // Room sections are derived from the rooms that actually exist, grouped by
  // their type — previously three hardcoded zones of five.
  const [roomZones, setRoomZones] = useState([]);

  // --- CHART DATA ---
  // Populated from /dashboard/summary/ (the caller's own scoped sales) and
  // /catalog/items/ (category names), not from a hardcoded series.
  const [revenueTrend, setRevenueTrend] = useState([]);
  const [popularServices, setPopularServices] = useState([]);

  const CHART_COLORS = ['#0ea5e9', '#ec4899', '#10b981', '#f59e0b', '#8b5cf6'];
  const [productDistribution, setProductDistribution] = useState([]);
  const [dashboard, setDashboard] = useState({});
  const [, setCapabilitiesTick] = useState(0);

  const activeCount = staffList.filter(s => s.status === 'Active').length;
  const deactivatedCount = staffList.filter(s => s.status === 'Deactivated').length;
  // staffList is populated from the API, so it starts empty: guard the
  // percentage or the chart legend reads "NaN%".
  const pct = (count) => (staffList.length ? `${Math.round((count / staffList.length) * 100)}%` : '0%');

  const userStatusDistribution = [
    { name: 'Active Users', value: activeCount, color: '#06b6d4', percentage: pct(activeCount) },
    { name: 'Deactivated', value: deactivatedCount, color: '#f43f5e', percentage: pct(deactivatedCount) }
  ];

  const lowStockItemsCount = inventoryList.filter(item => item.quantity <= 5).length;
  const occupiedRoomsCount = roomsState.filter(r => r.customer !== '').length;
  // Real figure from the dashboard summary, not a typed-in constant.
  const totalSales = Number(dashboard.month_sales || 0);

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
          if (room.timeLeft > 0) return { ...room, timeLeft: room.timeLeft - 1 };
          else if (room.timeLeft === 0 && room.customer !== '') return { ...room, customer: '', service: '', timeLeft: 0, startTime: null };
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

  // --- API DATA LOADER ---
  // Every page in this shell reads from the API. Previously these lists were
  // hardcoded demo rows, so the dashboard, users, inventory, rooms and audit
  // tabs all rendered invented data that never touched the database. Each
  // response is mapped into the shape the existing render code expects, so the
  // UI is unchanged — only the source is now real and business-scoped.
  useEffect(() => {
    if (!isLoggedIn) return undefined;
    let cancelled = false;

    // Accepts a settled promise and returns its unwrapped list ([] on failure),
    // so one failing endpoint cannot blank out the whole shell.
    const val = (settled) => {
      if (settled.status !== 'fulfilled') return null;
      const data = settled.value?.data;
      return data?.results ?? data ?? [];
    };

    const load = async () => {
      try {
        const [dash, staffRes, itemRes, levelRes, auditRes, roomRes, capsRes] = await Promise.allSettled([
          api.get('/dashboard/summary/'),
          api.get('/user-profiles/'),
          api.get('/catalog/items/?item_type=PRODUCT'),
          api.get('/catalog/inventory/'),
          api.get('/audit-logs/'),
          api.get('/rooms/'),
          api.get('/auth/capabilities/'),
        ]);
        if (cancelled) return;

        const dashData = (dash.status === 'fulfilled' && dash.value?.data) || {};
        setDashboard(dashData);

        // The nav is gated by whatever the server says this role may do.
        if (capsRes.status === 'fulfilled' && capsRes.value?.data) {
          const { role, capabilities } = capsRes.value.data;
          Object.keys(ROLE_CAPABILITIES).forEach((key) => delete ROLE_CAPABILITIES[key]);
          // Key under the canonical code *and* the display name, because the
          // shell's nav checks the latter (it comes from the login payload).
          ROLE_CAPABILITIES[role] = capabilities;
          ROLE_CAPABILITIES[displayRole(role)] = capabilities;
        } else {
          // Capabilities unreachable — show the nav rather than a dead shell.
          // The API still authorizes every request, so this hides nothing.
          Object.keys(ROLE_CAPABILITIES).forEach((key) => delete ROLE_CAPABILITIES[key]);
          ROLE_CAPABILITIES[currentUserRole] = FALLBACK_CAPABILITIES;
        }
        setCapabilitiesTick((tick) => tick + 1); // re-render the gated nav

        // Outlets + the role vocabulary for the "add user" form.
        const [branchRes, rolesRes] = await Promise.allSettled([
          api.get('/branches/'),
          api.get('/auth/capabilities/'),
        ]);
        if (!cancelled) {
          setBranches((val(branchRes) || []).map((b) => ({ id: b.id, name: b.name })));
          const roles = rolesRes.status === 'fulfilled' ? rolesRes.value?.data?.roles : null;
          if (Array.isArray(roles) && roles.length) setRoleOptions(roles);
        }
        setRevenueTrend(
          (dashData.revenue_trend || []).map((row) => ({
            day: row.label,
            Sales: Number(row.sales || 0),
            Expenses: Number(row.expenses || 0),
          })),
        );
        setPopularServices(
          (dashData.top_services || []).map((row, index) => ({
            name: row.name,
            Bookings: row.quantity,
            fill: CHART_COLORS[index % CHART_COLORS.length],
          })),
        );

        setStaffList(
          (val(staffRes) || []).map((profile) => ({
            id: profile.id,
            name: [profile.first_name, profile.last_name].filter(Boolean).join(' ') || profile.username,
            username: profile.username,
            address: '',
            age: null,
            gender: '',
            role: profile.role_display || profile.role || 'STAFF',
            status: profile.is_active ? 'Active' : 'Deactivated',
            assignment: profile.branch_name || 'Unassigned',
            email: profile.email || '',
            phone: profile.phone_number || '',
            startDate: profile.created_at || '',
            history: [],
            avatar: (profile.first_name?.[0] || profile.username?.[0] || '?').toUpperCase(),
          })),
        );

        const items = val(itemRes) || [];
        const levels = val(levelRes) || [];
        const stockByItem = levels.reduce((acc, level) => {
          acc[level.item] = (acc[level.item] || 0) + Number(level.stock_qty || 0);
          return acc;
        }, {});
        setInventoryList(
          items.map((item) => ({
            id: item.id,
            name: item.name,
            category: item.category_name || '',
            quantity: stockByItem[item.id] || 0,
            price: Number(item.selling_price || 0),
            sku: item.sku || '',
          })),
        );
        // Pie chart: real stock value grouped by category.
        const byCategory = items.reduce((acc, item) => {
          const key = item.category_name || 'Uncategorised';
          acc[key] = (acc[key] || 0) + (stockByItem[item.id] || 0);
          return acc;
        }, {});
        const total = Object.values(byCategory).reduce((sum, n) => sum + n, 0);
        setProductDistribution(
          Object.entries(byCategory)
            .map(([name, value], index) => ({
              name,
              value,
              color: CHART_COLORS[index % CHART_COLORS.length],
              percentage: total ? `${Math.round((value / total) * 100)}%` : '0%',
            }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 5),
        );

        setAuditLogs(
          (val(auditRes) || []).map((log) => ({
            id: log.id,
            time: log.created_at,
            type: log.action,
            target: log.description || log.model_name,
            // AuditLog has no money column; the request id is the traceable ref.
            request: log.request_id || log.ip_address || '',
            agent: log.user_name || 'system',
          })),
        );

        const rooms = val(roomRes) || [];
        setRoomsState(
          rooms.map((room) => ({
            id: room.id,
            type: room.room_type || room.name,
            customer: room.customer_name || '',
            service: room.service_type || room.item_name || '',
            timeLeft: room.time_remaining || 0,
            startTime: room.start_time || null,
            // Kept so the crew panel can match staff by the outlet they are
            // assigned to; staff carry a branch name, not a "Room N" label.
            branch: room.branch,
            branchName: room.branch_name || '',
          })),
        );
        // Sections follow the rooms that exist, grouped by their real type.
        const zones = [];
        rooms.forEach((room) => {
          const title = room.room_type || room.name || 'Rooms';
          const existing = zones.find((zone) => zone.title === title);
          if (existing) existing.ids.push(room.id);
          else zones.push({ title, ids: [room.id] });
        });
        setRoomZones(
          zones.map((zone) => ({
            title: zone.title,
            ids: zone.ids,
            min: Math.min(...zone.ids),
            max: Math.max(...zone.ids),
          })),
        );
      } catch (error) {
        if (!cancelled) setLoginError(error?.response?.data?.detail || 'Unable to load dashboard data.');
      }
    };

    load();
    return () => { cancelled = true; };
  }, [isLoggedIn, storedBusiness]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setLoginError('');
    try {
      const response = await api.post('/auth/login/', loginForm);
      localStorage.setItem('authToken', response.data.token);
      localStorage.setItem('authUser', JSON.stringify(response.data.user));
      setCurrentUser(response.data.user || {});
      const granted = Array.isArray(response.data.businesses) ? response.data.businesses : [];
      const primarySlug = response.data.primary_business?.slug || granted[0]?.slug || '';
      rememberBusinesses(granted, primarySlug);
      setGrantedBusinesses(granted);
      setStoredBusiness(primarySlug);
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
    forgetBusinessContext();
    setGrantedBusinesses([]);
    setStoredBusiness('');
    setIsLoggedIn(false);
    setLoginForm({ username: '', password: '' });
    setLoginError('');
    setIsPOSFullScreen(false);
    // Clear the role too, or the header keeps showing the previous account's.
    setCurrentUserRole('');
    setCurrentUser({});
  };

  // Which demo account the picker has highlighted. Deliberately *not*
  // `currentUserRole`: that is the role the server reports after a successful
  // login, which shares no values with these labels, so binding the select to
  // it left the dropdown blank and out of sync.
  const [demoSelection, setDemoSelection] = useState(() => Object.keys(DEMO_ACCOUNTS)[0] || '');

  // Role guide (GET /auth/role-guide/, derived server-side from the live
  // ROLE_ACTIONS matrix). The login screen previews the selected demo role
  // with it, and the dashboard shows the signed-in account its own panel —
  // both read the same payload, so neither restates role policy locally.
  const [roleGuides, setRoleGuides] = useState({});
  const [previewRole, setPreviewRole] = useState(
    () => DEMO_ACCOUNT_ROLES[Object.keys(DEMO_ACCOUNTS)[0]] || '',
  );
  const [myAccessOpen, setMyAccessOpen] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api.get('/auth/role-guide/')
      .then((response) => {
        if (cancelled) return;
        // Keyed by role code — the shape the endpoint declares; an array of
        // guides is still tolerated so a rollback of either side can't
        // silently blank the card/panel.
        const guides = response.data?.guides;
        const list = Array.isArray(guides) ? guides : Object.values(guides ?? {});
        const map = {};
        list.forEach((guide) => { map[guide.role] = guide; });
        setRoleGuides(map);
      })
      .catch(() => { /* guide is a convenience; it stays hidden if unreachable */ });
    return () => { cancelled = true; };
  }, []);

  const handleDemoRoleChange = (event) => {
    const role = event.target.value;
    setDemoSelection(role);
    setPreviewRole(DEMO_ACCOUNT_ROLES[role] || '');
    const account = DEMO_ACCOUNTS[role];
    if (account) {
      setLoginForm(account);
      setLoginError('');
    }
  };

  // ---- reload helpers (shared by the data-loading effect and the write handlers,
  // so a write can never leave the table showing a shape the API didn't return) ----
  /** Unwrap a DRF list response (paginated or not) into an array. */
  const apiList = (res) => {
    const data = res?.data;
    return Array.isArray(data) ? data : (data?.results ?? []);
  };

  const apiErrorMessage = (err, fallback = 'Something went wrong. Please try again.') => {
    const data = err?.response?.data;
    if (typeof data === 'string' && data) return data;
    if (data && typeof data === 'object') {
      const first = Object.values(data)[0];
      if (typeof first === 'string') return first;
      if (Array.isArray(first) && first[0]) return String(first[0]);
    }
    return fallback;
  };

  const mapProfiles = (profiles) => profiles.map((profile) => ({
    id: profile.id,
    name: [profile.first_name, profile.last_name].filter(Boolean).join(' ') || profile.username,
    username: profile.username,
    address: '',
    age: null,
    gender: '',
    role: profile.role_display || profile.role || 'STAFF',
    status: profile.is_active ? 'Active' : 'Deactivated',
    assignment: profile.branch_name || 'Unassigned',
    email: profile.email || '',
    phone: profile.phone_number || '',
    startDate: profile.created_at || '',
    history: [],
    // Needed by the forms: the room booking posts assigned_staff (a User id),
    // and editing a user must show the outlet their grant already names.
    userId: profile.user_id ?? profile.user ?? null,
    branchId: profile.branch || '',
    avatar: (profile.first_name?.[0] || profile.username?.[0] || '?').toUpperCase(),
  }));

  const reloadStaffList = async () => {
    const res = await api.get('/user-profiles/');
    return mapProfiles(apiList(res));
  };

  const reloadRooms = async () => {
    const res = await api.get('/rooms/');
    return (apiList(res)).map((room) => ({
      id: room.id,
      type: room.room_type || room.name,
      customer: room.customer_name || '',
      service: room.service_type || room.item_name || '',
      timeLeft: room.time_remaining || 0,
      startTime: room.start_time || null,
      // Kept so the crew panel can match staff by the outlet they are
      // assigned to; staff carry a branch name, not a "Room N" label.
      branch: room.branch,
      branchName: room.branch_name || '',
    }));
  };

  const reloadCatalog = async () => {
    const [itemRes, levelRes] = await Promise.all([
      api.get('/catalog/items/?item_type=PRODUCT'),
      api.get('/catalog/inventory/'),
    ]);
    const items = apiList(itemRes);
    const stockByItem = (apiList(levelRes)).reduce((acc, level) => {
      acc[level.item] = (acc[level.item] || 0) + Number(level.stock_qty || 0);
      return acc;
    }, {});
    return items.map((item) => ({
      id: item.id,
      name: item.name,
      category: item.category_name || '',
      quantity: stockByItem[item.id] || 0,
      price: Number(item.selling_price || 0),
      sku: item.sku || '',
    }));
  };

  const handleSaveUser = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      // Persist to the server first. `UserProfileSerializer` already accepts this
      // legacy SPA shape (name/role/branch) and turns it into a UserAccess grant,
      // so the row survives a reload instead of vanishing with the tab.
      const payload = {
        name: userForm.name,
        email: userForm.email,
        phone_number: userForm.phone,
        role: userForm.role,
      };
      // Outlet roles need a branch; company-wide roles must omit it entirely
      // (the backend rejects a business id on those grants).
      if (!isCompanyWideRole(userForm.role)) {
        if (!userForm.branch) {
          triggerSweetAlert('error', 'Outlet Required', 'Cashier and Staff accounts must be assigned to an outlet.');
          setIsLoading(false);
          return;
        }
        payload.branch = Number(userForm.branch);
      }
      await (editingUser
        ? api.patch(`/user-profiles/${editingUser.id}/`, payload)
        : api.post('/user-profiles/', payload));
      setStaffList(await reloadStaffList());
      triggerSweetAlert('success', editingUser ? 'User Updated' : 'User Added',
        editingUser
          ? `Successfully updated the profile of ${userForm.name}`
          : `${userForm.name} has been added to the system.`);
      if (editingUser) setEditingUser(null);
      setShowUserModal(false);
      setUserForm({ name: '', address: '', age: '', gender: 'Female', role: 'Cashier', branch: '', email: '', phone: '', startDate: new Date().toISOString().split('T')[0] });
    } catch (err) {
      triggerSweetAlert('error', 'Could Not Save', apiErrorMessage(err, 'The profile was not saved.'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddProduct = async (e) => {
    e.preventDefault();
    setIsSavingProduct(true);
    try {
      await api.post('/catalog/items/', {
        item_type: 'PRODUCT',
        name: productForm.name,
        selling_price: productForm.price || '0',
        tracks_stock: true,
        is_active: true,
        attributes: { quantity: parseInt(productForm.quantity) || 0 },
      });
      await reloadCatalog();
      setShowProductModal(false);
      setProductForm({ name: '', category: 'Cosmetics', quantity: '', price: '' });
      triggerSweetAlert('success', 'Product Added', 'The item has been added to the inventory.');
    } catch (err) {
      triggerSweetAlert('error', 'Could Not Add Product', apiErrorMessage(err, 'The item was not added.'));
    } finally {
      setIsSavingProduct(false);
    }
  };

  const toggleUserStatus = async (id, currentStatus) => {
    const nextStatus = currentStatus === 'Active' ? 'Deactivated' : 'Active';
    const target = staffList.find((s) => s.id === id);
    if (!target?.username) {
      triggerSweetAlert('error', 'Not Available', 'This staff record has no account to update.');
      return;
    }
    try {
      // is_active lives on the Django user, not the profile.
      await api.patch(`/user-profiles/${id}/`, { is_active: nextStatus === 'Active' });
      setStaffList(staffList.map((s) => (s.id === id ? { ...s, status: nextStatus } : s)));
      triggerSweetAlert('info', 'Status Changed', `User state has been set to ${nextStatus}.`);
    } catch (err) {
      triggerSweetAlert('error', 'Could Not Change Status', apiErrorMessage(err));
    }
  };

  const initEditUser = (user) => {
    setEditingUser(user);
    setUserForm({ name: user.name, address: user.address, age: user.age, gender: user.gender, role: user.role, branch: user.branchId || '', email: user.email || '', phone: user.phone || '', startDate: user.startDate || new Date().toISOString().split('T')[0] });
    setShowUserModal(true);
  };

  const viewUserProfile = (user) => {
    setSelectedProfileUser(user);
    setShowProfileModal(true);
  };

  const handleDeployRoomServices = async (e) => {
    e.preventDefault();
    if (!roomForm.staffId) return;
    try {
      // Persist the booking; RoomTable carries is_occupied / start_time /
      // duration_minutes / assigned_staff, which is what time_remaining is
      // computed from. Ticking the timer in local state alone would reset on
      // every reload and report the room as free while it is in use.
      await api.patch(`/rooms/${selectedRoomId}/`, {
        is_occupied: true,
        customer_name: roomForm.customerName,
        service_type: roomForm.serviceType,
        duration_minutes: parseInt(roomForm.minutes, 10) || 0,
        assigned_staff: staffList.find((s) => String(s.id) === String(roomForm.staffId))?.userId ?? null,
        start_time: new Date().toISOString(),
      });
      setRoomsState(await reloadRooms());
      setShowRoomModal(false);
      setRoomForm({ staffId: '', customerName: '', serviceType: 'Pedicure & Manicure', minutes: '30' });
      triggerSweetAlert('success', 'Room Timer Started', `Room ${selectedRoomId} is now active.`);
    } catch (err) {
      triggerSweetAlert('error', 'Could Not Start Timer', apiErrorMessage(err, 'The room was not updated.'));
    }
  };

  const handleEvacuateRoom = async (roomId) => {
    try {
      await api.patch(`/rooms/${roomId}/`, {
        is_occupied: false,
        customer_name: '',
        service_type: '',
        duration_minutes: 0,
        assigned_staff: null,
        start_time: null,
      });
      setRoomsState(await reloadRooms());
      triggerSweetAlert('info', 'Room Cleared', `Room ${roomId} is now vacant and ready.`);
    } catch (err) {
      triggerSweetAlert('error', 'Could Not Clear Room', apiErrorMessage(err, 'The room was not updated.'));
    }
  };

  const unassignedStaff = staffList.filter(s => s.assignment === 'Unassigned' && s.status === 'Active');

  const exportToCSV = (data, filename) => {
    if (data.length === 0) {
      triggerSweetAlert('info', 'No Data', 'There is no data to export.');
      return;
    }
    const headers = Object.keys(data[0]);
    const csv = [headers.join(','), ...data.map(row => headers.map(h => row[h] ?? '').join(','))].join('\n');
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

  const filteredAudits = auditLogs.filter(a => {
    const haystack = `${a.target || ''} ${a.type || ''} ${a.agent || ''}`.toLowerCase();
    return haystack.includes(auditSearch.toLowerCase());
  });
  const totalAuditPages = Math.ceil(filteredAudits.length / entriesPerPage) || 1;
  const paginatedAudits = filteredAudits.slice((auditPage - 1) * entriesPerPage, auditPage * entriesPerPage);

  // --- LOGIN SCREEN ---
  if (!isLoggedIn) {
    const activeGuide = roleGuides[previewRole] || null;
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
              {/* Options come from DEMO_ACCOUNTS itself. This list used to be
                  hand-written with the old role names, so changing a demo
                  account silently left the picker pointing at missing keys. */}
              <select value={demoSelection} onChange={handleDemoRoleChange} className="w-full bg-slate-800/50 border border-slate-700 rounded-xl p-3 text-sm focus:bg-slate-800 focus:border-cyan-500 outline-none transition-all text-white font-medium">
                {Object.keys(DEMO_ACCOUNTS).map((label) => (
                  <option key={label} value={label}>{label} Node</option>
                ))}
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
              <p className="font-semibold uppercase tracking-wider mb-2">All demo accounts · seeded by reseed_demo</p>
              {/* Full roster (mirrors DEMO_LOGINS.md). Clicking fills the form
                  only — the role is whatever the server says it is;
                  pre-setting it from a button's label is what once made the
                  header briefly show the wrong role before login completed. */}
              <div className="max-h-44 overflow-y-auto pr-1 space-y-2">
                {DEMO_DIRECTORY.map(({ group, accounts }) => (
                  <div key={group}>
                    <p className="font-semibold text-cyan-300/90 uppercase tracking-wider text-[9px] mb-0.5">{group}</p>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                      {accounts.map((account) => (
                        <button
                          key={account.username}
                          type="button"
                          title={`Password: ${account.password}`}
                          onClick={() => {
                            setLoginForm({ username: account.username, password: account.password });
                            setPreviewRole(roleCodeFromLabel(account.label));
                            setLoginError('');
                          }}
                          className="text-left hover:text-white py-0.5"
                        >
                          <span className="font-semibold">{account.label}:</span> {account.username}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-slate-400">Hover a row for its password — demo credentials are for local development only.</p>
            </div>
            {/* What this role can see / do and where it belongs, from
                GET /auth/role-guide/ — hidden until (or unless) that call
                resolves; the form works without it. */}
            {activeGuide && (
              <div role="status" className="rounded-xl border border-slate-600/40 bg-slate-800/60 p-3 text-[10px] text-slate-300 space-y-1">
                <p className="font-semibold uppercase tracking-wider text-cyan-300">{activeGuide.label} — what you get</p>
                <p><span className="text-slate-500">Can see:</span> {activeGuide.sees.join(' · ') || '—'}</p>
                <p><span className="text-slate-500">Can do:</span> {activeGuide.does.join('; ') || '—'}</p>
                <p>
                  <span className="text-slate-500">Where you should be:</span>{' '}
                  <span className="font-semibold text-white">{activeGuide.lands_on_label}</span>
                  {' '}— this role covers {activeGuide.scope}
                </p>
              </div>
            )}
            <button type="submit" className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-medium text-sm py-3 rounded-xl transition-all shadow-lg shadow-cyan-600/20">Access Dashboard</button>
          </form>
        </div>
      </div>
    );
  }

  // --- MAIN APP RENDER ---
  // The signed-in account's own guide: role_code from the login payload, or
  // the header display role turned back into a code ('Business Manager' ->
  // 'BUSINESS_MANAGER') for sessions stored before role_code existed.
  const myRoleCode = String(
    currentUser.role_code || String(currentUserRole || '').replace(/\s+/g, '_').toUpperCase(),
  );
  const myGuide = roleGuides[myRoleCode] || null;
  return (
    <BrowserRouter>
      <div className={`flex h-screen ${
        isDarkMode ? 'bg-slate-950 text-slate-200' : 'bg-gradient-to-br from-slate-50 to-slate-100 text-slate-700'
      } font-sans overflow-hidden`}>

        {/* SWEETALERT */}
        {sweetAlert.show && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
            <div className={`${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} border rounded-2xl p-6 w-full max-w-sm shadow-2xl text-center space-y-4`}>
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 shadow-md">
                {sweetAlert.type === 'success' ? <CheckCircle size={28} className="text-white" /> : <Info size={28} className="text-white" />}
              </div>
              <div>
                <h3 className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{sweetAlert.title}</h3>
                <p className={`text-xs font-medium mt-1 leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{sweetAlert.message}</p>
              </div>
              <button onClick={() => setSweetAlert({ ...sweetAlert, show: false })} className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white font-semibold text-xs py-2 rounded-xl uppercase tracking-wider transition-all">Okay</button>
            </div>
          </div>
        )}

        {/* PROFILE MODAL */}
        {showProfileModal && selectedProfileUser && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div className={`${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white'} rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto shadow-2xl border`}>
              <div className={`sticky top-0 ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} border-b p-4 flex justify-between items-center`}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center">
                    <UserCog size={20} className="text-white" />
                  </div>
                  <h3 className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Staff Profile Details</h3>
                </div>
                <button onClick={() => setShowProfileModal(false)} className={`p-2 ${isDarkMode ? 'hover:bg-slate-700' : 'hover:bg-slate-100'} rounded-xl transition-all`}><X size={18} /></button>
              </div>
              <div className="p-6 space-y-6">
                <div className={`flex items-center gap-4 pb-4 border-b ${isDarkMode ? 'border-slate-700' : 'border-slate-100'}`}>
                  <div className={`w-20 h-20 ${isDarkMode ? 'bg-slate-700' : 'bg-gradient-to-br from-cyan-100 to-blue-100'} rounded-2xl flex items-center justify-center`}>
                    <Users size={36} className="text-cyan-600" />
                  </div>
                  <div>
                    <h2 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{selectedProfileUser.name}</h2>
                    <p className="text-sm text-cyan-600 font-medium">{selectedProfileUser.role}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${selectedProfileUser.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                        {selectedProfileUser.status}
                      </span>
                      <span className={`text-[10px] ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>ID: {selectedProfileUser.id}</span>
                    </div>
                  </div>
                </div>
                <div>
                  <h4 className={`text-xs font-bold ${isDarkMode ? 'text-slate-400' : 'text-slate-400'} uppercase tracking-wider mb-3 flex items-center gap-2`}><UserCheck size={12} /> Personal Information</h4>
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
                  <h4 className={`text-xs font-bold ${isDarkMode ? 'text-slate-400' : 'text-slate-400'} uppercase tracking-wider mb-3 flex items-center gap-2`}><History size={12} /> Employment History & Achievements</h4>
                  <div className="space-y-2">
                    {selectedProfileUser.history && selectedProfileUser.history.length > 0 ? (
                      selectedProfileUser.history.map((item, idx) => (
                        <div key={idx} className={`flex items-start gap-3 p-3 ${isDarkMode ? 'bg-slate-700/50 border-slate-700' : 'bg-slate-50 border-slate-100'} rounded-xl border`}>
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
                  {canAccess(currentUserRole, 'user_manage') && <button onClick={() => { setShowProfileModal(false); initEditUser(selectedProfileUser); }} className={`flex-1 ${isDarkMode ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'} font-semibold text-xs py-2 rounded-xl transition-all flex items-center justify-center gap-1`}><Edit3 size={12} /> Edit Profile</button>}
                  <button onClick={() => setShowProfileModal(false)} className="flex-1 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white font-semibold text-xs py-2 rounded-xl transition-all flex items-center justify-center gap-1">Close</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* USER MODAL */}
        {showUserModal && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-40">
            <div className={`${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} border rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4`}>
              <div className="flex justify-between items-center border-b pb-2">
                <h3 className={`text-xs font-bold uppercase tracking-wider ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{editingUser ? 'Edit User Profile' : 'Register New User'}</h3>
                <button onClick={() => { setShowUserModal(false); setEditingUser(null); }} className="text-slate-400 hover:text-slate-900"><X size={16} /></button>
              </div>
              <form onSubmit={handleSaveUser} className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
                <div>
                  <label className={`block text-xs font-semibold uppercase ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Full Name</label>
                  <input type="text" required value={userForm.name} onChange={(e) => setUserForm({ ...userForm, name: e.target.value })} className={`w-full ${isDarkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-slate-50 border-slate-200'} border p-2 text-sm rounded-xl`} />
                </div>
                <div>
                  <label className={`block text-xs font-semibold uppercase ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Email Address</label>
                  <input type="email" value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} className={`w-full ${isDarkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-slate-50 border-slate-200'} border p-2 text-sm rounded-xl`} />
                </div>
                <div>
                  <label className={`block text-xs font-semibold uppercase ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Phone Number</label>
                  <input type="text" value={userForm.phone} onChange={(e) => setUserForm({ ...userForm, phone: e.target.value })} className={`w-full ${isDarkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-slate-50 border-slate-200'} border p-2 text-sm rounded-xl`} />
                </div>
                <div>
                  <label className={`block text-xs font-semibold uppercase ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Address</label>
                  <input type="text" required value={userForm.address} onChange={(e) => setUserForm({ ...userForm, address: e.target.value })} className={`w-full ${isDarkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-slate-50 border-slate-200'} border p-2 text-sm rounded-xl`} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={`block text-xs font-semibold uppercase ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Age</label>
                    <input type="number" required value={userForm.age} onChange={(e) => setUserForm({ ...userForm, age: e.target.value })} className={`w-full ${isDarkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-slate-50 border-slate-200'} border p-2 text-sm rounded-xl`} />
                  </div>
                  <div>
                    <label className={`block text-xs font-semibold uppercase ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Gender</label>
                    <select value={userForm.gender} onChange={(e) => setUserForm({ ...userForm, gender: e.target.value })} className={`w-full ${isDarkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-slate-50 border-slate-200'} border p-2 text-sm rounded-xl font-medium`}>
                      <option value="Female">Female</option>
                      <option value="Male">Male</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className={`block text-xs font-semibold uppercase ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Start Date</label>
                  <input type="date" required value={userForm.startDate} onChange={(e) => setUserForm({ ...userForm, startDate: e.target.value })} className={`w-full ${isDarkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-slate-50 border-slate-200'} border p-2 text-sm rounded-xl`} />
                </div>
                <div>
                  <label className={`block text-xs font-semibold uppercase ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>System Role Assigned</label>
                  {/* Roles come from the API's ROLE_CHOICES, so a retired role
                      (e.g. the old "Branch Admin") can never be offered again. */}
                  <select value={userForm.role} onChange={(e) => setUserForm({ ...userForm, role: e.target.value })} className={`w-full ${isDarkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-slate-50 border-slate-200'} border p-2 text-sm rounded-xl font-medium`}>
                    {(roleOptions.length ? roleOptions : FALLBACK_ROLE_OPTIONS).map((opt) => (
                      <option key={opt.value || opt.code} value={opt.label}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                {/* Cashier/Staff grants must name an outlet; company-wide roles
                    must not (backend check constraint). */}
                {!isCompanyWideRole(userForm.role) && (
                  <div>
                    <label className={`block text-xs font-semibold uppercase ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Outlet (Branch)</label>
                    <select value={userForm.branch} onChange={(e) => setUserForm({ ...userForm, branch: e.target.value })} className={`w-full ${isDarkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-slate-50 border-slate-200'} border p-2 text-sm rounded-xl font-medium`}>
                      <option value="">Select an outlet...</option>
                      {branches.map((b) => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  </div>
                )}
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
            <div className={`${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} border rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-4`}>
              <div className="flex justify-between items-center border-b pb-2">
                <h3 className={`text-xs font-bold uppercase tracking-wider ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Assign Room {selectedRoomId}</h3>
                <button onClick={() => setShowRoomModal(false)} className="text-slate-400 hover:text-slate-900"><X size={16} /></button>
              </div>
              <form onSubmit={handleDeployRoomServices} className="space-y-3">
                <div>
                  <label className={`block text-xs font-semibold uppercase ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Assign Available Specialist</label>
                  <select required value={roomForm.staffId} onChange={(e) => setRoomForm({ ...roomForm, staffId: e.target.value })} className={`w-full ${isDarkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-slate-50 border-slate-200'} border p-2 text-sm rounded-xl font-medium`}>
                    <option value="">-- Select Available Specialist --</option>
                    {unassignedStaff.map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.role})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={`block text-xs font-semibold uppercase ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Customer Name</label>
                  <input type="text" required value={roomForm.customerName} onChange={(e) => setRoomForm({ ...roomForm, customerName: e.target.value })} className={`w-full ${isDarkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-slate-50 border-slate-200'} border p-2 text-sm rounded-xl`} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={`block text-xs font-semibold uppercase ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Service Type</label>
                    <select value={roomForm.serviceType} onChange={(e) => setRoomForm({ ...roomForm, serviceType: e.target.value })} className={`w-full ${isDarkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-slate-50 border-slate-200'} border p-2 text-xs rounded-xl font-medium`}>
                      <option value="Pedicure & Manicure">Pedicure & Manicure</option>
                      <option value="Foot Spa Therapy">Foot Spa Therapy</option>
                      <option value="Therapeutic Massage">Therapeutic Massage</option>
                    </select>
                  </div>
                  <div>
                    <label className={`block text-xs font-semibold uppercase ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Duration</label>
                    <select value={roomForm.minutes} onChange={(e) => setRoomForm({ ...roomForm, minutes: e.target.value })} className={`w-full ${isDarkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-slate-50 border-slate-200'} border p-2 text-xs rounded-xl font-medium`}>
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
            <div className={`${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} border rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-4`}>
              <div className="flex justify-between items-center border-b pb-2">
                <h3 className={`text-xs font-bold uppercase tracking-wider ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Add New Product</h3>
                <button onClick={() => setShowProductModal(false)} className="text-slate-400 hover:text-slate-900"><X size={16} /></button>
              </div>
              <form onSubmit={handleAddProduct} className="space-y-3">
                <div>
                  <label className={`block text-xs font-semibold uppercase ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Product Name</label>
                  <input type="text" required value={productForm.name} onChange={(e) => setProductForm({ ...productForm, name: e.target.value })} className={`w-full ${isDarkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-slate-50 border-slate-200'} border p-2 text-sm rounded-xl`} />
                </div>
                <div>
                  <label className={`block text-xs font-semibold uppercase ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Category</label>
                  <select value={productForm.category} onChange={(e) => setProductForm({ ...productForm, category: e.target.value })} className={`w-full ${isDarkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-slate-50 border-slate-200'} border p-2 text-sm rounded-xl font-medium`}>
                    <option value="Cosmetics">Cosmetics</option>
                    <option value="Supplies">Supplies</option>
                    <option value="Equipment">Equipment</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={`block text-xs font-semibold uppercase ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Quantity</label>
                    <input type="number" required value={productForm.quantity} onChange={(e) => setProductForm({ ...productForm, quantity: e.target.value })} className={`w-full ${isDarkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-slate-50 border-slate-200'} border p-2 text-sm rounded-xl`} />
                  </div>
                  <div>
                    <label className={`block text-xs font-semibold uppercase ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Price (₱)</label>
                    <input type="number" required value={productForm.price} onChange={(e) => setProductForm({ ...productForm, price: e.target.value })} className={`w-full ${isDarkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-slate-50 border-slate-200'} border p-2 text-sm rounded-xl`} />
                  </div>
                </div>
                <button type="submit" disabled={isSavingProduct} className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white font-semibold text-xs py-2.5 rounded-xl uppercase tracking-wider transition-all disabled:opacity-70 flex items-center justify-center gap-2">
                  {isSavingProduct ? <Loader2 size={16} className="animate-spin" /> : null}
                  {isSavingProduct ? 'Saving...' : 'Confirm Stock Entry'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* SIDEBAR - Hidden in full screen mode */}
        {!isPOSFullScreen && (
          <Sidebar
            sidebarCollapsed={sidebarCollapsed}
            setActiveTab={setActiveTab}
            activeTab={activeTab}
            currentUserRole={currentUserRole}
            isDarkMode={isDarkMode}
            toggleDarkMode={toggleDarkMode}
            onLogout={handleLogout}
          />
        )}

        {/* MAIN CONTENT */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {/* HEADER - Hidden in full screen mode */}
          {!isPOSFullScreen && (
            <header className={`${
              isDarkMode ? 'bg-slate-900/80 border-slate-700/30' : 'bg-white/80 border-slate-200'
            } backdrop-blur-sm border-b px-6 py-3 flex justify-between items-center shadow-sm z-20`}>
              <div className="flex items-center space-x-3">
                <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)} className={`p-2 border ${isDarkMode ? 'border-slate-700 hover:bg-slate-800 text-slate-400' : 'border-slate-200 hover:bg-slate-100 text-slate-600'} rounded-xl transition-all`}>
                  <Menu size={15} />
                </button>
                <h2 className={`text-base font-bold ${isDarkMode ? 'text-white' : 'bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent'}`}>
                  {activeTab === 'dashboard' && "System Performance Insights"}
                  {activeTab === 'sales' && (currentUserRole === 'Cashier' ? "Cashier Point of Sale" : "Sales & Point of Sale")}
                  {activeTab === 'clients' && "Client Directory"}
                  {activeTab === 'customer_rewards' && "Customer Loyalty & Rewards"}
                  {activeTab === 'administration' && "System Administration"}
                  {activeTab === 'users' && "User Management Directory"}
                  {activeTab === 'rooms' && "Live Service Room Tracking"}
                  {activeTab === 'inventory' && "Product & Sales Stock Registry"}
                  {activeTab === 'audit_controls' && "Security Exception Records"}
                  {activeTab === 'documentation' && "System Documentation & Guides"}
                </h2>
              </div>

              <div className="flex items-center space-x-4">
                {grantedBusinesses.length > 1 && (
                  <div className={`flex items-center gap-2 ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} border px-3 py-1.5 rounded-xl text-xs`}>
                    <Building2 size={14} className="text-cyan-600 shrink-0" />
                    <label htmlFor="business-switch" className={`font-semibold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                      Business:
                    </label>
                    <select
                      id="business-switch"
                      value={activeBusiness}
                      onChange={(event) => chooseBusiness(event.target.value)}
                      className={`bg-transparent font-bold cursor-pointer focus:outline-none ${isDarkMode ? 'text-cyan-400' : 'text-cyan-700'}`}
                    >
                      {grantedBusinesses.map((b) => (
                        <option key={b.slug} value={b.slug} className={`${isDarkMode ? 'bg-slate-800 text-slate-100' : 'bg-white text-slate-700'}`}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className={`text-right font-mono text-xs ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-200'} border px-3 py-1.5 rounded-xl`}>
                  <span className="text-slate-400 mr-1.5">{formattedDate}</span>
                  <span className="text-cyan-600 font-semibold">{formattedTime}</span>
                </div>

                <div className={`flex items-center gap-2 ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-gradient-to-r from-slate-100 to-slate-50 border-slate-200'} border px-3 py-1 rounded-xl text-xs`}>
                  <UserCheck size={14} className="text-cyan-600" />
                  <span className={`font-semibold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Role:</span>
                  <span className={`font-bold ${isDarkMode ? 'text-cyan-400' : 'text-cyan-700'}`}>{currentUserRole || '—'}</span>
                  {/* §6.3 split: SUPERADMIN is its own role again, distinct from
                      OWNER. The badge keys off the role code, not the Django
                      is_superuser flag, so the two can't be conflated. */}
                  {currentUser?.role_code === 'SUPERADMIN' && (
                    <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-600 dark:text-amber-400">Superadmin</span>
                  )}
                </div>

                <div className={`h-5 w-px ${isDarkMode ? 'bg-slate-700' : 'bg-slate-200'}`}></div>

                <div className="relative">
                  <button onClick={() => setShowNotifDropdown(!showNotifDropdown)} className={`p-2 border ${isDarkMode ? 'border-slate-700 hover:bg-slate-800 text-slate-400' : 'border-slate-200 hover:bg-slate-50 text-slate-600'} rounded-xl relative transition-all`}>
                    <Bell size={15} />
                    <span className="absolute -top-1 -right-1 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-bold text-[8px] w-4 h-4 flex items-center justify-center rounded-full shadow-md">{systemNotifications.length}</span>
                  </button>

                  {showNotifDropdown && (
                    <div className={`absolute right-0 mt-2 w-72 ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} border rounded-xl shadow-xl p-2 z-50 space-y-1`}>
                      <div className={`px-2 py-1 border-b ${isDarkMode ? 'border-slate-700' : 'border-slate-100'} flex justify-between items-center`}>
                        <span className={`text-[10px] font-bold ${isDarkMode ? 'text-slate-400' : 'text-slate-400'} uppercase`}>Notifications</span>
                        <button onClick={() => setShowNotifDropdown(false)} className="text-[10px] text-cyan-600">Dismiss</button>
                      </div>
                      {systemNotifications.map(n => (
                        <div key={n.id} className={`p-2 rounded-lg text-xs flex items-start gap-2 ${isDarkMode ? 'hover:bg-slate-700' : 'hover:bg-slate-50'}`}>
                          <span className={`w-1.5 h-1.5 mt-1.5 rounded-full shrink-0 ${n.type === 'alert' ? 'bg-orange-500' : n.type === 'success' ? 'bg-emerald-500' : 'bg-blue-500'}`}></span>
                          <p className={`font-medium leading-snug ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>{n.text}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </header>
          )}

          {/* WORKSPACE CONTENT - Adjusted padding in full screen */}
          {/* Remount on business switch so every page refetches under the new scope */}
          <div
            key={activeBusiness || 'default'}
            className={`flex-1 overflow-y-auto space-y-6 ${
              isPOSFullScreen ? 'p-2' : 'p-6'
            } ${
              isDarkMode ? 'bg-slate-950/50' : 'bg-slate-50/30'
            }`}
          >

            {/* SALES TAB */}
            {activeTab === 'sales' && canAccess(currentUserRole, 'sales') && (
              (currentUserRole === 'Cashier' || currentUserRole === 'CASHIER') ? (
                <CashierPOS
                  isDarkMode={isDarkMode}
                  onToggleFullScreen={togglePOSFullScreen}
                  isFullScreen={isPOSFullScreen}
                />
              ) : (
                <SalesPage isDarkMode={isDarkMode} readOnly={currentUserRole === 'Owner'} />
              )
            )}

            {activeTab === 'clients' && canAccess(currentUserRole, 'clients') && (
              <ClientsPage isDarkMode={isDarkMode} readOnly={!canAccess(currentUserRole, 'client_manage')} />
            )}

            {/* CUSTOMER REWARDS TAB */}
            {activeTab === 'customer_rewards' && canAccess(currentUserRole, 'customer_rewards') && (
              <CustomersRewardsPage isDarkMode={isDarkMode} />
            )}

            {activeTab === 'administration' && canAccess(currentUserRole, 'administration') && (
              <AdministrationPage isDarkMode={isDarkMode} />
            )}

            {/* DASHBOARD */}
            {activeTab === 'dashboard' && (
              <>
                {/* My access: what this role sees, does, and where it belongs,
                    from the same /auth/role-guide/ payload as the login
                    preview — plus the scope the account actually resolved to. */}
                {myGuide && (
                  <div className={`${isDarkMode ? 'bg-slate-800/60 border-slate-700' : 'bg-white border-slate-200'} border rounded-xl p-4 shadow-sm space-y-2`}>
                    <div className="flex items-center justify-between gap-3">
                      <h3 className={`text-xs font-bold uppercase tracking-wider ${isDarkMode ? 'text-cyan-400' : 'text-cyan-600'}`}>
                        My access — {myGuide.label}
                      </h3>
                      <div className="flex items-center gap-2">
                        {/* Harmless even if the role could not open the tab: the
                            tab guard at the top of this component bounces
                            unauthorized tabs back to the dashboard. */}
                        <button
                          type="button"
                          onClick={() => setActiveTab(myGuide.lands_on)}
                          className="text-[11px] font-semibold px-3 py-1 rounded-lg text-white bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 transition-all"
                        >
                          Go to {myGuide.lands_on_label}
                        </button>
                        <button
                          type="button"
                          onClick={() => setMyAccessOpen((open) => !open)}
                          className={`text-[11px] font-semibold px-3 py-1 rounded-lg border ${isDarkMode ? 'border-slate-600 text-slate-300 hover:bg-slate-700' : 'border-slate-200 text-slate-600 hover:bg-slate-100'}`}
                        >
                          {myAccessOpen ? 'Hide' : 'Show'}
                        </button>
                      </div>
                    </div>
                    {myAccessOpen && (
                      <div className="text-[11px] space-y-1">
                        <p className={isDarkMode ? 'text-slate-300' : 'text-slate-600'}>
                          <span className="opacity-60">Where you should be:</span>{' '}
                          <span className="font-semibold">{myGuide.lands_on_label}</span> — this role covers {myGuide.scope}{' '}
                          Currently in{' '}
                          {grantedBusinesses.length > 1
                            ? `${grantedBusinesses.length} businesses — switch from the header picker`
                            : (grantedBusinesses[0]?.name || 'the active business')}
                          {currentUser.branch?.name ? ` · ${currentUser.branch.name}` : ''}.
                        </p>
                        <p className={isDarkMode ? 'text-slate-300' : 'text-slate-600'}>
                          <span className="opacity-60">Can see:</span> {myGuide.sees.join(' · ') || '—'}
                        </p>
                        <p className={isDarkMode ? 'text-slate-300' : 'text-slate-600'}>
                          <span className="opacity-60">Can do:</span> {myGuide.does.join('; ') || '—'}
                        </p>
                      </div>
                    )}
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                  <div className={`${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-gradient-to-br from-cyan-50 to-blue-50 border-cyan-100'} border rounded-xl p-4 shadow-sm hover:shadow-md transition-all duration-200 flex items-center justify-between group`}>
                    <div>
                      <span className={`text-xs font-medium uppercase tracking-wide ${isDarkMode ? 'text-cyan-400' : 'text-cyan-600'}`}>Active Rooms</span>
                      <h3 className={`text-2xl font-bold mt-1 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{occupiedRoomsCount} / 15</h3>
                    </div>
                    <div className={`p-3 ${isDarkMode ? 'bg-slate-700' : 'bg-gradient-to-br from-cyan-100 to-blue-100'} rounded-xl group-hover:scale-110 transition-transform duration-200 ${isDarkMode ? 'text-cyan-400' : 'text-cyan-600'}`}><Layers size={20} /></div>
                  </div>

                  <div className={`${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-100'} border rounded-xl p-4 shadow-sm hover:shadow-md transition-all duration-200 flex items-center justify-between group`}>
                    <div>
                      <span className={`text-xs font-medium uppercase tracking-wide ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`}>Available Staff</span>
                      <h3 className={`text-2xl font-bold mt-1 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{unassignedStaff.length} Standby</h3>
                    </div>
                    <div className={`p-3 ${isDarkMode ? 'bg-slate-700' : 'bg-gradient-to-br from-emerald-100 to-teal-100'} rounded-xl group-hover:scale-110 transition-transform duration-200 ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`}><Briefcase size={20} /></div>
                  </div>

                  <div className={`${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-gradient-to-br from-amber-50 to-orange-50 border-amber-100'} border rounded-xl p-4 shadow-sm hover:shadow-md transition-all duration-200 flex items-center justify-between group`}>
                    <div>
                      <span className={`text-xs font-medium uppercase tracking-wide ${isDarkMode ? 'text-amber-400' : 'text-amber-600'}`}>Stock Warnings</span>
                      <h3 className={`text-2xl font-bold mt-1 ${isDarkMode ? 'text-orange-400' : 'text-orange-600'}`}>{lowStockItemsCount} Alerts</h3>
                    </div>
                    <div className={`p-3 ${isDarkMode ? 'bg-slate-700' : 'bg-gradient-to-br from-amber-100 to-orange-100'} rounded-xl group-hover:scale-110 transition-transform duration-200 ${isDarkMode ? 'text-amber-400' : 'text-orange-600'}`}><AlertTriangle size={20} /></div>
                  </div>

                  <div className={`${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-100'} border rounded-xl p-4 shadow-sm hover:shadow-md transition-all duration-200 flex items-center justify-between group`}>
                    <div>
                      <span className={`text-xs font-medium uppercase tracking-wide ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>Today's Sales</span>
                      <h3 className={`text-2xl font-bold mt-1 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>₱{totalSales.toLocaleString()}</h3>
                    </div>
                    <div className={`p-3 ${isDarkMode ? 'bg-slate-700' : 'bg-gradient-to-br from-blue-100 to-indigo-100'} rounded-xl group-hover:scale-110 transition-transform duration-200 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}><DollarSign size={20} /></div>
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
                    <p className={`text-xs font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-400'}`}>{staffList.length} total users · {staffList.filter(s => s.status === 'Active').length} active</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => exportToCSV(staffList, 'users')} className={`border ${isDarkMode ? 'border-slate-700 hover:bg-slate-700 text-slate-400 hover:text-white' : 'border-slate-200 hover:bg-slate-50 text-slate-600'} font-medium text-xs px-3 py-2 rounded-xl flex items-center gap-1.5 transition-all`}>
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
                              <div className={`w-8 h-8 ${isDarkMode ? 'bg-slate-700 text-cyan-400' : 'bg-gradient-to-br from-cyan-100 to-blue-100 text-cyan-600'} rounded-full flex items-center justify-center font-bold text-xs`}>
                                {staff.avatar || staff.name.split(' ').map(n => n[0]).join('')}
                              </div>
                              <div>
                                <p className={`font-semibold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{staff.name}</p>
                                <p className={`text-[10px] ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>{staff.email || 'No email'}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${staff.role === 'Admin' ? 'bg-purple-100 text-purple-700' : staff.role === 'Cashier' ? 'bg-cyan-100 text-cyan-700' : staff.role === 'Spa Therapist' ? 'bg-pink-100 text-pink-700' : 'bg-slate-100 text-slate-700'}`}>
                              {staff.role}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className={`text-xs font-medium ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                              {staff.assignment === 'Unassigned' ? <span className="text-amber-600">🔄 Unassigned</span> : <span className="text-cyan-600">📍 {staff.assignment}</span>}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full ${staff.status === 'Active' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${staff.status === 'Active' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                              {staff.status.toUpperCase()}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center justify-center gap-1.5">
                              <button onClick={() => viewUserProfile(staff)} className={`p-1.5 ${isDarkMode ? 'bg-slate-700 border-slate-600 text-cyan-400 hover:bg-slate-600' : 'bg-cyan-50 border-cyan-200 text-cyan-600 hover:bg-cyan-100'} border rounded-lg transition-all hover:scale-110`} title="View Profile">
                                <Eye size={13} />
                              </button>
                              {canAccess(currentUserRole, 'user_manage') && <button onClick={() => initEditUser(staff)} className={`p-1.5 ${isDarkMode ? 'bg-slate-700 border-slate-600 text-slate-400 hover:text-white hover:bg-slate-600' : 'bg-white border-slate-200 text-slate-500 hover:text-slate-800 hover:border-slate-300'} border rounded-lg transition-all hover:scale-110`} title="Edit">
                                <Edit3 size={13} />
                              </button>}
                              {canAccess(currentUserRole, 'user_manage') && <button onClick={() => toggleUserStatus(staff.id, staff.status)} className={`p-1.5 border rounded-lg transition-all hover:scale-110 ${staff.status === 'Active' ? 'bg-red-50 border-red-100 text-red-500 hover:bg-red-100' : 'bg-emerald-50 border-emerald-100 text-emerald-500 hover:bg-emerald-100'}`} title={staff.status === 'Active' ? 'Deactivate' : 'Activate'}>
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
                        <button key={pageNum} onClick={() => setUserPage(pageNum)} className={`w-7 h-7 rounded-lg text-xs font-bold transition-all ${userPage === pageNum ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-sm' : isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700' : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
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
                <div className={`grid grid-cols-1 md:grid-cols-3 gap-4 ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-gradient-to-r from-blue-50 via-cyan-50 to-sky-50 border-cyan-100'} p-5 border rounded-xl shadow-sm`}>
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
                    <h4 className={`text-[11px] font-bold uppercase ${isDarkMode ? 'text-slate-400 bg-slate-800 border-slate-700' : 'text-slate-500 bg-slate-100 border-slate-200'} border px-3 py-1.5 rounded-lg w-fit tracking-wide`}>
                      {zone.icon} {zone.title}
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                      {roomsState.filter(r => r.id >= zone.min && r.id <= zone.max).map((room) => {
                        // Staff are assigned to an outlet, so match on the room's
                        // branch. The old `Room ${id}` label came from the
                        // hardcoded demo rows and never matched real data.
                        const assignedCrew = room.branchName
                          ? staffList.filter((s) => s.assignment === room.branchName)
                          : [];
                        const isOccupied = room.customer !== '';

                        return (
                          <div key={room.id} className={`${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} border rounded-xl p-4 shadow-sm flex flex-col justify-between transition-all duration-200 hover:shadow-md ${isOccupied ? 'border-cyan-500' : 'hover:border-slate-300'}`}>
                            <div className="flex justify-between items-center border-b pb-2">
                              <span className={`font-bold text-sm ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Room Suite {room.id}</span>
                              <span className={`text-[8px] font-bold px-2 py-0.5 rounded-full ${isOccupied ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-sm' : 'bg-slate-100 text-slate-400'}`}>
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
                                <button disabled={unassignedStaff.length === 0} onClick={() => { setSelectedRoomId(room.id); setShowRoomModal(true); }} className={`w-full ${unassignedStaff.length === 0 ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-slate-50 hover:bg-gradient-to-r hover:from-cyan-600 hover:to-blue-600 hover:text-white border border-slate-200'} font-semibold text-[11px] py-1.5 rounded-lg flex items-center justify-center space-x-1 transition-all`}>
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
                    <p className={`text-xs font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-400'}`}>{inventoryList.length} total items · {inventoryList.filter(i => i.quantity <= 5).length} low stock</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => exportToCSV(inventoryList, 'inventory')} className={`border ${isDarkMode ? 'border-slate-700 hover:bg-slate-700 text-slate-400 hover:text-white' : 'border-slate-200 hover:bg-slate-50 text-slate-600'} font-medium text-xs px-3 py-2 rounded-xl flex items-center gap-1.5 transition-all`}>
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
                              <span className={`text-xs ${isDarkMode ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-600'} px-2 py-1 rounded-full`}>{item.category}</span>
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-3">
                                <span className={`font-mono font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{item.quantity}</span>
                                <div className="flex-1 min-w-[40px]">
                                  <div className={`w-full ${isDarkMode ? 'bg-slate-700' : 'bg-slate-200'} rounded-full h-1.5`}>
                                    <div className={`h-1.5 rounded-full transition-all duration-500 ${stockLevel === 'low' ? 'bg-orange-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min((item.quantity / 50) * 100, 100)}%` }} />
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
                        <button key={pageNum} onClick={() => setProductPage(pageNum)} className={`w-7 h-7 rounded-lg text-xs font-bold transition-all ${productPage === pageNum ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-sm' : isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700' : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
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
                  <button onClick={() => exportToCSV(auditLogs, 'audit_logs')} className={`border ${isDarkMode ? 'border-slate-700 hover:bg-slate-700 text-slate-400 hover:text-white' : 'border-slate-200 hover:bg-slate-50 text-slate-600'} font-medium text-xs px-3 py-2 rounded-xl flex items-center gap-1.5 transition-all`}>
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
                        <th className="py-2.5 px-4">Request</th>
                        <th className="py-2.5 px-4">Agent</th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${isDarkMode ? 'divide-slate-700' : 'divide-slate-100'}`}>
                      {paginatedAudits.map((log) => (
                        <tr key={log.id} className={isDarkMode ? 'hover:bg-slate-700/50' : 'hover:bg-slate-50/30'} transition-colors>
                          <td className={`py-3 px-4 font-mono ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{log.time}</td>
                          <td className="py-3 px-4">
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${log.type === 'VOID' ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-amber-50 text-amber-600 border border-amber-100'}`}>
                              {log.type}
                            </span>
                          </td>
                          <td className={`py-3 px-4 font-semibold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{log.target}</td>
                          {/* AuditLog carries no money field — the old "Value"
                              column came from the hardcoded demo receipts and
                              crashed on every real row (value is null). The
                              request id is the useful trace for an audit trail. */}
                          <td className={`py-3 px-4 font-mono text-[11px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                            {log.request || '—'}
                          </td>
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
                        <button key={pageNum} onClick={() => setAuditPage(pageNum)} className={`w-7 h-7 rounded-lg text-xs font-bold transition-all ${auditPage === pageNum ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-sm' : isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700' : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
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

            {/* DOCUMENTATION HANDBOOK */}
            {canAccess(currentUserRole, 'documentation') && activeTab === 'documentation' && (
              <DocumentationPage isDarkMode={isDarkMode} />
            )}

            {/* UNIFIED CATALOG ROUTES — one endpoint, filtered by item_type.
                The old per-catalog pages (vss-services / vreal-products /
                bb-products) pointed at routes retired in Phase 5. */}
            <Routes>
              <Route path="/catalog/services" element={canAccess(currentUserRole, 'catalog') ?
                <CrudTable key="services" title="Services" apiEndpoint="catalog/items?item_type=SERVICE" columns={['Category', 'Description', 'Price']} isDarkMode={isDarkMode} readOnly={!canAccess(currentUserRole, 'catalog_manage')} />
                : <AccessDenied />
              } />
              <Route path="/catalog/products" element={canAccess(currentUserRole, 'catalog') ?
                <CrudTable key="products" title="Products" apiEndpoint="catalog/items?item_type=PRODUCT" columns={['Category', 'Product', 'Price']} isDarkMode={isDarkMode} readOnly={!canAccess(currentUserRole, 'catalog_manage')} />
                : <AccessDenied />
              } />
            </Routes>

          </div>
        </main>
      </div>
    </BrowserRouter>
  );
}
