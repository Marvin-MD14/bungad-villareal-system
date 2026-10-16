import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import CrudTable from './components/CrudTable';
import SalesPage from './components/SalesPage';
import ClientsPage from './components/ClientsPage';
import AdministrationPage from './components/AdministrationPage';
import CashierPOS from './components/CashierPOS';
import CustomersRewardsPage from './components/CustomersRewardsPage';
import DocumentationPage from './components/DocumentationPage';
import AvailabilityMatrixPage from './components/AvailabilityMatrixPage';
import BusinessContextBadge from './components/BusinessContextBadge';
import LandingPage from './components/LandingPage';
import {
  applyBusinessHeader, getActiveBusinessSlug, getGrantedBusinesses,
  rememberBusinesses, forgetBusinessContext, setActiveBusiness,
} from './utils/session';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { API_BASE_URL as SHARED_API_BASE_URL } from './utils/api';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell, LineChart, Line,
  AreaChart, Area, ComposedChart,
} from 'recharts';
import {
  Users, DoorOpen, ShieldAlert, LogOut, Plus, Menu, X, UserPlus,
  Package, Search, Bell, Layers, TrendingUp, AlertTriangle, CheckCircle,
  Edit3, Check, EyeOff, Filter, Info, UserCheck, Briefcase, Calendar,
  DollarSign, Activity, Archive, Star, Clock, Zap, Box, UserCog, Eye, History,
  Mail, Phone, MapPin, Award, Target, ChevronLeft, ChevronRight,
  Download, Loader2, Sun, Moon, Settings,
  CreditCard, ShoppingBag, Scissors,
  Crown, BookOpen, Building2,
  Wallet, Users2, TrendingDown, Clock as ClockIcon, Activity as ActivityIcon,
  Maximize2, Minimize2, Home, Sparkles,
} from 'lucide-react';

// ============ VILLAREAL BRAND COLORS (from logo) ============
const BRAND = {
  purple: '#5d2e6b',
  purpleDark: '#3d1e47',
  purpleLight: '#7d4a8b',
  green: '#8bc34a',
  greenDark: '#689f38',
  greenLight: '#aed581',
};

// ============ API CONFIGURATION ============
const API_BASE_URL = SHARED_API_BASE_URL;

const DEMO_ACCOUNTS = {
  'Superadmin': { username: 'demo_superadmin', password: 'DemoSuperadmin!2026' },
  'Owner': { username: 'demo_owner', password: 'DemoOwner!2026' },
  'Business Manager': { username: 'demo_business_manager', password: 'DemoBusinessManager!2026' },
  'Cashier': { username: 'demo_cashier', password: 'DemoCashier!2026' },
  'Staff': { username: 'demo_staff', password: 'DemoStaff!2026' },
};

const MGR_PW = 'DemoManager!2026';
const CASHIER_PW = 'DemoCashier!2026';
const STAFF_PW = 'DemoStaff!2026';

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

const ROLE_CAPABILITIES = {};

// Fallback capabilities when the API is unreachable — fail closed (dashboard only).
// Real capabilities are always fetched from /auth/capabilities/ after login.
const FALLBACK_CAPABILITIES = ['dashboard', 'documentation'];

const FALLBACK_ROLE_OPTIONS = [
  { code: 'CASHIER', label: 'Cashier' },
  { code: 'STAFF', label: 'Staff' },
  { code: 'SUPERVISOR', label: 'Supervisor' },
  { code: 'BUSINESS_MANAGER', label: 'Business Manager' },
];

const COMPANY_ROLE_CODES = new Set(['SUPERADMIN', 'OWNER', 'COMPANY_ADMIN', 'ACCOUNTANT']);
const isCompanyWideRole = (label) => COMPANY_ROLE_CODES.has(
  String(label || '').replace(/[\s_]+/g, '_').toUpperCase(),
);

const displayRole = (role) =>
  String(role || '').replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

const normalizeRoleCode = (role) =>
  String(role || '').replace(/[\s_]+/g, '_').toUpperCase();

const isCashierRole = (role) => normalizeRoleCode(role) === 'CASHIER';

const canAccess = (role, capability) => {
  if (!role) return false;
  const caps = ROLE_CAPABILITIES[role] ?? ROLE_CAPABILITIES[displayRole(role)];
  return Array.isArray(caps) ? caps.includes(capability) : false;
};

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 10000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');
  if (token) config.headers.Authorization = `Token ${token}`;
  return applyBusinessHeader(config);
});

const AccessDenied = () => (
  <div className="p-8 text-center text-slate-500">
    You do not have permission to view this page.
  </div>
);

// ============ VILLAREAL "V" ICON (inline SVG, no image) ============
function VillarealLogo({ size = 40 }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className="flex-shrink-0">
      <path d="M 20 20 L 50 75 L 80 20" stroke="#8bc34a" strokeWidth="8" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M 20 20 L 35 15" stroke="#8bc34a" strokeWidth="6" strokeLinecap="round"/>
      <path d="M 65 15 L 80 20" stroke="#8bc34a" strokeWidth="6" strokeLinecap="round"/>
      <path d="M 35 80 L 65 80" stroke="#8bc34a" strokeWidth="5" strokeLinecap="round"/>
      <path d="M 28 88 L 40 90" stroke="#5d2e6b" strokeWidth="5" strokeLinecap="round"/>
      <path d="M 60 90 L 72 88" stroke="#5d2e6b" strokeWidth="5" strokeLinecap="round"/>
    </svg>
  );
}

// ============================================================
// ============ FULLSCREEN HELPERS (BROWSER-LEVEL) ============
// ============================================================
const requestBrowserFullScreen = async (element) => {
  const el = element || document.documentElement;
  try {
    if (el.requestFullscreen) {
      await el.requestFullscreen();
    } else if (el.webkitRequestFullscreen) {
      await el.webkitRequestFullscreen();
    } else if (el.msRequestFullscreen) {
      await el.msRequestFullscreen();
    }
    return true;
  } catch (err) {
    console.warn('Fullscreen request denied:', err);
    return false;
  }
};

const exitBrowserFullScreen = async () => {
  try {
    if (document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement) {
      if (document.exitFullscreen) {
        await document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        await document.webkitExitFullscreen();
      } else if (document.msExitFullscreen) {
        await document.msExitFullscreen();
      }
    }
    return true;
  } catch (err) {
    console.warn('Exit fullscreen failed:', err);
    return false;
  }
};

const isBrowserFullScreen = () =>
  Boolean(document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement);

// ============================================================
// ============ DASHBOARD CONSTANTS + HELPERS ============
// ============================================================
const PAYMENT_COLORS = ['#8bc34a', '#3b82f6', '#f97316', '#8b5cf6', '#ec4899'];
const TIER_COLORS = {
  BRONZE: '#b45309',
  SILVER: '#94a3b8',
  GOLD: '#eab308',
  PLATINUM: '#06b6d4',
};

// ✅ ROOM TYPE OPTIONS (para sa New Room modal)
const ROOM_TYPE_OPTIONS = [
  { value: 'FOOT_SPA', label: 'Foot Spa' },
  { value: 'MASSAGE', label: 'Massage' },
  { value: 'FACIAL', label: 'Facial' },
  { value: 'NAIL_CARE', label: 'Nail Care' },
  { value: 'BODY_TREATMENT', label: 'Body Treatment' },
  { value: 'VIP_SUITE', label: 'VIP Suite' },
  { value: 'OTHER', label: 'Other' },
];

const tooltipStyle = (isDarkMode) => ({
  backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
  borderRadius: '10px',
  border: isDarkMode ? '1px solid #334155' : '1px solid #e2e8f0',
  fontSize: '11px',
  color: isDarkMode ? '#fff' : '#000',
  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
});

function KpiCard({ title, value, icon, color, trend, subtitle, isDarkMode }) {
  const colorMap = {
    purple: { bg: 'from-purple-500/10 to-purple-700/10', icon: 'bg-purple-500/20 text-purple-600', border: 'border-purple-200/50' },
    lime: { bg: 'from-lime-500/10 to-green-500/10', icon: 'bg-lime-500/20 text-lime-600', border: 'border-lime-200/50' },
    orange: { bg: 'from-orange-500/10 to-amber-500/10', icon: 'bg-orange-500/20 text-orange-600', border: 'border-orange-200/50' },
    red: { bg: 'from-red-500/10 to-rose-500/10', icon: 'bg-red-500/20 text-red-600', border: 'border-red-200/50' },
    yellow: { bg: 'from-yellow-500/10 to-amber-500/10', icon: 'bg-yellow-500/20 text-yellow-600', border: 'border-yellow-200/50' },
  };
  const c = colorMap[color] || colorMap.purple;
  return (
    <div className={`${isDarkMode ? 'bg-slate-800 border-slate-700' : `bg-gradient-to-br ${c.bg} bg-white ${c.border}`} border rounded-2xl p-4 shadow-sm hover:shadow-md transition-all duration-200 group`}>
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className={`text-[10px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            {title}
          </p>
          <p className={`text-xl font-bold mt-1 truncate ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
            {value}
          </p>
          {subtitle && (
            <p className={`text-[10px] mt-1 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
              {subtitle}
            </p>
          )}
        </div>
        <div className={`p-2 rounded-xl shrink-0 ${c.icon} group-hover:scale-110 transition-transform`}>
          {icon}
        </div>
      </div>
      {trend && (
        <div className={`mt-2 flex items-center gap-1 text-[10px] font-semibold ${
          trend === 'up' ? 'text-lime-600' : 'text-red-500'
        }`}>
          {trend === 'up' ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
          {trend === 'up' ? 'Above average' : 'Below average'}
        </div>
      )}
    </div>
  );
}

function Card({ title, subtitle, icon, isDarkMode, children, className = '' }) {
  return (
    <div className={`${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-purple-200'} border rounded-2xl p-5 shadow-sm hover:shadow-md transition-all duration-200 ${className}`}>
      <div className="mb-4">
        <div className="flex items-center gap-2">
          {icon && <span className="text-purple-600">{icon}</span>}
          <h4 className={`text-xs font-bold uppercase tracking-wider ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
            {title}
          </h4>
        </div>
        {subtitle && (
          <p className={`text-[11px] mt-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-400'}`}>
            {subtitle}
          </p>
        )}
      </div>
      {children}
    </div>
  );
}

function StockBar({ label, count, total, color, isDarkMode }) {
  const pct = total ? (count / total) * 100 : 0;
  const colorMap = {
    lime: 'from-lime-400 to-green-500',
    orange: 'from-orange-400 to-amber-500',
    red: 'from-red-400 to-rose-500',
  };
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className={`font-semibold ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>{label}</span>
        <span className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
          {count} <span className="text-slate-400 text-[10px]">({pct.toFixed(0)}%)</span>
        </span>
      </div>
      <div className={`w-full ${isDarkMode ? 'bg-slate-700' : 'bg-slate-100'} rounded-full h-2 overflow-hidden`}>
        <div
          className={`h-full rounded-full bg-gradient-to-r ${colorMap[color]} transition-all duration-700`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function RadialMetric({ label, value, display, color, isDarkMode }) {
  const safe = Math.min(Math.max(value || 0, 0), 100);
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (safe / 100) * circumference;
  return (
    <div className="flex items-center gap-3">
      <div className="relative w-16 h-16">
        <svg className="w-16 h-16 -rotate-90">
          <circle
            cx="32" cy="32" r={radius}
            stroke={isDarkMode ? '#334155' : '#e2e8f0'}
            strokeWidth="5" fill="none"
          />
          <circle
            cx="32" cy="32" r={radius}
            stroke={color} strokeWidth="5" fill="none"
            strokeDasharray={circumference} strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.8s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-xs font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
            {safe.toFixed(0)}%
          </span>
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-xs font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{label}</p>
        <p className="text-[11px] text-slate-500">{display}</p>
      </div>
    </div>
  );
}

// ============ SIDEBAR COMPONENT ============
function Sidebar({ sidebarCollapsed, setActiveTab, activeTab, currentUserRole, isDarkMode, toggleDarkMode, onLogout, capabilitiesTick: _tick }) {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: <Activity size={16} /> },
    { id: 'sales', label: 'Sales & POS', icon: <CreditCard size={16} /> },
    { id: 'clients', label: 'Clients', icon: <Users size={16} /> },
    { id: 'customer_rewards', label: 'Customer Rewards', icon: <Crown size={16} /> },
    { id: 'administration', label: 'Administration', icon: <Settings size={16} /> },
    { id: 'users', label: 'User Profiling', icon: <Users size={16} /> },
    { id: 'rooms', label: 'Room Status', icon: <DoorOpen size={16} /> },
    { id: 'inventory', label: 'Inventory', icon: <Package size={16} /> },
    { id: 'catalog_availability', label: 'Availability Matrix', icon: <Layers size={16} /> },
    { id: 'audit_controls', label: 'Audit Logs', icon: <ShieldAlert size={16} /> },
    { id: 'documentation', label: 'Documentation', icon: <BookOpen size={16} /> },
  ].filter((item) => canAccess(currentUserRole, item.id === 'audit_controls' ? 'audit' : item.id === 'catalog_availability' ? 'catalog' : item.id));

  const productMenus = [
    { path: '/catalog/services', label: 'Services', icon: <Scissors size={14} /> },
    { path: '/catalog/products', label: 'Products', icon: <ShoppingBag size={14} /> },
  ].filter(() => canAccess(currentUserRole, 'catalog'));

  return (
    <aside className={`${sidebarCollapsed ? 'w-20' : 'w-64'} ${
      isDarkMode ? 'bg-gradient-to-b from-purple-950 via-purple-950 to-slate-950' : 'bg-gradient-to-b from-purple-900 via-purple-900 to-purple-950'
    } text-purple-100 flex flex-col justify-between shadow-2xl transition-all duration-300 z-30 border-r ${
      isDarkMode ? 'border-purple-800/30' : 'border-purple-700/50'
    }`}>
      <div className="overflow-hidden">
        <div className={`p-4 border-b ${isDarkMode ? 'border-purple-800/30' : 'border-purple-700/50'} bg-gradient-to-r from-purple-900 to-purple-900/50`}>
          {!sidebarCollapsed ? (
            <div className="flex items-center justify-center gap-2">
              <VillarealLogo size={40} />
              <div className="text-left">
                <h1 className="text-base font-black tracking-widest text-white leading-none">VILLAREAL</h1>
                <p className="text-[8px] tracking-[0.25em] text-lime-400 font-light mt-0.5">SALON & SPA</p>
              </div>
            </div>
          ) : (
            <div className="flex justify-center">
              <VillarealLogo size={36} />
            </div>
          )}
          {!sidebarCollapsed && (
            <p className="text-[9px] text-purple-300 font-semibold uppercase tracking-wider text-center mt-3 pt-2 border-t border-purple-700/50">
              Management Workspace
            </p>
          )}
        </div>

        <nav className="p-3 space-y-1.5 mt-2">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center' : 'space-x-3'} px-4 py-2.5 text-xs font-semibold uppercase tracking-wider rounded-xl transition-all duration-200 ${
                activeTab === item.id
                  ? 'bg-gradient-to-r from-purple-600 to-purple-700 text-white shadow-lg shadow-purple-600/30'
                  : `${isDarkMode ? 'text-purple-300 hover:text-white hover:bg-purple-800/30' : 'text-purple-300 hover:text-white hover:bg-purple-800/50'}`
              }`}
            >
              {item.icon}
              {!sidebarCollapsed && <span>{item.label}</span>}
            </button>
          ))}
        </nav>
      </div>

      <div className="p-3 border-t border-purple-800/40 mt-auto space-y-2">
        <button
          onClick={toggleDarkMode}
          className={`w-full ${
            isDarkMode ? 'bg-purple-900/50 hover:bg-purple-800/50 text-purple-300 hover:text-white' : 'bg-purple-900/50 hover:bg-purple-800/50 text-purple-300 hover:text-white'
          } font-semibold text-xs p-2.5 rounded-xl flex items-center ${sidebarCollapsed ? 'justify-center' : 'justify-start'} space-x-2 transition-all duration-200 border border-purple-800/50`}
        >
          {isDarkMode ? <Sun size={14} /> : <Moon size={14} />}
          {!sidebarCollapsed && <span>{isDarkMode ? 'Light Mode' : 'Dark Mode'}</span>}
        </button>

        <button onClick={onLogout} className={`w-full ${
          isDarkMode ? 'bg-purple-900/50 hover:bg-red-500/20 text-purple-300 hover:text-red-400' : 'bg-purple-900/50 hover:bg-red-500/20 text-purple-300 hover:text-red-400'
        } font-semibold text-xs p-2.5 rounded-xl flex items-center ${sidebarCollapsed ? 'justify-center' : 'justify-start'} space-x-2 transition-all duration-200 border border-purple-800/50 hover:border-red-500/30`}>
          <LogOut size={14} /> {!sidebarCollapsed && <span>Logout</span>}
        </button>
      </div>
    </aside>
  );
}

// ============ MAIN APP COMPONENT ============
export default function App() {
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
  const [isPOSFullScreen, setIsPOSFullScreen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(() => Boolean(
    localStorage.getItem('authToken') && localStorage.getItem('authUser')
  ));
  const [loginForm, setLoginForm] = useState(
    () => Object.values(DEMO_ACCOUNTS)[0] || { username: '', password: '' }
  );
  const [loginError, setLoginError] = useState('');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [currentUserRole, setCurrentUserRole] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('authUser'))?.role || '';
    } catch {
      return '';
    }
  });
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('authUser')) || {};
    } catch {
      return {};
    }
  });

  const [grantedBusinesses, setGrantedBusinesses] = useState(getGrantedBusinesses);
  const [storedBusiness, setStoredBusiness] = useState(getActiveBusinessSlug);

  const activeBusiness = grantedBusinesses.length && !grantedBusinesses.some((b) => b.slug === storedBusiness)
    ? (grantedBusinesses[0].slug || '')
    : storedBusiness;

  useEffect(() => {
    setActiveBusiness(activeBusiness);
  }, [activeBusiness]);


  // Derived active business name for context indicators (task 2.4)
  const activeBusinessObj = grantedBusinesses.find(b => b.slug === activeBusiness);
  const activeBusinessName = activeBusinessObj?.name || '';

  // Update document title on tab/business change (task 2.4)
  useEffect(() => {
    const pageLabels = {
      dashboard: 'Dashboard', sales: 'Sales & POS', clients: 'Clients',
      customer_rewards: 'Customer Rewards', administration: 'Administration',
      users: 'User Management', rooms: 'Room Status', inventory: 'Inventory',
      audit_controls: 'Audit Logs', documentation: 'Documentation',
      catalog_availability: 'Availability Matrix',
    };
    const page = pageLabels[activeTab] || 'Dashboard';
    const biz = activeBusinessName ? ` - ${activeBusinessName}` : '';
    document.title = `${page}${biz} | Villareal Management`;
  }, [activeTab, activeBusinessName]);

  const chooseBusiness = (slug) => {
    setActiveBusiness(slug);
    setStoredBusiness(slug);
    // Reset to dashboard (or role default) when switching business
    // so stale page content doesn't show before the reload completes
    const roleCode = normalizeRoleCode(currentUser.role_code || currentUserRole);
    if (roleCode === 'CASHIER') {
      setActiveTab('sales');
    } else if (roleCode === 'STAFF') {
      setActiveTab('rooms');
    } else if (roleCode === 'ACCOUNTANT' || roleCode === 'BUSINESS_MANAGER') {
      setActiveTab('administration');
    } else {
      setActiveTab('dashboard');
    }
  };

  useEffect(() => {
    const capability = activeTab === 'audit_controls' ? 'audit' : activeTab;
    if (activeTab !== 'dashboard' && !canAccess(currentUserRole, capability)) {
      setActiveTab('dashboard');
    }
  }, [activeTab, currentUserRole]);

  // ============ FULLSCREEN STATE SYNC ============
  useEffect(() => {
    const onFsChange = () => {
      const isFs = isBrowserFullScreen();
      if (!isFs && isPOSFullScreen) {
        setIsPOSFullScreen(false);
      }
    };
    document.addEventListener('fullscreenchange', onFsChange);
    document.addEventListener('webkitfullscreenchange', onFsChange);
    document.addEventListener('msfullscreenchange', onFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFsChange);
      document.removeEventListener('webkitfullscreenchange', onFsChange);
      document.removeEventListener('msfullscreenchange', onFsChange);
    };
  }, [isPOSFullScreen]);

  useEffect(() => {
    if (activeTab !== 'sales' && isPOSFullScreen) {
      setIsPOSFullScreen(false);
      exitBrowserFullScreen();
    }
  }, [activeTab, isPOSFullScreen]);

  // ============ F11 / ESC KEY HANDLERS ============
  useEffect(() => {
    const handleKey = (e) => {
      const isCashier = isCashierRole(currentUserRole);
      if (e.key === 'F11' && isCashier) {
        e.preventDefault();
        togglePOSFullScreen();
      }
      if (e.key === 'Escape' && isPOSFullScreen) {
        setIsPOSFullScreen(false);
        exitBrowserFullScreen();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [currentUserRole, isPOSFullScreen]);

  const togglePOSFullScreen = useCallback(async () => {
    const next = !isPOSFullScreen;
    setIsPOSFullScreen(next);
    if (next) {
      await requestBrowserFullScreen();
    } else {
      await exitBrowserFullScreen();
    }
  }, [isPOSFullScreen]);

  const exitPOSToDashboard = useCallback(async () => {
    setIsPOSFullScreen(false);
    await exitBrowserFullScreen();
    setActiveTab('dashboard');
  }, []);

  const [selectedProfileUser, setSelectedProfileUser] = useState(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSavingProduct, setIsSavingProduct] = useState(false);

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

  const [showUserModal, setShowUserModal] = useState(false);
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [showNewRoomModal, setShowNewRoomModal] = useState(false);   // ✅ BAGO
  const [showProductModal, setShowProductModal] = useState(false);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [selectedRoomId, setSelectedRoomId] = useState(null);
  const [sweetAlert, setSweetAlert] = useState({ show: false, type: 'success', title: '', message: '' });

  const [userSearch, setUserSearch] = useState('');
  const [userGenderFilter, setUserGenderFilter] = useState('All');
  const [userStatusFilter, setUserStatusFilter] = useState('All');
  const [userRoleFilter, setUserRoleFilter] = useState('All');

  const [productSearch, setProductSearch] = useState('');
  const [productCategoryFilter, setProductCategoryFilter] = useState('All');
  const [productStockFilter, setProductStockFilter] = useState('All');

  const [auditSearch, setAuditSearch] = useState('');

  const [userPage, setUserPage] = useState(1);
  const [productPage, setProductPage] = useState(1);
  const [auditPage, setAuditPage] = useState(1);
  const entriesPerPage = 5;

  const [userForm, setUserForm] = useState({
    name: '', address: '', age: '', gender: 'Female', role: 'Cashier', branch: '',
    email: '', phone: '', startDate: new Date().toISOString().split('T')[0]
  });
  const [roomForm, setRoomForm] = useState({
    staffId: '', customerName: '', serviceType: 'Pedicure & Manicure', minutes: '30'
  });
  // ✅ BAGO: Form para sa pag-add ng bagong room
  const [newRoomForm, setNewRoomForm] = useState({
    name: '',
    room_type: 'FOOT_SPA',
    branch: '',
  });
  const [branches, setBranches] = useState([]);
  const [roleOptions, setRoleOptions] = useState([]);
  const [productForm, setProductForm] = useState({
    name: '', category: '', quantity: '', price: ''
  });

  const [staffList, setStaffList] = useState([]);
  const [inventoryList, setInventoryList] = useState([]);
  const [catalogCategories, setCatalogCategories] = useState([]);  // from /catalog/categories/
  const [catalogServices, setCatalogServices] = useState([]);      // from /catalog/items/?item_type=SERVICE
  const [auditLogs, setAuditLogs] = useState([]);
  const [roomsState, setRoomsState] = useState([]);
  const [roomZones, setRoomZones] = useState([]);

  const [revenueTrend, setRevenueTrend] = useState([]);
  const [popularServices, setPopularServices] = useState([]);

  const CHART_COLORS = ['#5d2e6b', '#8bc34a', '#7d4a8b', '#aed581', '#3d1e47'];
  const [productDistribution, setProductDistribution] = useState([]);
  const [dashboard, setDashboard] = useState({});
  const [capabilitiesTick, setCapabilitiesTick] = useState(0);

  const [salesByHour, setSalesByHour] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [paymentSplit, setPaymentSplit] = useState([]);
  const [tierDistribution, setTierDistribution] = useState([]);
  const [branchSales, setBranchSales] = useState([]);
  const [customerSplit, setCustomerSplit] = useState({ new: 0, returning: 0 });

  const activeCount = staffList.filter(s => s.status === 'Active').length;
  const deactivatedCount = staffList.filter(s => s.status === 'Deactivated').length;
  const pct = (count) => (staffList.length ? `${Math.round((count / staffList.length) * 100)}%` : '0%');

  const userStatusDistribution = [
    { name: 'Active Users', value: activeCount, color: '#8bc34a', percentage: pct(activeCount) },
    { name: 'Deactivated', value: deactivatedCount, color: '#ef4444', percentage: pct(deactivatedCount) }
  ];

  const lowStockItemsCount = inventoryList.filter(item => item.quantity <= 5).length;
  const occupiedRoomsCount = roomsState.filter(r => r.isOccupied).length;   // ✅ BAGO
  const totalSales = Number(dashboard.month_sales || 0);

  const systemNotifications = [
    ...(lowStockItemsCount > 0 ? [{ id: 'notif-1', text: `⚠️ Warning: ${lowStockItemsCount} items are low in stock.`, type: 'alert' }] : []),
    ...(occupiedRoomsCount > 0 ? [{ id: 'notif-2', text: `🟢 Activity: ${occupiedRoomsCount} treatment rooms are active.`, type: 'info' }] : []),
    { id: 'notif-3', text: '✅ Database sync status: Operational.', type: 'success' }
  ];

  // ============ ✅ LIVE ROOM TIMER — compute base sa start_time + duration_minutes ============
  useEffect(() => {
    const tick = () => {
      setRoomsState(prevRooms => {
        let changed = false;
        const updated = prevRooms.map(room => {
          if (!room.isOccupied || !room.startTime || !room.durationMinutes) {
            return room;
          }
          const startMs = new Date(room.startTime).getTime();
          const endMs = startMs + room.durationMinutes * 60 * 1000;
          const nowMs = Date.now();
          const remainingMs = endMs - nowMs;

          if (remainingMs <= 0) {
            changed = true;
            return {
              ...room,
              isOccupied: false,
              customer: '',
              service: '',
              timeLeft: 0,
              startTime: null,
              durationMinutes: 0,
              assignedStaffId: null,
            };
          }

          const newTimeLeft = Math.ceil(remainingMs / 60000);
          if (newTimeLeft !== room.timeLeft) {
            changed = true;
            return { ...room, timeLeft: newTimeLeft };
          }
          return room;
        });
        return changed ? updated : prevRooms;
      });
    };

    tick();
    const interval = setInterval(tick, 30000);
    return () => clearInterval(interval);
  }, []);

  const triggerSweetAlert = (type, title, message) => {
    setSweetAlert({ show: true, type, title, message });
  };

  const loadDashboardExtras = async () => {
    try {
      const [hourRes, prodRes, payRes, tierRes, branchRes, custRes] = await Promise.allSettled([
        api.get('/dashboard/sales_by_hour/'),
        api.get('/dashboard/top_products/'),
        api.get('/dashboard/payment_split/'),
        api.get('/dashboard/tier_distribution/'),
        api.get('/dashboard/branch_sales/'),
        api.get('/dashboard/customer_split/'),
      ]);
      const pick = (res) => (res.status === 'fulfilled' ? res.value.data : []);
      setSalesByHour(pick(hourRes) || []);
      setTopProducts(pick(prodRes) || []);
      setPaymentSplit(pick(payRes) || []);
      setTierDistribution(pick(tierRes) || []);
      setBranchSales(pick(branchRes) || []);
      const cs = pick(custRes);
      if (cs && typeof cs === 'object' && !Array.isArray(cs)) {
        setCustomerSplit({ new: cs.new || 0, returning: cs.returning || 0 });
      } else {
        setCustomerSplit({ new: 0, returning: 0 });
      }
    } catch (e) {
      console.warn('Dashboard extras failed:', e);
    }
  };

  useEffect(() => {
    if (!isLoggedIn) return undefined;
    let cancelled = false;

    const val = (settled) => {
      if (settled.status !== 'fulfilled') return null;
      const data = settled.value?.data;
      return data?.results ?? data ?? [];
    };

    const load = async () => {
      try {
        const [dash, staffRes, itemRes, levelRes, auditRes, roomRes, capsRes, catRes, svcRes] = await Promise.allSettled([
          api.get('/dashboard/summary/'),
          api.get('/user-profiles/'),
          api.get('/catalog/items/?item_type=PRODUCT'),
          api.get('/catalog/inventory/'),
          api.get('/audit-logs/'),
          api.get('/rooms/'),
          api.get('/auth/capabilities/'),
          api.get('/catalog/categories/'),
          api.get('/catalog/items/?item_type=SERVICE'),
        ]);
        if (cancelled) return;

        const dashData = (dash.status === 'fulfilled' && dash.value?.data) || {};
        setDashboard(dashData);
        // Catalog categories and services — scoped to active business
        if (catRes.status === 'fulfilled') {
          const cats = catRes.value?.data?.results ?? catRes.value?.data ?? [];
          setCatalogCategories(Array.isArray(cats) ? cats : []);
        }
        if (svcRes.status === 'fulfilled') {
          const svcs = svcRes.value?.data?.results ?? svcRes.value?.data ?? [];
          setCatalogServices(Array.isArray(svcs) ? svcs : []);
        }

        if (capsRes.status === 'fulfilled' && capsRes.value?.data) {
          const { role, capabilities } = capsRes.value.data;
          Object.keys(ROLE_CAPABILITIES).forEach((key) => delete ROLE_CAPABILITIES[key]);
          ROLE_CAPABILITIES[role] = capabilities;
          ROLE_CAPABILITIES[displayRole(role)] = capabilities;
        } else {
          Object.keys(ROLE_CAPABILITIES).forEach((key) => delete ROLE_CAPABILITIES[key]);
          ROLE_CAPABILITIES[currentUserRole] = FALLBACK_CAPABILITIES;
        }
        setCapabilitiesTick((tick) => tick + 1);

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
            userId: profile.user_id ?? profile.user ?? null,  // ✅
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
            branchId: profile.branch || '',
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
            request: log.request_id || log.ip_address || '',
            agent: log.user_name || 'system',
          })),
        );

        // ✅ UPDATED: roomsState with all needed fields
        const rooms = val(roomRes) || [];
        setRoomsState(
          rooms.map((room) => ({
            id: room.id,
            name: room.name || `Room Suite ${room.id}`,
            type: room.room_type || room.name,
            typeDisplay: room.room_type_display || room.room_type || 'Rooms',
            customer: room.customer_name || '',
            service: room.service_type || room.item_name || '',
            timeLeft: room.time_remaining || 0,
            startTime: room.start_time || null,
            durationMinutes: room.duration_minutes || 0,
            isOccupied: room.is_occupied || false,
            assignedStaffId: room.assigned_staff || null,
            branch: room.branch,
            branchName: room.branch_name || '',
          })),
        );

        // ✅ Room zones — group by typeDisplay
        const zones = [];
        rooms.forEach((room) => {
          const title = room.room_type_display || room.room_type || room.name || 'Rooms';
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

        await loadDashboardExtras();
      } catch (error) {
        if (!cancelled) setLoginError(error?.response?.data?.detail || 'Unable to load dashboard data.');
      }
    };

    load();
    return () => { cancelled = true; };
  }, [isLoggedIn, storedBusiness]);

  // ============ LOGIN HANDLER ============
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

      const roleCode = normalizeRoleCode(
        response.data.user.role_code || response.data.user.role || ''
      );
      if (roleCode === 'CASHIER') {
        setActiveTab('sales');
        setIsPOSFullScreen(true);
        requestBrowserFullScreen();
      } else {
        setActiveTab('dashboard');
      }

      triggerSweetAlert('success', 'Welcome Back!', `Successfully logged in as ${response.data.user.username}.`);
    } catch (error) {
      setLoginError(error.response?.data?.detail || 'Unable to connect to the authentication server.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLandingLoginSuccess = (data) => {
    localStorage.setItem('authToken', data.token);
    localStorage.setItem('authUser', JSON.stringify(data.user));
    setCurrentUser(data.user || {});
    const granted = Array.isArray(data.businesses) ? data.businesses : [];
    const primarySlug = data.primary_business?.slug || granted[0]?.slug || '';
    rememberBusinesses(granted, primarySlug);
    setGrantedBusinesses(granted);
    setStoredBusiness(primarySlug);
    setIsLoggedIn(true);
    setCurrentUserRole(data.user.role);

    const roleCode = normalizeRoleCode(data.user.role_code || data.user.role || '');
    if (roleCode === 'CASHIER') {
      setActiveTab('sales');
      setIsPOSFullScreen(true);
      requestBrowserFullScreen();
    } else {
      setActiveTab('dashboard');
    }

    triggerSweetAlert('success', 'Welcome Back!', `Successfully logged in as ${data.user.username}.`);
  };

  const handleLogout = async () => {
    await exitBrowserFullScreen();
    localStorage.removeItem('authToken');
    localStorage.removeItem('authUser');
    forgetBusinessContext();
    setGrantedBusinesses([]);
    setStoredBusiness('');
    setIsLoggedIn(false);
    setLoginForm({ username: '', password: '' });
    setLoginError('');
    setIsPOSFullScreen(false);
    setCurrentUserRole('');
    setCurrentUser({});
  };

  const [demoSelection, setDemoSelection] = useState(() => Object.keys(DEMO_ACCOUNTS)[0] || '');

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
        const guides = response.data?.guides;
        const list = Array.isArray(guides) ? guides : Object.values(guides ?? {});
        const map = {};
        list.forEach((guide) => { map[guide.role] = guide; });
        setRoleGuides(map);
      })
      .catch(() => { });
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
    userId: profile.user_id ?? profile.user ?? null,
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
      name: room.name || `Room Suite ${room.id}`,
      type: room.room_type || room.name,
      typeDisplay: room.room_type_display || room.room_type || 'Rooms',
      customer: room.customer_name || '',
      service: room.service_type || room.item_name || '',
      timeLeft: room.time_remaining || 0,
      startTime: room.start_time || null,
      durationMinutes: room.duration_minutes || 0,
      isOccupied: room.is_occupied || false,
      assignedStaffId: room.assigned_staff || null,
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
      const payload = {
        name: userForm.name,
        email: userForm.email,
        phone_number: userForm.phone,
        role: userForm.role,
      };
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
      setProductForm({ name: '', category: '', quantity: '', price: '' });
      triggerSweetAlert('success', 'Product Added', 'The item has been added to the inventory.');
    } catch (err) {
      triggerSweetAlert('error', 'Could Not Add Product', apiErrorMessage(err, 'The item was not added.'));
    } finally {
      setIsSavingProduct(false);
    }
  };

  // ============ ✅ NEW: ADD ROOM HANDLER ============
  const handleCreateRoom = async (e) => {
    e.preventDefault();
    if (!newRoomForm.name.trim()) {
      triggerSweetAlert('error', 'Room Name Required', 'Please enter a name for the new room.');
      return;
    }
    if (!newRoomForm.branch) {
      triggerSweetAlert('error', 'Branch Required', 'Please select a branch for the new room.');
      return;
    }
    setIsLoading(true);
    try {
      await api.post('/rooms/', {
        name: newRoomForm.name.trim(),
        room_type: newRoomForm.room_type,
        branch: Number(newRoomForm.branch),
        is_occupied: false,
      });
      setRoomsState(await reloadRooms());
      // ✅ Refresh room zones
      const res = await api.get('/rooms/');
      const rooms = apiList(res);
      const zones = [];
      rooms.forEach((room) => {
        const title = room.room_type_display || room.room_type || room.name || 'Rooms';
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
      setShowNewRoomModal(false);
      setNewRoomForm({ name: '', room_type: 'FOOT_SPA', branch: '' });
      triggerSweetAlert('success', 'Room Added', `Room "${newRoomForm.name}" has been created.`);
    } catch (err) {
      triggerSweetAlert('error', 'Could Not Add Room', apiErrorMessage(err, 'The room was not created.'));
    } finally {
      setIsLoading(false);
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
      const selected = staffList.find((s) => String(s.id) === String(roomForm.staffId));
      const assignedUserId = selected?.userId ?? null;

      await api.patch(`/rooms/${selectedRoomId}/`, {
        is_occupied: true,
        customer_name: roomForm.customerName,
        service_type: roomForm.serviceType,
        duration_minutes: parseInt(roomForm.minutes, 10) || 0,
        assigned_staff: assignedUserId,
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

  if (!isLoggedIn) {
    return <LandingPage onLoginSuccess={handleLandingLoginSuccess} />;
  }

  const myRoleCode = String(
    currentUser.role_code || String(currentUserRole || '').replace(/\s+/g, '_').toUpperCase(),
  );
  const myGuide = roleGuides[myRoleCode] || null;
  const isCashier = isCashierRole(currentUser.role_code || currentUserRole);
  // Company-wide roles can see and act across all businesses
  const isCompanyWide = ['SUPERADMIN', 'OWNER', 'COMPANY_ADMIN', 'ACCOUNTANT'].includes(myRoleCode);
  // Business-scoped roles: BUSINESS_MANAGER, SUPERVISOR, CASHIER, STAFF
  const isBusinessScoped = !isCompanyWide && myRoleCode !== '';

  return (
    <BrowserRouter>
      <div className={`flex h-screen w-screen ${
        isDarkMode ? 'bg-slate-950 text-slate-200' : 'bg-gradient-to-br from-purple-50 to-purple-100 text-slate-700'
      } font-sans overflow-hidden`}>

        {sweetAlert.show && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
            <div className={`${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-purple-200'} border rounded-2xl p-6 w-full max-w-sm shadow-2xl text-center space-y-4`}>
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-gradient-to-r from-purple-700 to-purple-900 shadow-md">
                {sweetAlert.type === 'success' ? <CheckCircle size={28} className="text-white" /> : <Info size={28} className="text-white" />}
              </div>
              <div>
                <h3 className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{sweetAlert.title}</h3>
                <p className={`text-xs font-medium mt-1 leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{sweetAlert.message}</p>
              </div>
              <button onClick={() => setSweetAlert({ ...sweetAlert, show: false })} className="w-full bg-gradient-to-r from-purple-700 to-purple-900 hover:from-purple-600 hover:to-purple-800 text-white font-semibold text-xs py-2 rounded-xl uppercase tracking-wider transition-all">Okay</button>
            </div>
          </div>
        )}

        {showProfileModal && selectedProfileUser && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div className={`${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white'} rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto shadow-2xl border`}>
              <div className={`sticky top-0 ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-purple-100'} border-b p-4 flex justify-between items-center`}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-r from-purple-700 to-purple-900 rounded-xl flex items-center justify-center">
                    <UserCog size={20} className="text-white" />
                  </div>
                  <h3 className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Staff Profile Details</h3>
                </div>
                <button onClick={() => setShowProfileModal(false)} className={`p-2 ${isDarkMode ? 'hover:bg-slate-700' : 'hover:bg-purple-50'} rounded-xl transition-all`}><X size={18} /></button>
              </div>
              <div className="p-6 space-y-6">
                <div className={`flex items-center gap-4 pb-4 border-b ${isDarkMode ? 'border-slate-700' : 'border-purple-100'}`}>
                  <div className={`w-20 h-20 ${isDarkMode ? 'bg-slate-700' : 'bg-gradient-to-br from-purple-100 to-purple-200'} rounded-2xl flex items-center justify-center`}>
                    <Users size={36} className="text-purple-700" />
                  </div>
                  <div>
                    <h2 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{selectedProfileUser.name}</h2>
                    <p className="text-sm text-purple-700 font-medium">{selectedProfileUser.role}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${selectedProfileUser.status === 'Active' ? 'bg-lime-100 text-lime-700' : 'bg-red-100 text-red-700'}`}>
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
                        <div key={idx} className={`flex items-start gap-3 p-3 ${isDarkMode ? 'bg-slate-700/50 border-slate-700' : 'bg-purple-50 border-purple-100'} rounded-xl border`}>
                          <div className="w-5 h-5 bg-purple-100 rounded-full flex items-center justify-center mt-0.5">
                            <Award size={10} className="text-purple-700" />
                          </div>
                          <p className={`text-xs font-medium ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>{item}</p>
                        </div>
                      ))
                    ) : (
                      <p className={`text-xs italic ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>No history records available.</p>
                    )}
                  </div>
                </div>
                <div className="flex gap-3 pt-4 border-t border-purple-100">
                  {canAccess(currentUserRole, 'user_manage') && <button onClick={() => { setShowProfileModal(false); initEditUser(selectedProfileUser); }} className={`flex-1 ${isDarkMode ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-purple-100 hover:bg-purple-200 text-purple-800'} font-semibold text-xs py-2 rounded-xl transition-all flex items-center justify-center gap-1`}><Edit3 size={12} /> Edit Profile</button>}
                  <button onClick={() => setShowProfileModal(false)} className="flex-1 bg-gradient-to-r from-purple-700 to-purple-900 hover:from-purple-600 hover:to-purple-800 text-white font-semibold text-xs py-2 rounded-xl transition-all flex items-center justify-center gap-1">Close</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {showUserModal && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-40">
            <div className={`${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-purple-200'} border rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4`}>
              <div className="flex justify-between items-center border-b pb-2">
                <h3 className={`text-xs font-bold uppercase tracking-wider ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{editingUser ? 'Edit User Profile' : 'Register New User'}</h3>
                <button onClick={() => { setShowUserModal(false); setEditingUser(null); }} className="text-slate-400 hover:text-slate-900"><X size={16} /></button>
              </div>
              <form onSubmit={handleSaveUser} className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
                <div>
                  <label className={`block text-xs font-semibold uppercase ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Full Name</label>
                  <input type="text" required value={userForm.name} onChange={(e) => setUserForm({ ...userForm, name: e.target.value })} className={`w-full ${isDarkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-purple-50 border-purple-200'} border p-2 text-sm rounded-xl`} />
                </div>
                <div>
                  <label className={`block text-xs font-semibold uppercase ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Email Address</label>
                  <input type="email" value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} className={`w-full ${isDarkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-purple-50 border-purple-200'} border p-2 text-sm rounded-xl`} />
                </div>
                <div>
                  <label className={`block text-xs font-semibold uppercase ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Phone Number</label>
                  <input type="text" value={userForm.phone} onChange={(e) => setUserForm({ ...userForm, phone: e.target.value })} className={`w-full ${isDarkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-purple-50 border-purple-200'} border p-2 text-sm rounded-xl`} />
                </div>
                <div>
                  <label className={`block text-xs font-semibold uppercase ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Address</label>
                  <input type="text" required value={userForm.address} onChange={(e) => setUserForm({ ...userForm, address: e.target.value })} className={`w-full ${isDarkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-purple-50 border-purple-200'} border p-2 text-sm rounded-xl`} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={`block text-xs font-semibold uppercase ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Age</label>
                    <input type="number" required value={userForm.age} onChange={(e) => setUserForm({ ...userForm, age: e.target.value })} className={`w-full ${isDarkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-purple-50 border-purple-200'} border p-2 text-sm rounded-xl`} />
                  </div>
                  <div>
                    <label className={`block text-xs font-semibold uppercase ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Gender</label>
                    <select value={userForm.gender} onChange={(e) => setUserForm({ ...userForm, gender: e.target.value })} className={`w-full ${isDarkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-purple-50 border-purple-200'} border p-2 text-sm rounded-xl font-medium`}>
                      <option value="Female">Female</option>
                      <option value="Male">Male</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className={`block text-xs font-semibold uppercase ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Start Date</label>
                  <input type="date" required value={userForm.startDate} onChange={(e) => setUserForm({ ...userForm, startDate: e.target.value })} className={`w-full ${isDarkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-purple-50 border-purple-200'} border p-2 text-sm rounded-xl`} />
                </div>
                <div>
                  <label className={`block text-xs font-semibold uppercase ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>System Role Assigned</label>
                  <select value={userForm.role} onChange={(e) => setUserForm({ ...userForm, role: e.target.value })} className={`w-full ${isDarkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-purple-50 border-purple-200'} border p-2 text-sm rounded-xl font-medium`}>
                    {(roleOptions.length ? roleOptions : FALLBACK_ROLE_OPTIONS).map((opt) => (
                      <option key={opt.value || opt.code} value={opt.label}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                {!isCompanyWideRole(userForm.role) && (
                  <div>
                    <label className={`block text-xs font-semibold uppercase ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Outlet (Branch)</label>
                    <select value={userForm.branch} onChange={(e) => setUserForm({ ...userForm, branch: e.target.value })} className={`w-full ${isDarkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-purple-50 border-purple-200'} border p-2 text-sm rounded-xl font-medium`}>
                      <option value="">Select an outlet...</option>
                      {branches.map((b) => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                <button type="submit" disabled={isLoading} className="w-full bg-gradient-to-r from-purple-700 to-purple-900 hover:from-purple-600 hover:to-purple-800 text-white font-semibold text-xs py-2.5 rounded-xl uppercase tracking-wider transition-all disabled:opacity-70 flex items-center justify-center gap-2">
                  {isLoading ? <Loader2 size={16} className="animate-spin" /> : null}
                  {isLoading ? 'Saving...' : 'Save Account'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ============================================================
            ============ ✅ NEW ROOM MODAL ============
            ============================================================ */}
        {showNewRoomModal && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-40">
            <div className={`${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-purple-200'} border rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-4`}>
              <div className="flex justify-between items-center border-b pb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-gradient-to-br from-purple-600 to-purple-800 rounded-lg flex items-center justify-center">
                    <Plus size={16} className="text-white" />
                  </div>
                  <h3 className={`text-xs font-bold uppercase tracking-wider ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                    Add New Room
                  </h3>
                </div>
                <button onClick={() => setShowNewRoomModal(false)} className="text-slate-400 hover:text-slate-900"><X size={16} /></button>
              </div>
              <form onSubmit={handleCreateRoom} className="space-y-3">
                <div>
                  <label className={`block text-xs font-semibold uppercase ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    Room Name / Number
                  </label>
                  <input
                    type="text"
                    required
                    value={newRoomForm.name}
                    onChange={(e) => setNewRoomForm({ ...newRoomForm, name: e.target.value })}
                    placeholder="e.g. Room Suite 16, VIP Room A"
                    className={`w-full ${isDarkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-purple-50 border-purple-200'} border p-2 text-sm rounded-xl`}
                  />
                </div>
                <div>
                  <label className={`block text-xs font-semibold uppercase ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    Room Type
                  </label>
                  <select
                    value={newRoomForm.room_type}
                    onChange={(e) => setNewRoomForm({ ...newRoomForm, room_type: e.target.value })}
                    className={`w-full ${isDarkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-purple-50 border-purple-200'} border p-2 text-sm rounded-xl font-medium`}
                  >
                    {ROOM_TYPE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={`block text-xs font-semibold uppercase ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    Branch
                  </label>
                  <select
                    required
                    value={newRoomForm.branch}
                    onChange={(e) => setNewRoomForm({ ...newRoomForm, branch: e.target.value })}
                    className={`w-full ${isDarkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-purple-50 border-purple-200'} border p-2 text-sm rounded-xl font-medium`}
                  >
                    <option value="">-- Select Branch --</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
                <div className={`rounded-lg p-2 ${isDarkMode ? 'bg-purple-900/30 border border-purple-700/50' : 'bg-purple-50 border border-purple-200'}`}>
                  <p className={`text-[10px] ${isDarkMode ? 'text-purple-300' : 'text-purple-700'}`}>
                    <Sparkles size={10} className="inline mr-1" />
                    Ang bagong room ay lalabas agad sa Room Status. Pwede itong i-check-in ng staff.
                  </p>
                </div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-gradient-to-r from-purple-700 to-purple-900 hover:from-purple-600 hover:to-purple-800 text-white font-semibold text-xs py-2.5 rounded-xl uppercase tracking-wider transition-all disabled:opacity-70 flex items-center justify-center gap-2"
                >
                  {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                  {isLoading ? 'Creating...' : 'Create Room'}
                </button>
              </form>
            </div>
          </div>
        )}

        {showRoomModal && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-40">
            <div className={`${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-purple-200'} border rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-4`}>
              <div className="flex justify-between items-center border-b pb-2">
                <h3 className={`text-xs font-bold uppercase tracking-wider ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Assign Room {selectedRoomId}</h3>
                <button onClick={() => setShowRoomModal(false)} className="text-slate-400 hover:text-slate-900"><X size={16} /></button>
              </div>
              <form onSubmit={handleDeployRoomServices} className="space-y-3">
                <div>
                  <label className={`block text-xs font-semibold uppercase ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Assign Available Specialist</label>
                  <select required value={roomForm.staffId} onChange={(e) => setRoomForm({ ...roomForm, staffId: e.target.value })} className={`w-full ${isDarkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-purple-50 border-purple-200'} border p-2 text-sm rounded-xl font-medium`}>
                    <option value="">-- Select Available Specialist --</option>
                    {staffList.filter(s => s.status === 'Active').map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.role})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={`block text-xs font-semibold uppercase ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Customer Name</label>
                  <input type="text" required value={roomForm.customerName} onChange={(e) => setRoomForm({ ...roomForm, customerName: e.target.value })} className={`w-full ${isDarkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-purple-50 border-purple-200'} border p-2 text-sm rounded-xl`} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={`block text-xs font-semibold uppercase ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Service Type</label>
                    <select value={roomForm.serviceType} onChange={(e) => setRoomForm({ ...roomForm, serviceType: e.target.value })} className={`w-full ${isDarkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-purple-50 border-purple-200'} border p-2 text-xs rounded-xl font-medium`}>
                       {catalogServices.length > 0 ? catalogServices.map(s => (
                         <option key={s.id} value={s.name}>{s.name}</option>
                       )) : [
                         <option key="p" value="Pedicure & Manicure">Pedicure & Manicure</option>,
                         <option key="f" value="Foot Spa Therapy">Foot Spa Therapy</option>,
                         <option key="m" value="Therapeutic Massage">Therapeutic Massage</option>
                       ]}
                    </select>
                  </div>
                  <div>
                    <label className={`block text-xs font-semibold uppercase ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Duration</label>
                    <select value={roomForm.minutes} onChange={(e) => setRoomForm({ ...roomForm, minutes: e.target.value })} className={`w-full ${isDarkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-purple-50 border-purple-200'} border p-2 text-xs rounded-xl font-medium`}>
                      <option value="1">1 Minute (Test)</option>
                      <option value="30">30 Minutes</option>
                      <option value="60">60 Minutes (1 Hour)</option>
                      <option value="90">90 Minutes</option>
                    </select>
                  </div>
                </div>
                <button type="submit" className="w-full bg-gradient-to-r from-purple-700 to-purple-900 hover:from-purple-600 hover:to-purple-800 text-white font-semibold text-xs py-2.5 rounded-xl uppercase tracking-wider transition-all">Deploy Timer</button>
              </form>
            </div>
          </div>
        )}

        {showProductModal && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-40">
            <div className={`${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-purple-200'} border rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-4`}>
              <div className="flex justify-between items-center border-b pb-2">
                <h3 className={`text-xs font-bold uppercase tracking-wider ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Add New Product</h3>
                <button onClick={() => setShowProductModal(false)} className="text-slate-400 hover:text-slate-900"><X size={16} /></button>
              </div>
              <form onSubmit={handleAddProduct} className="space-y-3">
                <div>
                  <label className={`block text-xs font-semibold uppercase ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Product Name</label>
                  <input type="text" required value={productForm.name} onChange={(e) => setProductForm({ ...productForm, name: e.target.value })} className={`w-full ${isDarkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-purple-50 border-purple-200'} border p-2 text-sm rounded-xl`} />
                </div>
                <div>
                  <label className={`block text-xs font-semibold uppercase ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Category</label>
                  <select value={productForm.category} onChange={(e) => setProductForm({ ...productForm, category: e.target.value })} className={`w-full ${isDarkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-purple-50 border-purple-200'} border p-2 text-sm rounded-xl font-medium`}>
                    {catalogCategories.filter(c => c.kind === "PRODUCT" || !c.kind).map(c => (
                      <option key={c.id} value={c.name}>{c.name}</option>
                    ))}
                    {catalogCategories.length === 0 && <option value="" disabled>Loading...</option>}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={`block text-xs font-semibold uppercase ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Quantity</label>
                    <input type="number" required value={productForm.quantity} onChange={(e) => setProductForm({ ...productForm, quantity: e.target.value })} className={`w-full ${isDarkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-purple-50 border-purple-200'} border p-2 text-sm rounded-xl`} />
                  </div>
                  <div>
                    <label className={`block text-xs font-semibold uppercase ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Price (₱)</label>
                    <input type="number" required value={productForm.price} onChange={(e) => setProductForm({ ...productForm, price: e.target.value })} className={`w-full ${isDarkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-purple-50 border-purple-200'} border p-2 text-sm rounded-xl`} />
                  </div>
                </div>
                <button type="submit" disabled={isSavingProduct} className="w-full bg-gradient-to-r from-purple-700 to-purple-900 hover:from-purple-600 hover:to-purple-800 text-white font-semibold text-xs py-2.5 rounded-xl uppercase tracking-wider transition-all disabled:opacity-70 flex items-center justify-center gap-2">
                  {isSavingProduct ? <Loader2 size={16} className="animate-spin" /> : null}
                  {isSavingProduct ? 'Saving...' : 'Confirm Stock Entry'}
                </button>
              </form>
            </div>
          </div>
        )}

        {!isPOSFullScreen && (
          <Sidebar
            sidebarCollapsed={sidebarCollapsed}
            setActiveTab={setActiveTab}
            activeTab={activeTab}
            currentUserRole={currentUserRole}
            isDarkMode={isDarkMode}
            toggleDarkMode={toggleDarkMode}
            onLogout={handleLogout}
            capabilitiesTick={capabilitiesTick}
          />
        )}

        <main className="flex-1 flex flex-col overflow-hidden min-h-0">
          {!isPOSFullScreen && (
            <header className={`${
              isDarkMode ? 'bg-slate-900/80 border-purple-800/30' : 'bg-white/80 border-purple-200'
            } backdrop-blur-sm border-b px-6 py-3 flex justify-between items-center shadow-sm z-20 shrink-0`}>
              <div className="flex items-center space-x-3">
                <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)} className={`p-2 border ${isDarkMode ? 'border-purple-800 hover:bg-purple-900/40 text-purple-300' : 'border-purple-200 hover:bg-purple-50 text-purple-700'} rounded-xl transition-all`}>
                  <Menu size={15} />
                </button>
                <h2 className={`text-base font-bold ${isDarkMode ? 'text-white' : 'bg-gradient-to-r from-purple-900 to-purple-700 bg-clip-text text-transparent'}`}>
                  {activeTab === 'dashboard' && "System Performance Insights"}
                  {activeTab === 'sales' && (isCashier ? "Cashier Point of Sale" : "Sales & Point of Sale")}
                  {activeTab === 'clients' && "Client Directory"}
                  {activeTab === 'customer_rewards' && "Customer Loyalty & Rewards"}
                  {activeTab === 'administration' && "System Administration"}
                  {activeTab === 'users' && "User Management Directory"}
                  {activeTab === 'rooms' && "Live Service Room Tracking"}
                  {activeTab === 'inventory' && "Product & Sales Stock Registry"}
                  {activeTab === 'audit_controls' && "Security Exception Records"}
                  {activeTab === 'documentation' && "System Documentation & Guides"}
                  {activeTab === 'catalog_availability' && "Catalog Availability Matrix"}
                </h2>
                <BusinessContextBadge businessName={activeBusinessName} businessSlug={storedBusiness} isDarkMode={isDarkMode} />
              </div>

              <div className="flex items-center space-x-4">
                {grantedBusinesses.length > 0 && (
                  <div className={`flex items-center gap-2 ${isDarkMode ? 'bg-slate-800 border-purple-800' : 'bg-white border-purple-200'} border px-3 py-1.5 rounded-xl text-xs`}>
                    <Building2 size={14} className="text-purple-700 shrink-0" />
                    <label htmlFor="business-switch" className={`font-semibold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                      {isCompanyWide ? 'Business:' : 'Your Business:'}
                    </label>
                    {grantedBusinesses.length > 1 ? (
                      <select
                        id="business-switch"
                        value={activeBusiness}
                        onChange={(event) => chooseBusiness(event.target.value)}
                        className={`bg-transparent font-bold cursor-pointer focus:outline-none ${isDarkMode ? 'text-purple-300' : 'text-purple-800'}`}
                      >
                        {grantedBusinesses.map((b) => (
                          <option key={b.slug} value={b.slug} className={`${isDarkMode ? 'bg-slate-800 text-slate-100' : 'bg-white text-slate-700'}`}>
                            {b.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className={`font-bold ${isDarkMode ? 'text-purple-300' : 'text-purple-800'}`}>
                        {grantedBusinesses[0]?.name || activeBusinessName || '—'}
                      </span>
                    )}
                  </div>
                )}

                <div className={`text-right font-mono text-xs ${isDarkMode ? 'bg-slate-800 border-purple-800' : 'bg-purple-50 border-purple-200'} border px-3 py-1.5 rounded-xl`}>
                  <span className="text-slate-400 mr-1.5">{formattedDate}</span>
                  <span className="text-purple-700 font-semibold">{formattedTime}</span>
                </div>

                <div className={`flex items-center gap-2 ${isDarkMode ? 'bg-slate-800 border-purple-800' : 'bg-gradient-to-r from-purple-50 to-purple-100 border-purple-200'} border px-3 py-1 rounded-xl text-xs`}>
                  <UserCheck size={14} className="text-purple-700" />
                  <span className={`font-semibold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Role:</span>
                  <span className={`font-bold ${isDarkMode ? 'text-purple-300' : 'text-purple-800'}`}>{currentUserRole || '—'}</span>
                  {myRoleCode === 'SUPERADMIN' && (
                    <span className="rounded-full bg-lime-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-lime-700 dark:text-lime-400">Platform</span>
                  )}
                  {myRoleCode === 'OWNER' && (
                    <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">Owner</span>
                  )}
                  {isCompanyWide && myRoleCode !== 'SUPERADMIN' && myRoleCode !== 'OWNER' && (
                    <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-blue-700">Company</span>
                  )}
                  {isBusinessScoped && (
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                      myRoleCode === 'CASHIER' ? 'bg-cyan-500/20 text-cyan-700' :
                      myRoleCode === 'STAFF' ? 'bg-emerald-500/20 text-emerald-700' :
                      'bg-purple-500/20 text-purple-700'
                    }`}>{activeBusinessName || 'Business'}</span>
                  )}
                </div>

                <div className={`h-5 w-px ${isDarkMode ? 'bg-purple-800' : 'bg-purple-200'}`}></div>

                <div className="relative">
                  <button onClick={() => setShowNotifDropdown(!showNotifDropdown)} className={`p-2 border ${isDarkMode ? 'border-purple-800 hover:bg-purple-900/40 text-purple-300' : 'border-purple-200 hover:bg-purple-50 text-purple-700'} rounded-xl relative transition-all`}>
                    <Bell size={15} />
                    <span className="absolute -top-1 -right-1 bg-gradient-to-r from-purple-700 to-purple-900 text-white font-bold text-[8px] w-4 h-4 flex items-center justify-center rounded-full shadow-md">{systemNotifications.length}</span>
                  </button>

                  {showNotifDropdown && (
                    <div className={`absolute right-0 mt-2 w-72 ${isDarkMode ? 'bg-slate-800 border-purple-800' : 'bg-white border-purple-200'} border rounded-xl shadow-xl p-2 z-50 space-y-1`}>
                      <div className={`px-2 py-1 border-b ${isDarkMode ? 'border-purple-800' : 'border-purple-100'} flex justify-between items-center`}>
                        <span className={`text-[10px] font-bold ${isDarkMode ? 'text-slate-400' : 'text-slate-400'} uppercase`}>Notifications</span>
                        <button onClick={() => setShowNotifDropdown(false)} className="text-[10px] text-purple-700">Dismiss</button>
                      </div>
                      {systemNotifications.map(n => (
                        <div key={n.id} className={`p-2 rounded-lg text-xs flex items-start gap-2 ${isDarkMode ? 'hover:bg-slate-700' : 'hover:bg-purple-50'}`}>
                          <span className={`w-1.5 h-1.5 mt-1.5 rounded-full shrink-0 ${n.type === 'alert' ? 'bg-orange-500' : n.type === 'success' ? 'bg-lime-500' : 'bg-purple-500'}`}></span>
                          <p className={`font-medium leading-snug ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>{n.text}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </header>
          )}

          <div
            key={activeBusiness || 'default'}
            className={`flex-1 min-h-0 ${
              isPOSFullScreen
                ? 'overflow-hidden p-0 flex'
                : 'overflow-y-auto space-y-6 p-6'
            } ${
              isDarkMode ? 'bg-slate-950/50' : 'bg-purple-50/30'
            }`}
          >

            {activeTab === 'sales' && canAccess(currentUserRole, 'sales') && (
              isCashier ? (
                <div className="w-full h-full flex flex-col overflow-hidden">
                  <CashierPOS
                    isDarkMode={isDarkMode}
                    isFullScreen={isPOSFullScreen}
                    onToggleFullScreen={togglePOSFullScreen}
                    onExitPOS={exitPOSToDashboard}
                  />
                </div>
              ) : (
                <SalesPage isDarkMode={isDarkMode} readOnly={currentUserRole === 'Owner'} activeBusinessName={activeBusinessName} activeBusiness={activeBusiness} isCompanyWide={isCompanyWide} />
              )
            )}

            {activeTab === 'clients' && canAccess(currentUserRole, 'clients') && (
              <ClientsPage isDarkMode={isDarkMode} readOnly={!canAccess(currentUserRole, 'client_manage')} currentUserRoleCode={currentUser?.role_code || ''} activeBusinessName={activeBusinessName} activeBusiness={activeBusiness} isCompanyWideUser={isCompanyWide} />
            )}

            {activeTab === 'customer_rewards' && canAccess(currentUserRole, 'customer_rewards') && (
              <CustomersRewardsPage isDarkMode={isDarkMode} activeBusinessName={activeBusinessName} activeBusiness={activeBusiness} isCompanyWide={isCompanyWide} />
            )}

            {activeTab === 'administration' && canAccess(currentUserRole, 'administration') && (
              <AdministrationPage isDarkMode={isDarkMode} activeBusinessName={activeBusinessName} activeBusinessSlug={activeBusiness} isCompanyWideUser={isCompanyWide} />
            )}

            {/* ============================================================
                ============ DASHBOARD (ENHANCED) ============
                ============================================================ */}
            {activeTab === 'dashboard' && (
              <>
                {myGuide && (
                  <div className={`${isDarkMode ? 'bg-slate-800/60 border-slate-700' : 'bg-white border-purple-200'} border rounded-xl p-4 shadow-sm space-y-2`}>
                    <div className="flex items-center justify-between gap-3">
                      <h3 className={`text-xs font-bold uppercase tracking-wider ${isDarkMode ? 'text-purple-300' : 'text-purple-700'}`}>
                        My access — {myGuide.label}
                      </h3>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setActiveTab(myGuide.lands_on)}
                          className="text-[11px] font-semibold px-3 py-1 rounded-lg text-white bg-gradient-to-r from-purple-700 to-purple-900 hover:from-purple-600 hover:to-purple-800 transition-all"
                        >
                          Go to {myGuide.lands_on_label}
                        </button>
                        <button
                          type="button"
                          onClick={() => setMyAccessOpen((open) => !open)}
                          className={`text-[11px] font-semibold px-3 py-1 rounded-lg border ${isDarkMode ? 'border-slate-600 text-slate-300 hover:bg-slate-700' : 'border-purple-200 text-purple-700 hover:bg-purple-50'}`}
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
                            ? `${grantedBusinesses.length} businesses — showing ${activeBusinessName || grantedBusinesses[0]?.name} — switch from the header picker`
                            : (activeBusinessName || grantedBusinesses[0]?.name || 'the active business')}
                          {currentUser.branch?.name ? ` · ${currentUser.branch.name}` : ''}.
                        </p>
                        <p className={isDarkMode ? 'text-slate-300' : 'text-slate-600'}>
                          <span className="opacity-60">Scope type:</span>{' '}
                          <span className={`font-semibold text-[11px] px-2 py-0.5 rounded-full ${isCompanyWide ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                            {isCompanyWide ? 'Company-wide — use the business selector to filter' : 'Business-scoped — you see only your assigned business data'}
                          </span>
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

                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
                  {/* Financial KPIs: visible to management roles only */}
                  {canAccess(currentUserRole, 'sales') && (
                    <KpiCard
                      title="Today's Sales"
                      value={`₱${Number(dashboard.today_sales || 0).toLocaleString()}`}
                      icon={<DollarSign size={18} />}
                      color="purple"
                      subtitle={`vs ₱${(Number(dashboard.month_sales || 0) / 30).toFixed(0)}/day avg`}
                      isDarkMode={isDarkMode}
                    />
                  )}
                  {canAccess(currentUserRole, 'administration') && (
                    <>
                      <KpiCard
                        title="Month Sales"
                        value={`₱${Number(dashboard.month_sales || 0).toLocaleString()}`}
                        icon={<TrendingUp size={18} />}
                        color="lime"
                        subtitle="Last 30 days"
                        isDarkMode={isDarkMode}
                      />
                      <KpiCard
                        title="Net Profit"
                        value={`₱${Number(dashboard.net_profit || 0).toLocaleString()}`}
                        icon={<Wallet size={18} />}
                        color={Number(dashboard.net_profit || 0) >= 0 ? 'lime' : 'red'}
                        subtitle={`Expenses ₱${Number(dashboard.month_expenses || 0).toLocaleString()}`}
                        isDarkMode={isDarkMode}
                      />
                    </>
                  )}
                  {canAccess(currentUserRole, 'rooms') && (
                    <KpiCard
                      title="Occupied Rooms"
                      value={`${occupiedRoomsCount} / ${roomsState.length}`}
                      icon={<DoorOpen size={18} />}
                      color="purple"
                      subtitle={`${roomsState.length ? ((occupiedRoomsCount / roomsState.length) * 100).toFixed(0) : 0}% utilization`}
                      isDarkMode={isDarkMode}
                    />
                  )}
                  {canAccess(currentUserRole, 'inventory') && (
                    <KpiCard
                      title="Low Stock"
                      value={lowStockItemsCount}
                      icon={<AlertTriangle size={18} />}
                      color={lowStockItemsCount > 10 ? 'red' : 'orange'}
                      subtitle="Needs restock"
                      isDarkMode={isDarkMode}
                    />
                  )}
                  <KpiCard
                    title="Avg Rating"
                    value={`${Number(dashboard.average_rating || 0).toFixed(1)} ★`}
                    icon={<Star size={18} />}
                    color="yellow"
                    subtitle="Customer feedback"
                    isDarkMode={isDarkMode}
                  />
                </div>


                {/* Quick navigation — only pages this role can access */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  {[
                    { id: 'sales', label: 'Sales & POS', icon: <CreditCard size={20} />, cap: 'sales', color: 'from-purple-500 to-purple-700' },
                    { id: 'clients', label: 'Clients', icon: <Users size={20} />, cap: 'clients', color: 'from-blue-500 to-blue-700' },
                    { id: 'customer_rewards', label: 'Rewards', icon: <Crown size={20} />, cap: 'customer_rewards', color: 'from-amber-500 to-amber-600' },
                    { id: 'rooms', label: 'Room Status', icon: <DoorOpen size={20} />, cap: 'rooms', color: 'from-emerald-500 to-emerald-700' },
                    { id: 'inventory', label: 'Inventory', icon: <Package size={20} />, cap: 'inventory', color: 'from-orange-500 to-orange-700' },
                    { id: 'administration', label: 'Admin', icon: <Settings size={20} />, cap: 'administration', color: 'from-slate-600 to-slate-800' },
                    { id: 'users', label: 'Users', icon: <UserCheck size={20} />, cap: 'users', color: 'from-cyan-500 to-cyan-700' },
                    { id: 'catalog_availability', label: 'Availability', icon: <Layers size={20} />, cap: 'catalog', color: 'from-indigo-500 to-indigo-700' },
                    { id: 'audit_controls', label: 'Audit Logs', icon: <ShieldAlert size={20} />, cap: 'audit', color: 'from-rose-500 to-rose-700' },
                  ].filter(item => canAccess(currentUserRole, item.cap)).map(item => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setActiveTab(item.id)}
                      className={`flex flex-col items-center justify-center gap-2 p-4 rounded-xl bg-gradient-to-br ${item.color} text-white shadow-sm hover:shadow-md hover:scale-105 transition-all`}
                    >
                      {item.icon}
                      <span className="text-[11px] font-semibold leading-tight text-center">{item.label}</span>
                    </button>
                  ))}
                </div>

                {canAccess(currentUserRole, 'administration') && (<>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                  <Card
                    title="Revenue vs Expenses"
                    subtitle="Last 7 days comparison"
                    icon={<ActivityIcon size={16} />}
                    isDarkMode={isDarkMode}
                    className="lg:col-span-2"
                  >
                    <div className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={revenueTrend}>
                          <defs>
                            <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4} />
                              <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#334155' : '#f1f5f9'} />
                          <XAxis dataKey="day" fontSize={11} stroke={isDarkMode ? '#64748b' : '#94a3b8'} />
                          <YAxis fontSize={11} stroke={isDarkMode ? '#64748b' : '#94a3b8'} />
                          <Tooltip contentStyle={tooltipStyle(isDarkMode)} />
                          <Legend wrapperStyle={{ fontSize: '11px' }} />
                          <Area type="monotone" dataKey="Sales" stroke="#8b5cf6" strokeWidth={2.5} fill="url(#salesGrad)" />
                          <Area type="monotone" dataKey="Expenses" stroke="#f97316" strokeWidth={2} fill="url(#expGrad)" />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>

                  <Card
                    title="Payment Methods"
                    subtitle="Last 30 days"
                    icon={<CreditCard size={16} />}
                    isDarkMode={isDarkMode}
                  >
                    {paymentSplit.length === 0 ? (
                      <p className="text-xs text-center text-slate-400 py-12 italic">No payment data yet.</p>
                    ) : (
                      <>
                        <div className="h-52">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={paymentSplit}
                                cx="50%" cy="50%"
                                innerRadius={50} outerRadius={80}
                                paddingAngle={3}
                                dataKey="amount"
                                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                labelLine={false}
                              >
                                {paymentSplit.map((entry, i) => (
                                  <Cell key={i} fill={PAYMENT_COLORS[i % PAYMENT_COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip
                                contentStyle={tooltipStyle(isDarkMode)}
                                formatter={(value) => `₱${Number(value).toLocaleString()}`}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="space-y-1.5 mt-2">
                          {paymentSplit.map((p, i) => (
                            <div key={i} className="flex items-center justify-between text-xs">
                              <div className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: PAYMENT_COLORS[i % PAYMENT_COLORS.length] }} />
                                <span className={isDarkMode ? 'text-slate-300' : 'text-slate-600'}>{p.name}</span>
                              </div>
                              <span className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                                ₱{Number(p.amount).toLocaleString()}
                              </span>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </Card>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  <Card
                    title="Top Services"
                    subtitle="Best sellers by bookings"
                    icon={<Star size={16} />}
                    isDarkMode={isDarkMode}
                  >
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={popularServices} layout="vertical" margin={{ left: 100 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#334155' : '#f1f5f9'} />
                          <XAxis type="number" fontSize={11} stroke={isDarkMode ? '#64748b' : '#94a3b8'} />
                          <YAxis
                            type="category"
                            dataKey="name"
                            fontSize={10}
                            stroke={isDarkMode ? '#64748b' : '#94a3b8'}
                            width={100}
                          />
                          <Tooltip contentStyle={tooltipStyle(isDarkMode)} />
                          <Bar dataKey="Bookings" radius={[0, 6, 6, 0]}>
                            {popularServices.map((entry, i) => (
                              <Cell key={i} fill={entry.fill || CHART_COLORS[i % CHART_COLORS.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>

                  <Card
                    title="Top Products"
                    subtitle="Best sellers by revenue"
                    icon={<ShoppingBag size={16} />}
                    isDarkMode={isDarkMode}
                  >
                    {topProducts.length === 0 ? (
                      <p className="text-xs text-center text-slate-400 py-24 italic">No product sales yet.</p>
                    ) : (
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={topProducts} layout="vertical" margin={{ left: 100 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#334155' : '#f1f5f9'} />
                            <XAxis type="number" fontSize={11} stroke={isDarkMode ? '#64748b' : '#94a3b8'} />
                            <YAxis
                              type="category" dataKey="name" fontSize={10}
                              stroke={isDarkMode ? '#64748b' : '#94a3b8'} width={100}
                            />
                            <Tooltip
                              contentStyle={tooltipStyle(isDarkMode)}
                              formatter={(value) => `₱${Number(value).toLocaleString()}`}
                            />
                            <Bar dataKey="revenue" radius={[0, 6, 6, 0]}>
                              {topProducts.map((_, i) => (
                                <Cell key={i} fill={CHART_COLORS[(i + 2) % CHART_COLORS.length]} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </Card>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                  <Card
                    title="Sales by Hour"
                    subtitle="Peak hours (last 7 days)"
                    icon={<ClockIcon size={16} />}
                    isDarkMode={isDarkMode}
                    className="lg:col-span-2"
                  >
                    {salesByHour.length === 0 ? (
                      <p className="text-xs text-center text-slate-400 py-24 italic">No hourly data yet.</p>
                    ) : (
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={salesByHour}>
                            <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#334155' : '#f1f5f9'} />
                            <XAxis dataKey="label" fontSize={10} stroke={isDarkMode ? '#64748b' : '#94a3b8'} interval={1} />
                            <YAxis fontSize={11} stroke={isDarkMode ? '#64748b' : '#94a3b8'} />
                            <Tooltip
                              contentStyle={tooltipStyle(isDarkMode)}
                              formatter={(value) => `₱${Number(value).toLocaleString()}`}
                            />
                            <Bar dataKey="sales" radius={[6, 6, 0, 0]}>
                              {salesByHour.map((entry, i) => (
                                <Cell
                                  key={i}
                                  fill={entry.sales > 0 ? '#8b5cf6' : (isDarkMode ? '#334155' : '#e2e8f0')}
                                />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </Card>

                  <Card
                    title="Top Staff"
                    subtitle="Last 30 days"
                    icon={<UserCheck size={16} />}
                    isDarkMode={isDarkMode}
                  >
                    <div className="space-y-3">
                      {(dashboard.top_staff || []).map((staff, i) => {
                        const maxSales = Math.max(...(dashboard.top_staff || []).map(s => Number(s.total_sales || 0)), 1);
                        const pctVal = (Number(staff.total_sales || 0) / maxSales) * 100;
                        const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
                        return (
                          <div key={i} className="space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <div className="flex items-center gap-2">
                                <span className="text-base">{medals[i] || '•'}</span>
                                <span className={`font-semibold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                                  {staff.staff__username}
                                </span>
                              </div>
                              <div className="text-right">
                                <p className={`font-bold ${isDarkMode ? 'text-lime-400' : 'text-lime-700'}`}>
                                  ₱{Number(staff.total_sales).toLocaleString()}
                                </p>
                                <p className="text-[10px] text-slate-500">
                                  {staff.transaction_count} transactions
                                </p>
                              </div>
                            </div>
                            <div className={`w-full ${isDarkMode ? 'bg-slate-700' : 'bg-slate-100'} rounded-full h-2 overflow-hidden`}>
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-purple-500 to-purple-700 transition-all duration-500"
                                style={{ width: `${pctVal}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                      {(!dashboard.top_staff || dashboard.top_staff.length === 0) && (
                        <p className="text-xs italic text-slate-400 text-center py-8">
                          No staff sales data yet.
                        </p>
                      )}
                    </div>
                  </Card>
                </div>
                </>)}

                {canAccess(currentUserRole, 'administration') && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                  <Card
                    title="Branch Performance"
                    subtitle="Sales by outlet (30 days)"
                    icon={<Building2 size={16} />}
                    isDarkMode={isDarkMode}
                  >
                    {branchSales.length === 0 ? (
                      <p className="text-xs text-center text-slate-400 py-20 italic">No branch data yet.</p>
                    ) : (
                      <div className="h-56">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={branchSales}>
                            <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#334155' : '#f1f5f9'} />
                            <XAxis dataKey="branch" fontSize={10} stroke={isDarkMode ? '#64748b' : '#94a3b8'} />
                            <YAxis fontSize={11} stroke={isDarkMode ? '#64748b' : '#94a3b8'} />
                            <Tooltip
                              contentStyle={tooltipStyle(isDarkMode)}
                              formatter={(value) => `₱${Number(value).toLocaleString()}`}
                            />
                            <Bar dataKey="sales" radius={[6, 6, 0, 0]}>
                              {branchSales.map((_, i) => (
                                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </Card>

                  <Card
                    title="Customer Tiers"
                    subtitle="Loyalty distribution"
                    icon={<Crown size={16} />}
                    isDarkMode={isDarkMode}
                  >
                    <div className="h-56">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={tierDistribution}
                            cx="50%" cy="50%"
                            innerRadius={45} outerRadius={75}
                            paddingAngle={3}
                            dataKey="count"
                            label={({ tier, count }) => `${tier} ${count}`}
                            labelLine={false}
                          >
                            {tierDistribution.map((entry, i) => (
                              <Cell key={i} fill={TIER_COLORS[entry.tier] || '#94a3b8'} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={tooltipStyle(isDarkMode)} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      {tierDistribution.map((t, i) => (
                        <div key={i} className="flex items-center gap-1.5 text-[11px]">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: TIER_COLORS[t.tier] }} />
                          <span className={isDarkMode ? 'text-slate-400' : 'text-slate-500'}>
                            {t.tier}: <strong>{t.count}</strong>
                          </span>
                        </div>
                      ))}
                    </div>
                  </Card>

                  <Card
                    title="Stock Health"
                    subtitle="Inventory status overview"
                    icon={<Package size={16} />}
                    isDarkMode={isDarkMode}
                  >
                    <div className="space-y-4 py-2">
                      <StockBar
                        label="Healthy (>5)"
                        count={inventoryList.filter(i => i.quantity > 5).length}
                        total={inventoryList.length}
                        color="lime"
                        isDarkMode={isDarkMode}
                      />
                      <StockBar
                        label="Low (≤5)"
                        count={inventoryList.filter(i => i.quantity > 0 && i.quantity <= 5).length}
                        total={inventoryList.length}
                        color="orange"
                        isDarkMode={isDarkMode}
                      />
                      <StockBar
                        label="Out of Stock"
                        count={inventoryList.filter(i => i.quantity <= 0).length}
                        total={inventoryList.length}
                        color="red"
                        isDarkMode={isDarkMode}
                      />
                    </div>
                    <div className={`mt-3 pt-3 border-t ${isDarkMode ? 'border-slate-700' : 'border-purple-100'} text-center`}>
                      <p className="text-[10px] uppercase text-slate-500">Total Items</p>
                      <p className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                        {inventoryList.length}
                      </p>
                    </div>
                  </Card>
                </div>
                )}

                {canAccess(currentUserRole, 'administration') && (

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                  <Card
                    title="Customer Split"
                    subtitle="New vs returning (30 days)"
                    icon={<Users2 size={16} />}
                    isDarkMode={isDarkMode}
                  >
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={[
                              { name: 'New', value: customerSplit.new || 0, color: '#3b82f6' },
                              { name: 'Returning', value: customerSplit.returning || 0, color: '#8b5cf6' },
                            ]}
                            cx="50%" cy="50%"
                            innerRadius={40} outerRadius={70}
                            dataKey="value"
                          >
                            <Cell fill="#3b82f6" />
                            <Cell fill="#8b5cf6" />
                          </Pie>
                          <Tooltip contentStyle={tooltipStyle(isDarkMode)} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex justify-around text-xs">
                      <div className="text-center">
                        <p className="text-blue-500 font-bold text-lg">{customerSplit.new || 0}</p>
                        <p className="text-slate-500 text-[10px] uppercase">New</p>
                      </div>
                      <div className="text-center">
                        <p className="text-purple-500 font-bold text-lg">{customerSplit.returning || 0}</p>
                        <p className="text-slate-500 text-[10px] uppercase">Returning</p>
                      </div>
                    </div>
                  </Card>

                  <Card
                    title="Product Categories"
                    subtitle="Stock distribution"
                    icon={<Archive size={16} />}
                    isDarkMode={isDarkMode}
                  >
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={productDistribution}
                            cx="50%" cy="50%"
                            innerRadius={40} outerRadius={70}
                            paddingAngle={3}
                            dataKey="value"
                          >
                            {productDistribution.map((entry, i) => (
                              <Cell key={i} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={tooltipStyle(isDarkMode)} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="grid grid-cols-2 gap-1 text-[10px] mt-1">
                      {productDistribution.slice(0, 4).map((p, i) => (
                        <div key={i} className="flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: p.color }} />
                          <span className={`truncate ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                            {p.name} ({p.percentage})
                          </span>
                        </div>
                      ))}
                    </div>
                  </Card>

                  <Card
                    title="Overall Health"
                    subtitle="Key metrics at a glance"
                    icon={<ActivityIcon size={16} />}
                    isDarkMode={isDarkMode}
                  >
                    <div className="space-y-4">
                      <RadialMetric
                        label="Room Utilization"
                        value={roomsState.length ? (occupiedRoomsCount / roomsState.length) * 100 : 0}
                        display={`${occupiedRoomsCount}/${roomsState.length}`}
                        color="#8b5cf6"
                        isDarkMode={isDarkMode}
                      />
                      <RadialMetric
                        label="Stock Health"
                        value={(inventoryList.filter(i => i.quantity > 5).length / Math.max(inventoryList.length, 1)) * 100}
                        display={`${inventoryList.filter(i => i.quantity > 5).length}/${inventoryList.length}`}
                        color="#8bc34a"
                        isDarkMode={isDarkMode}
                      />
                      <RadialMetric
                        label="Staff Assigned"
                        value={(staffList.filter(s => s.assignment !== 'Unassigned').length / Math.max(staffList.length, 1)) * 100}
                        display={`${staffList.filter(s => s.assignment !== 'Unassigned').length}/${staffList.length}`}
                        color="#f97316"
                        isDarkMode={isDarkMode}
                      />
                    </div>
                  </Card>
                </div>
                )}

              </>
            )}

            {canAccess(currentUserRole, 'users') && activeTab === 'users' && (
              <div className={`${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-purple-200'} border p-5 rounded-xl shadow-sm space-y-4`}>
                {activeBusinessName && (
                  <div className={`flex items-center justify-between gap-2 text-xs mb-3 px-3 py-2 rounded-lg ${isDarkMode ? 'bg-slate-700/60 text-slate-300' : 'bg-purple-50 text-purple-800'}`}>
                    <div className="flex items-center gap-2">
                      <Building2 size={13} className="text-purple-600 shrink-0" />
                      <span>Showing data for <strong>{activeBusinessName}</strong></span>
                    </div>
                    {isCompanyWide && (
                      <span className="text-[10px] font-bold text-purple-500 uppercase tracking-wide shrink-0">Company-wide view</span>
                    )}
                  </div>
                )}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 border-b pb-3">
                  <div>
                    <h3 className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>User Management Directory</h3>
                    <p className={`text-xs font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-400'}`}>{staffList.length} total users · {staffList.filter(s => s.status === 'Active').length} active</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => exportToCSV(staffList, 'users')} className={`border ${isDarkMode ? 'border-slate-700 hover:bg-slate-700 text-slate-400 hover:text-white' : 'border-purple-200 hover:bg-purple-50 text-purple-700'} font-medium text-xs px-3 py-2 rounded-xl flex items-center gap-1.5 transition-all`}>
                      <Download size={14} /> Export
                    </button>
                    {canAccess(currentUserRole, 'user_manage') && <button onClick={() => setShowUserModal(true)} className="bg-gradient-to-r from-purple-700 to-purple-900 hover:from-purple-600 hover:to-purple-800 text-white font-medium text-xs px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-all shadow-md">
                      <UserPlus size={14} /> Add User
                    </button>}
                  </div>
                </div>

                <div className={`${isDarkMode ? 'bg-slate-700/50 border-slate-700' : 'bg-gradient-to-r from-purple-50 to-purple-100/50 border-purple-200'} border p-3 rounded-xl flex flex-col md:flex-row items-center gap-3 text-xs font-semibold`}>
                  <div className="flex items-center gap-1 text-slate-600"><Filter size={13} /> <span>Filters:</span></div>
                  <div className="w-full md:w-44 space-y-0.5">
                    <span className="text-[10px] text-slate-400 block uppercase">Search</span>
                    <input type="text" placeholder="Type name or address..." value={userSearch} onChange={(e) => { setUserSearch(e.target.value); setUserPage(1); }} className={`w-full ${isDarkMode ? 'bg-slate-800 border-slate-600 text-white' : 'bg-white border-purple-200'} border p-1.5 rounded-lg outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all`} />
                  </div>
                  <div className="w-full md:w-40 space-y-0.5">
                    <span className="text-[10px] text-slate-400 block uppercase">Role</span>
                    <select value={userRoleFilter} onChange={(e) => { setUserRoleFilter(e.target.value); setUserPage(1); }} className={`w-full ${isDarkMode ? 'bg-slate-800 border-slate-600 text-white' : 'bg-white border-purple-200'} border p-1.5 rounded-lg font-medium outline-none focus:border-purple-500`}>
                      <option value="All">All Roles</option>
                      <option value="Cashier">Cashier</option>
                      <option value="Owner">Owner</option>
                      <option value="Branch Admin">Branch Admin</option>
                      <option value="Staff">Staff</option>
                    </select>
                  </div>
                  <div className="w-full md:w-36 space-y-0.5">
                    <span className="text-[10px] text-slate-400 block uppercase">Gender</span>
                    <select value={userGenderFilter} onChange={(e) => { setUserGenderFilter(e.target.value); setUserPage(1); }} className={`w-full ${isDarkMode ? 'bg-slate-800 border-slate-600 text-white' : 'bg-white border-purple-200'} border p-1.5 rounded-lg font-medium outline-none focus:border-purple-500`}>
                      <option value="All">All Genders</option>
                      <option value="Female">Female</option>
                      <option value="Male">Male</option>
                    </select>
                  </div>
                  <div className="w-full md:w-36 space-y-0.5">
                    <span className="text-[10px] text-slate-400 block uppercase">Status</span>
                    <select value={userStatusFilter} onChange={(e) => { setUserStatusFilter(e.target.value); setUserPage(1); }} className={`w-full ${isDarkMode ? 'bg-slate-800 border-slate-600 text-white' : 'bg-white border-purple-200'} border p-1.5 rounded-lg font-medium outline-none focus:border-purple-500`}>
                      <option value="All">All Statuses</option>
                      <option value="Active">Active</option>
                      <option value="Deactivated">Deactivated</option>
                    </select>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className={`border-b ${isDarkMode ? 'border-slate-700 text-slate-400' : 'border-purple-200 text-slate-400'} text-xs font-semibold uppercase ${isDarkMode ? 'bg-slate-700/50' : 'bg-gradient-to-r from-purple-50 to-purple-100'}`}>
                        <th className="py-2.5 px-4">User</th>
                        <th className="py-2.5 px-4">Role</th>
                        <th className="py-2.5 px-4">Assignment</th>
                        <th className="py-2.5 px-4 text-center">Status</th>
                        <th className="py-2.5 px-4 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${isDarkMode ? 'divide-slate-700' : 'divide-purple-100'}`}>
                      {paginatedUsers.map((staff) => (
                        <tr key={staff.id} className={`${isDarkMode ? 'hover:bg-slate-700/50' : 'hover:bg-purple-50/30'} transition-colors ${staff.status === 'Deactivated' ? 'opacity-60' : ''}`}>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 ${isDarkMode ? 'bg-slate-700 text-purple-300' : 'bg-gradient-to-br from-purple-100 to-purple-200 text-purple-700'} rounded-full flex items-center justify-center font-bold text-xs`}>
                                {staff.avatar || staff.name.split(' ').map(n => n[0]).join('')}
                              </div>
                              <div>
                                <p className={`font-semibold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{staff.name}</p>
                                <p className={`text-[10px] ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>{staff.email || 'No email'}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${staff.role === 'Admin' ? 'bg-purple-100 text-purple-700' : staff.role === 'Cashier' ? 'bg-lime-100 text-lime-700' : staff.role === 'Spa Therapist' ? 'bg-pink-100 text-pink-700' : 'bg-slate-100 text-slate-700'}`}>
                              {staff.role}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className={`text-xs font-medium ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                              {staff.assignment === 'Unassigned' ? <span className="text-orange-600">🔄 Unassigned</span> : <span className="text-purple-700">📍 {staff.assignment}</span>}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full ${staff.status === 'Active' ? 'bg-lime-50 text-lime-700 border border-lime-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${staff.status === 'Active' ? 'bg-lime-500' : 'bg-red-500'}`} />
                              {staff.status.toUpperCase()}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center justify-center gap-1.5">
                              <button onClick={() => viewUserProfile(staff)} className={`p-1.5 ${isDarkMode ? 'bg-slate-700 border-slate-600 text-purple-300 hover:bg-slate-600' : 'bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100'} border rounded-lg transition-all hover:scale-110`} title="View Profile">
                                <Eye size={13} />
                              </button>
                              {canAccess(currentUserRole, 'user_manage') && <button onClick={() => initEditUser(staff)} className={`p-1.5 ${isDarkMode ? 'bg-slate-700 border-slate-600 text-slate-400 hover:text-white hover:bg-slate-600' : 'bg-white border-purple-200 text-slate-500 hover:text-purple-800 hover:border-purple-300'} border rounded-lg transition-all hover:scale-110`} title="Edit">
                                <Edit3 size={13} />
                              </button>}
                              {canAccess(currentUserRole, 'user_manage') && <button onClick={() => toggleUserStatus(staff.id, staff.status)} className={`p-1.5 border rounded-lg transition-all hover:scale-110 ${staff.status === 'Active' ? 'bg-red-50 border-red-100 text-red-500 hover:bg-red-100' : 'bg-lime-50 border-lime-100 text-lime-600 hover:bg-lime-100'}`} title={staff.status === 'Active' ? 'Deactivate' : 'Activate'}>
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

                <div className={`flex justify-between items-center border-t pt-3 text-xs font-semibold ${isDarkMode ? 'text-slate-400 border-slate-700' : 'text-slate-400 border-purple-100'}`}>
                  <div>Showing {paginatedUsers.length} of {filteredUsers.length} users</div>
                  <div className="flex items-center gap-1">
                    <button disabled={userPage === 1} onClick={() => setUserPage(userPage - 1)} className={`px-3 py-1 border rounded-lg ${isDarkMode ? 'border-slate-700 bg-slate-800 text-white hover:bg-slate-700' : 'border-purple-200 bg-white hover:bg-purple-50'} disabled:opacity-40 text-xs transition-all flex items-center gap-1`}>
                      <ChevronLeft size={12} /> Prev
                    </button>
                    {Array.from({ length: Math.min(totalUserPages, 5) }, (_, i) => {
                      const pageNum = i + 1;
                      return (
                        <button key={pageNum} onClick={() => setUserPage(pageNum)} className={`w-7 h-7 rounded-lg text-xs font-bold transition-all ${userPage === pageNum ? 'bg-gradient-to-r from-purple-700 to-purple-900 text-white shadow-sm' : isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700' : 'bg-white border border-purple-200 text-slate-500 hover:bg-purple-50'}`}>
                          {pageNum}
                        </button>
                      );
                    })}
                    {totalUserPages > 5 && <span className="text-slate-400">...</span>}
                    <button disabled={userPage === totalUserPages} onClick={() => setUserPage(userPage + 1)} className={`px-3 py-1 border rounded-lg ${isDarkMode ? 'border-slate-700 bg-slate-800 text-white hover:bg-slate-700' : 'border-purple-200 bg-white hover:bg-purple-50'} disabled:opacity-40 text-xs transition-all flex items-center gap-1`}>
                      Next <ChevronRight size={12} />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ============================================================
                ============ ROOM STATUS (DYNAMIC + ADD ROOM) ============
                ============================================================ */}
            {canAccess(currentUserRole, 'rooms') && activeTab === 'rooms' && (
              <div className="space-y-6">
                {activeBusinessName && (
                <div className={`flex items-center justify-between gap-2 text-xs mb-2 px-3 py-2 rounded-lg ${isDarkMode ? 'bg-slate-700/60 text-slate-300' : 'bg-purple-50 text-purple-800'}`}>
                  <div className="flex items-center gap-2">
                    <Building2 size={13} className="text-purple-600 shrink-0" />
                    <span>Showing data for <strong>{activeBusinessName}</strong></span>
                  </div>
                  {isCompanyWide && (
                    <span className="text-[10px] font-bold text-purple-500 uppercase tracking-wide shrink-0">Company-wide view</span>
                  )}
                </div>
              )}
              {/* ============ SUMMARY CARDS ============ */}
                <div className={`grid grid-cols-1 md:grid-cols-4 gap-4 ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-gradient-to-r from-purple-50 via-purple-100 to-purple-50 border-purple-200'} p-5 border rounded-xl shadow-sm`}>
                  <div className="text-center md:border-r border-purple-200">
                    <span className={`text-xs block ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Occupied Rooms</span>
                    <div className={`text-2xl font-bold mt-1 ${isDarkMode ? 'text-purple-300' : 'text-purple-700'}`}>
                      {roomsState.filter(r => r.isOccupied).length} Active
                    </div>
                  </div>
                  <div className="text-center md:border-r border-purple-200">
                    <span className={`text-xs block ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Vacant Rooms</span>
                    <div className={`text-2xl font-bold mt-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                      {roomsState.filter(r => !r.isOccupied).length} Ready
                    </div>
                  </div>
                  <div className="text-center md:border-r border-purple-200">
                    <span className={`text-xs block ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Total Rooms</span>
                    <div className={`text-2xl font-bold mt-1 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                      {roomsState.length}
                    </div>
                  </div>
                  <div className="text-center">
                    <span className={`text-xs block ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Available Staff</span>
                    <div className={`text-2xl font-bold mt-1 ${isDarkMode ? 'text-lime-400' : 'text-lime-700'}`}>
                      {staffList.filter(s => s.status === 'Active').length} On-duty
                    </div>
                  </div>
                </div>

                {/* ============ HEADER WITH ADD ROOM BUTTON ============ */}
                <div className={`${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-purple-200'} border rounded-xl p-4 flex items-center justify-between shadow-sm`}>
                  <div>
                    <h3 className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                      Live Service Room Tracking
                    </h3>
                    <p className={`text-xs mt-0.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                      Real-time monitoring ng rooms, staff assignments, at service timers.
                    </p>
                  </div>
                  {canAccess(currentUserRole, 'room_manage') && (
                    <button
                      onClick={() => setShowNewRoomModal(true)}
                      className="bg-gradient-to-r from-purple-700 to-purple-900 hover:from-purple-600 hover:to-purple-800 text-white font-semibold text-xs px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-all shadow-md"
                    >
                      <Plus size={14} /> Add New Room
                    </button>
                  )}
                </div>

                {/* ============ ROOM ZONES (DYNAMIC) ============ */}
                {roomZones.length === 0 ? (
                  <div className={`${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-purple-200'} border rounded-xl p-12 text-center`}>
                    <DoorOpen size={48} className={`mx-auto mb-3 ${isDarkMode ? 'text-slate-600' : 'text-slate-300'}`} />
                    <p className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>No rooms yet.</p>
                    {canAccess(currentUserRole, 'room_manage') && (
                      <button
                        onClick={() => setShowNewRoomModal(true)}
                        className="mt-3 bg-gradient-to-r from-purple-700 to-purple-900 hover:from-purple-600 hover:to-purple-800 text-white font-semibold text-xs px-4 py-2 rounded-xl inline-flex items-center gap-1.5 transition-all"
                      >
                        <Plus size={14} /> Add First Room
                      </button>
                    )}
                  </div>
                ) : (
                  roomZones.map((zone, idx) => (
                    <div key={idx} className="space-y-3">
                      <h4 className={`text-[11px] font-bold uppercase ${isDarkMode ? 'text-slate-400 bg-slate-800 border-slate-700' : 'text-slate-500 bg-purple-100 border-purple-200'} border px-3 py-1.5 rounded-lg w-fit tracking-wide flex items-center gap-2`}>
                        <DoorOpen size={12} />
                        {zone.title} ({zone.ids.length} rooms)
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                        {roomsState
                          .filter(r => r.id >= zone.min && r.id <= zone.max)
                          .map((room) => {
                            const isOccupied = room.isOccupied;
                            // ✅ DYNAMIC: Kunin lang ang specific na staff na naka-assign sa room na ito
                            const assignedStaffMember = room.assignedStaffId
                              ? staffList.find((s) => String(s.userId) === String(room.assignedStaffId) || String(s.id) === String(room.assignedStaffId))
                              : null;

                            // ✅ Live timer compute
                            let liveTimeLeft = room.timeLeft;
                            if (isOccupied && room.startTime && room.durationMinutes) {
                              const startMs = new Date(room.startTime).getTime();
                              const endMs = startMs + room.durationMinutes * 60 * 1000;
                              const nowMs = Date.now();
                              liveTimeLeft = Math.max(0, Math.ceil((endMs - nowMs) / 60000));
                            }

                            return (
                              <div
                                key={room.id}
                                className={`${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-purple-200'} border rounded-xl p-4 shadow-sm flex flex-col justify-between transition-all duration-200 hover:shadow-md ${
                                  isOccupied ? 'border-purple-500 ring-1 ring-purple-500/20' : 'hover:border-purple-300'
                                }`}
                              >
                                <div className="flex justify-between items-center border-b pb-2">
                                  <span className={`font-bold text-sm truncate ${isDarkMode ? 'text-white' : 'text-slate-800'}`} title={room.name}>
                                    {room.name || `Room Suite ${room.id}`}
                                  </span>
                                  <span className={`text-[8px] font-bold px-2 py-0.5 rounded-full shrink-0 ml-2 ${
                                    isOccupied
                                      ? 'bg-gradient-to-r from-purple-700 to-purple-900 text-white shadow-sm'
                                      : 'bg-purple-100 text-slate-400'
                                  }`}>
                                    {isOccupied ? 'RUNNING' : 'VACANT'}
                                  </span>
                                </div>

                                <div className="mt-3 space-y-2 text-xs font-medium">
                                  {isOccupied ? (
                                    <div className={`${isDarkMode ? 'bg-slate-700 border-slate-600' : 'bg-purple-50 border-purple-200'} border rounded-lg p-2 space-y-1 text-[11px]`}>
                                      <p className={`font-semibold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                                        Guest: <span className="underline">{room.customer}</span>
                                      </p>
                                      <p className={isDarkMode ? 'text-slate-400' : 'text-slate-500'}>
                                        Type: {room.service}
                                      </p>
                                      <div className={`${
                                        liveTimeLeft === 0
                                          ? 'text-red-500'
                                          : liveTimeLeft <= 5
                                            ? 'text-orange-500'
                                            : (isDarkMode ? 'text-purple-300' : 'text-purple-700')
                                      } font-bold pt-1 mt-1 border-t border-dashed ${isDarkMode ? 'border-slate-600' : 'border-purple-200'} flex items-center gap-1`}>
                                        <Clock size={10} />
                                        {liveTimeLeft === 0 ? 'Time is up!' : `Time Left: ${liveTimeLeft} mins`}
                                      </div>
                                    </div>
                                  ) : (
                                    <p className={`${isDarkMode ? 'text-slate-500' : 'text-slate-400'} italic text-[11px] py-2`}>
                                      Ready for check-in
                                    </p>
                                  )}

                                  {/* ✅ DYNAMIC ASSIGNED STAFF */}
                                  <div className="pt-2 border-t text-[10px]">
                                    <span className={`${isDarkMode ? 'text-slate-400' : 'text-slate-400'} block uppercase font-semibold mb-1`}>
                                      Assigned Staff:
                                    </span>
                                    {isOccupied ? (
                                      assignedStaffMember ? (
                                        <div className={`font-semibold flex items-center gap-1.5 text-[11px] ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                                          <span className="w-1.5 h-1.5 bg-lime-500 rounded-full"></span>
                                          {assignedStaffMember.name}
                                          <span className="text-[9px] text-slate-500">({assignedStaffMember.role})</span>
                                        </div>
                                      ) : (
                                        <span className="text-[9px] font-semibold text-slate-400 italic">
                                          No staff assigned
                                        </span>
                                      )
                                    ) : (
                                      <span className={`text-[9px] italic ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>—</span>
                                    )}
                                  </div>
                                </div>

                                <div className="mt-4 pt-2 border-t">
                                  {isOccupied && canAccess(currentUserRole, 'room_manage') ? (
                                    <button
                                      onClick={() => handleEvacuateRoom(room.id)}
                                      className="w-full bg-red-50 hover:bg-red-100 text-red-600 font-semibold text-[11px] py-1.5 rounded-lg transition-all"
                                    >
                                      Release Room
                                    </button>
                                  ) : !isOccupied && canAccess(currentUserRole, 'room_manage') ? (
                                    <button
                                      disabled={staffList.filter(s => s.status === 'Active').length === 0}
                                      onClick={() => {
                                        setSelectedRoomId(room.id);
                                        setShowRoomModal(true);
                                      }}
                                      className={`w-full ${
                                        staffList.filter(s => s.status === 'Active').length === 0
                                          ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                          : 'bg-purple-50 hover:bg-gradient-to-r hover:from-purple-700 hover:to-purple-900 hover:text-white border border-purple-200'
                                      } font-semibold text-[11px] py-1.5 rounded-lg flex items-center justify-center space-x-1 transition-all`}
                                    >
                                      <Plus size={12} /> <span>Check-In</span>
                                    </button>
                                  ) : (
                                    <span className="block text-center text-[10px] italic text-slate-400">
                                      Read-only view
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {canAccess(currentUserRole, 'inventory') && activeTab === 'inventory' && (
              <div className={`${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-purple-200'} border p-5 rounded-xl shadow-sm space-y-4`}>
                {activeBusinessName && (
                  <div className={`flex items-center justify-between gap-2 text-xs mb-3 px-3 py-2 rounded-lg ${isDarkMode ? 'bg-slate-700/60 text-slate-300' : 'bg-purple-50 text-purple-800'}`}>
                    <div className="flex items-center gap-2">
                      <Building2 size={13} className="text-purple-600 shrink-0" />
                      <span>Showing data for <strong>{activeBusinessName}</strong></span>
                    </div>
                    {isCompanyWide && (
                      <span className="text-[10px] font-bold text-purple-500 uppercase tracking-wide shrink-0">Company-wide view</span>
                    )}
                  </div>
                )}
                <div className="flex justify-between items-center border-b pb-3">
                  <div>
                    <h3 className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Product Warehouse Stock Registry</h3>
                    <p className={`text-xs font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-400'}`}>{inventoryList.length} total items · {inventoryList.filter(i => i.quantity <= 5).length} low stock</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => exportToCSV(inventoryList, 'inventory')} className={`border ${isDarkMode ? 'border-slate-700 hover:bg-slate-700 text-slate-400 hover:text-white' : 'border-purple-200 hover:bg-purple-50 text-purple-700'} font-medium text-xs px-3 py-2 rounded-xl flex items-center gap-1.5 transition-all`}>
                      <Download size={14} /> Export
                    </button>
                    {canAccess(currentUserRole, 'inventory_manage') && <button onClick={() => setShowProductModal(true)} className="bg-gradient-to-r from-purple-700 to-purple-900 hover:from-purple-600 hover:to-purple-800 text-white font-medium text-xs px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-all shadow-md">
                      <Plus size={14} /> Add Product
                    </button>}
                  </div>
                </div>

                <div className={`${isDarkMode ? 'bg-slate-700/50 border-slate-700' : 'bg-gradient-to-r from-purple-50 to-purple-100/50 border-purple-200'} border p-3 rounded-xl flex flex-col md:flex-row items-center gap-3 text-xs font-semibold`}>
                  <div className="flex items-center gap-1 text-slate-600"><Filter size={13} /> <span>Filters:</span></div>
                  <div className="w-full md:w-44 space-y-0.5">
                    <span className="text-[10px] text-slate-400 block uppercase">Search</span>
                    <input type="text" placeholder="Search product..." value={productSearch} onChange={(e) => { setProductSearch(e.target.value); setProductPage(1); }} className={`w-full ${isDarkMode ? 'bg-slate-800 border-slate-600 text-white' : 'bg-white border-purple-200'} border p-1.5 rounded-lg outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all`} />
                  </div>
                  <div className="w-full md:w-40 space-y-0.5">
                    <span className="text-[10px] text-slate-400 block uppercase">Category</span>
                    <select value={productCategoryFilter} onChange={(e) => { setProductCategoryFilter(e.target.value); setProductPage(1); }} className={`w-full ${isDarkMode ? 'bg-slate-800 border-slate-600 text-white' : 'bg-white border-purple-200'} border p-1.5 rounded-lg font-medium outline-none focus:border-purple-500`}>
                      <option value="All">All Categories</option>
                      {catalogCategories.filter(c => c.kind === "PRODUCT" || !c.kind).map(c => (
                        <option key={c.id} value={c.name}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="w-full md:w-40 space-y-0.5">
                    <span className="text-[10px] text-slate-400 block uppercase">Stock Level</span>
                    <select value={productStockFilter} onChange={(e) => { setProductStockFilter(e.target.value); setProductPage(1); }} className={`w-full ${isDarkMode ? 'bg-slate-800 border-slate-600 text-white' : 'bg-white border-purple-200'} border p-1.5 rounded-lg font-medium outline-none focus:border-purple-500`}>
                      <option value="All">All Items</option>
                      <option value="Stable">Stable (&gt; 5)</option>
                      <option value="Low">Low Stock (&le; 5)</option>
                    </select>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className={`border-b ${isDarkMode ? 'border-slate-700 text-slate-400' : 'border-purple-200 text-slate-400'} text-xs font-semibold uppercase ${isDarkMode ? 'bg-slate-700/50' : 'bg-gradient-to-r from-purple-50 to-purple-100'}`}>
                        <th className="py-2.5 px-4">Product</th>
                        <th className="py-2.5 px-4">Category</th>
                        <th className="py-2.5 px-4">Quantity</th>
                        <th className="py-2.5 px-4">Price</th>
                        <th className="py-2.5 px-4 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${isDarkMode ? 'divide-slate-700' : 'divide-purple-100'}`}>
                      {paginatedProducts.map((item) => {
                        const stockLevel = item.quantity <= 0 ? 'out' : item.quantity <= 5 ? 'low' : 'high';
                        const stockColors = {
                          out: 'bg-red-100 text-red-700 border-red-200',
                          low: 'bg-orange-100 text-orange-700 border-orange-200',
                          high: 'bg-lime-100 text-lime-700 border-lime-200'
                        };

                        return (
                          <tr key={item.id} className={isDarkMode ? 'hover:bg-slate-700/50' : 'hover:bg-purple-50/30'} transition-colors>
                            <td className={`py-3 px-4 font-semibold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{item.name}</td>
                            <td className="py-3 px-4">
                              <span className={`text-xs ${isDarkMode ? 'bg-slate-700 text-slate-300' : 'bg-purple-100 text-purple-700'} px-2 py-1 rounded-full`}>{item.category}</span>
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-3">
                                <span className={`font-mono font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{item.quantity}</span>
                                <div className="flex-1 min-w-[40px]">
                                  <div className={`w-full ${isDarkMode ? 'bg-slate-700' : 'bg-purple-100'} rounded-full h-1.5`}>
                                    <div className={`h-1.5 rounded-full transition-all duration-500 ${stockLevel === 'low' ? 'bg-orange-500' : 'bg-lime-500'}`} style={{ width: `${Math.min((item.quantity / 50) * 100, 100)}%` }} />
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className={`py-3 px-4 font-semibold ${isDarkMode ? 'text-purple-300' : 'text-purple-700'}`}>₱{item.price.toFixed(2)}</td>
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

                <div className={`flex justify-between items-center border-t pt-3 text-xs font-semibold ${isDarkMode ? 'text-slate-400 border-slate-700' : 'text-slate-400 border-purple-100'}`}>
                  <div>Showing {paginatedProducts.length} of {filteredProducts.length} items</div>
                  <div className="flex items-center gap-1">
                    <button disabled={productPage === 1} onClick={() => setProductPage(productPage - 1)} className={`px-3 py-1 border rounded-lg ${isDarkMode ? 'border-slate-700 bg-slate-800 text-white hover:bg-slate-700' : 'border-purple-200 bg-white hover:bg-purple-50'} disabled:opacity-40 text-xs transition-all flex items-center gap-1`}>
                      <ChevronLeft size={12} /> Prev
                    </button>
                    {Array.from({ length: Math.min(totalProductPages, 5) }, (_, i) => {
                      const pageNum = i + 1;
                      return (
                        <button key={pageNum} onClick={() => setProductPage(pageNum)} className={`w-7 h-7 rounded-lg text-xs font-bold transition-all ${productPage === pageNum ? 'bg-gradient-to-r from-purple-700 to-purple-900 text-white shadow-sm' : isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700' : 'bg-white border border-purple-200 text-slate-500 hover:bg-purple-50'}`}>
                          {pageNum}
                        </button>
                      );
                    })}
                    {totalProductPages > 5 && <span className="text-slate-400">...</span>}
                    <button disabled={productPage === totalProductPages} onClick={() => setProductPage(productPage + 1)} className={`px-3 py-1 border rounded-lg ${isDarkMode ? 'border-slate-700 bg-slate-800 text-white hover:bg-slate-700' : 'border-purple-200 bg-white hover:bg-purple-50'} disabled:opacity-40 text-xs transition-all flex items-center gap-1`}>
                      Next <ChevronRight size={12} />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'catalog_availability' && canAccess(currentUserRole, 'catalog') && (
              <AvailabilityMatrixPage isDarkMode={isDarkMode} activeBusinessName={activeBusinessName} activeBusiness={activeBusiness} isCompanyWide={isCompanyWide} />
            )}

            {canAccess(currentUserRole, 'audit') && activeTab === 'audit_controls' && (
              <div className={`${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-purple-200'} border p-5 rounded-xl shadow-sm space-y-4`}>
                {activeBusinessName && (
                  <div className={`flex items-center justify-between gap-2 text-xs mb-3 px-3 py-2 rounded-lg ${isDarkMode ? 'bg-slate-700/60 text-slate-300' : 'bg-purple-50 text-purple-800'}`}>
                    <div className="flex items-center gap-2">
                      <Building2 size={13} className="text-purple-600 shrink-0" />
                      <span>Showing data for <strong>{activeBusinessName}</strong></span>
                    </div>
                    {isCompanyWide && (
                      <span className="text-[10px] font-bold text-purple-500 uppercase tracking-wide shrink-0">Company-wide view</span>
                    )}
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Security Audit Log Records</h3>
                    <p className={`text-xs font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-400'}`}>System tracking log mapping security updates and modifications.</p>
                  </div>
                  <button onClick={() => exportToCSV(auditLogs, 'audit_logs')} className={`border ${isDarkMode ? 'border-slate-700 hover:bg-slate-700 text-slate-400 hover:text-white' : 'border-purple-200 hover:bg-purple-50 text-purple-700'} font-medium text-xs px-3 py-2 rounded-xl flex items-center gap-1.5 transition-all`}>
                    <Download size={14} /> Export
                  </button>
                </div>

                <div className="relative w-full max-w-sm">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 text-slate-400"><Search size={13} /></span>
                  <input type="text" placeholder="Search logs..." value={auditSearch} onChange={(e) => { setAuditSearch(e.target.value); setAuditPage(1); }} className={`w-full ${isDarkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-purple-50 border-purple-200'} border pl-8 pr-3 py-1.5 text-xs rounded-lg outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all font-medium`} />
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className={`border-b ${isDarkMode ? 'border-slate-700 text-slate-400' : 'border-purple-200 text-slate-400'} text-xs font-semibold uppercase ${isDarkMode ? 'bg-slate-700/50' : 'bg-gradient-to-r from-purple-50 to-purple-100'}`}>
                        <th className="py-2.5 px-4">Timestamp</th>
                        <th className="py-2.5 px-4">Action</th>
                        <th className="py-2.5 px-4">Target</th>
                        <th className="py-2.5 px-4">Request</th>
                        <th className="py-2.5 px-4">Agent</th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${isDarkMode ? 'divide-slate-700' : 'divide-purple-100'}`}>
                      {paginatedAudits.map((log) => (
                        <tr key={log.id} className={isDarkMode ? 'hover:bg-slate-700/50' : 'hover:bg-purple-50/30'} transition-colors>
                          <td className={`py-3 px-4 font-mono ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{log.time}</td>
                          <td className="py-3 px-4">
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${log.type === 'VOID' ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-purple-50 text-purple-700 border border-purple-100'}`}>
                              {log.type}
                            </span>
                          </td>
                          <td className={`py-3 px-4 font-semibold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{log.target}</td>
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

                <div className={`flex justify-between items-center border-t pt-3 text-xs font-semibold ${isDarkMode ? 'text-slate-400 border-slate-700' : 'text-slate-400 border-purple-100'}`}>
                  <div>Showing {paginatedAudits.length} of {filteredAudits.length} events</div>
                  <div className="flex items-center gap-1">
                    <button disabled={auditPage === 1} onClick={() => setAuditPage(auditPage - 1)} className={`px-3 py-1 border rounded-lg ${isDarkMode ? 'border-slate-700 bg-slate-800 text-white hover:bg-slate-700' : 'border-purple-200 bg-white hover:bg-purple-50'} disabled:opacity-40 text-xs transition-all flex items-center gap-1`}>
                      <ChevronLeft size={12} /> Prev
                    </button>
                    {Array.from({ length: Math.min(totalAuditPages, 5) }, (_, i) => {
                      const pageNum = i + 1;
                      return (
                        <button key={pageNum} onClick={() => setAuditPage(pageNum)} className={`w-7 h-7 rounded-lg text-xs font-bold transition-all ${auditPage === pageNum ? 'bg-gradient-to-r from-purple-700 to-purple-900 text-white shadow-sm' : isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700' : 'bg-white border border-purple-200 text-slate-500 hover:bg-purple-50'}`}>
                          {pageNum}
                        </button>
                      );
                    })}
                    {totalAuditPages > 5 && <span className="text-slate-400">...</span>}
                    <button disabled={auditPage === totalAuditPages} onClick={() => setAuditPage(auditPage + 1)} className={`px-3 py-1 border rounded-lg ${isDarkMode ? 'border-slate-700 bg-slate-800 text-white hover:bg-slate-700' : 'border-purple-200 bg-white hover:bg-purple-50'} disabled:opacity-40 text-xs transition-all flex items-center gap-1`}>
                      Next <ChevronRight size={12} />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {canAccess(currentUserRole, 'documentation') && activeTab === 'documentation' && (
              <DocumentationPage isDarkMode={isDarkMode} />
            )}

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




