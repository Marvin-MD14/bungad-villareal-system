import { useEffect, useRef, useState } from 'react';
import {
  Shield, Menu, X, Home, Info, Grid, HelpCircle, Phone,
  LogIn, Zap, MessageSquare, LineChart, Lock,
  MapPin, CheckCircle, Clock, AlertTriangle, FileText,
  Crown, Sparkles, Building2, Layers, Award,
  Scissors, Users, Mail, ArrowRight,
} from 'lucide-react';
import { API_BASE_URL } from '../utils/api';

// -----------------------------------------------------------------------------
// Marketing landing + role-aware login.
//
// There is deliberately NO customer self-registration here: customers are
// created by staff (POS / Clients page) so their loyalty balance stays scoped
// to the tenant that owns them. The only actions are the contextual logins.
//
// Deep links (/admin/login, /owner/login, /manager/login, /cashier/login,
// /staff/login) open the modal pre-filled for that role. A cashier who logs in
// this way lands straight on the POS, and App.jsx flips that to full-screen on
// a desktop so the till takes the whole viewport.
// -----------------------------------------------------------------------------

const DEMO_ACCOUNTS = {
  admin:   { label: 'Superadmin',        username: 'demo_superadmin',       password: 'DemoSuperadmin!2026',       icon: <Shield size={14} />,     tone: 'slate' },
  owner:   { label: 'Owner',             username: 'demo_owner',            password: 'DemoOwner!2026',            icon: <Crown size={14} />,      tone: 'amber' },
  manager: { label: 'Business Manager',  username: 'demo_business_manager', password: 'DemoBusinessManager!2026',  icon: <Building2 size={14} />,  tone: 'purple' },
  cashier: { label: 'Cashier',           username: 'demo_cashier',          password: 'DemoCashier!2026',          icon: <Zap size={14} />,        tone: 'cyan' },
  staff:   { label: 'Staff',             username: 'demo_staff',            password: 'DemoStaff!2026',            icon: <Sparkles size={14} />,   tone: 'emerald' },
};

const ROLE_ORDER = ['admin', 'owner', 'manager', 'cashier', 'staff'];

const QUICK_ACCOUNTS = ROLE_ORDER.map((key) => ({ key, ...DEMO_ACCOUNTS[key] }));

// ---- Reveal-on-scroll wrapper -----------------------------------------------
function Reveal({ children, delay = 0, className = '' }) {
  const ref = useRef(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setShown(true);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -60px 0px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${className}`}
      style={{
        opacity: shown ? 1 : 0,
        transform: shown ? 'translateY(0)' : 'translateY(28px)',
        transitionDelay: `${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

// ---- Small helpers ----------------------------------------------------------
function NavLink({ icon, label, targetId, onClick }) {
  const handle = () => {
    if (onClick) return onClick();
    const node = document.getElementById(targetId);
    if (node) node.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  return (
    <button
      type="button"
      onClick={handle}
      className="flex items-center gap-1.5 text-sm text-slate-700 hover:text-purple-700 transition-colors"
    >
      {icon} {label}
    </button>
  );
}

function FeatureCard({ icon, title, description, tone = 'purple', delay = 0 }) {
  const tones = {
    purple: 'bg-purple-100 text-purple-700',
    lime: 'bg-lime-100 text-lime-700',
    amber: 'bg-amber-100 text-amber-700',
    rose: 'bg-rose-100 text-rose-700',
    blue: 'bg-blue-100 text-blue-700',
    emerald: 'bg-emerald-100 text-emerald-700',
  };
  return (
    <Reveal delay={delay}>
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all h-full">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${tones[tone] || tones.purple}`}>
          {icon}
        </div>
        <h3 className="text-sm font-bold text-slate-800">{title}</h3>
        <p className="mt-2 text-xs leading-relaxed text-slate-500">{description}</p>
      </div>
    </Reveal>
  );
}

function Step({ number, title, description, delay = 0 }) {
  return (
    <Reveal delay={delay}>
      <div className="flex gap-4">
        <div className="shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-purple-600 to-purple-800 text-white font-bold flex items-center justify-center shadow-md">
          {number}
        </div>
        <div>
          <h4 className="text-sm font-bold text-slate-800">{title}</h4>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">{description}</p>
        </div>
      </div>
    </Reveal>
  );
}

// ---- Landing page -----------------------------------------------------------
export default function LandingPage({ onLoginSuccess }) {
  const [loginOpen, setLoginOpen] = useState(false);
  const [loginRole, setLoginRole] = useState('cashier');
  const [loginForm, setLoginForm] = useState({
    username: DEMO_ACCOUNTS.cashier.username,
    password: DEMO_ACCOUNTS.cashier.password,
  });
  const [loginError, setLoginError] = useState('');
  const [busy, setBusy] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Deep-link support: /admin/login, /owner/login, /manager/login,
  // /cashier/login, /staff/login open the modal prefilled for that role.
  useEffect(() => {
    const match = window.location.pathname.match(/^\/(admin|owner|manager|cashier|staff)\/login\/?$/);
    if (match) {
      const role = match[1];
      setLoginRole(role);
      setLoginForm({
        username: DEMO_ACCOUNTS[role].username,
        password: DEMO_ACCOUNTS[role].password,
      });
      setLoginOpen(true);
    }
  }, []);

  const openLogin = (role = 'cashier') => {
    const account = DEMO_ACCOUNTS[role] || DEMO_ACCOUNTS.cashier;
    setLoginRole(role);
    setLoginForm({ username: account.username, password: account.password });
    setLoginError('');
    setLoginOpen(true);
  };

  const quickPick = (role) => {
    const account = DEMO_ACCOUNTS[role];
    setLoginRole(role);
    setLoginForm({ username: account.username, password: account.password });
  };

  const submitLogin = async (e) => {
    e.preventDefault();
    setBusy(true);
    setLoginError('');
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm),
      });
      const data = await response.json();
      if (!response.ok) {
        setLoginError(data.detail || 'Invalid credentials');
        return;
      }
      onLoginSuccess(data);
    } catch (err) {
      setLoginError('Cannot connect to server. Please make sure the backend is running.');
    } finally {
      setBusy(false);
    }
  };

  const scrollTo = (id) => {
    setMobileMenuOpen(false);
    const node = document.getElementById(id);
    if (node) node.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 overflow-x-hidden">
      {/* ============ HEADER ============ */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-purple-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Full logo, no box: height fixed, width auto so nothing is cropped */}
            <img
              src="/villareal-logo.png"
              alt="Villareal"
              className="h-16 w-auto max-w-[240px] object-contain"
            />
            <div className="border-l border-slate-200 pl-3">
              <h1 className="text-slate-900 font-bold text-lg leading-none">Bungad &amp; Villareal</h1>
              <p className="text-purple-700 text-[10px] font-semibold tracking-[0.2em] mt-1">MANAGEMENT SYSTEM</p>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-8">
            <NavLink icon={<Home size={16} />} label="Home" targetId="home" />
            <NavLink icon={<Info size={16} />} label="About" targetId="about" />
            <NavLink icon={<Grid size={16} />} label="Features" targetId="features" />
            <NavLink icon={<HelpCircle size={16} />} label="How It Works" targetId="how" />
            <NavLink icon={<Phone size={16} />} label="Contact" targetId="contact" />
            <button
              type="button"
              onClick={() => openLogin('cashier')}
              className="bg-amber-400 hover:bg-amber-500 text-purple-900 font-bold px-6 py-2 rounded-lg flex items-center gap-2 transition-all shadow-md"
            >
              <LogIn size={16} /> Login
            </button>
          </nav>

          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden text-purple-900"
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden border-t border-purple-100 bg-white px-4 py-3 space-y-3 shadow-lg">
            <button type="button" onClick={() => scrollTo('home')} className="block w-full text-left text-sm font-medium text-slate-700 hover:text-purple-700">Home</button>
            <button type="button" onClick={() => scrollTo('about')} className="block w-full text-left text-sm font-medium text-slate-700 hover:text-purple-700">About</button>
            <button type="button" onClick={() => scrollTo('features')} className="block w-full text-left text-sm font-medium text-slate-700 hover:text-purple-700">Features</button>
            <button type="button" onClick={() => scrollTo('how')} className="block w-full text-left text-sm font-medium text-slate-700 hover:text-purple-700">How It Works</button>
            <button type="button" onClick={() => scrollTo('contact')} className="block w-full text-left text-sm font-medium text-slate-700 hover:text-purple-700">Contact</button>
            <button
              type="button"
              onClick={() => { setMobileMenuOpen(false); openLogin('cashier'); }}
              className="w-full bg-amber-400 text-purple-900 font-bold py-2 rounded-lg flex items-center justify-center gap-2"
            >
              <LogIn size={16} /> Login
            </button>
          </div>
        )}
      </header>

      {/* ============ HERO ============ */}
      <section id="home" className="max-w-7xl mx-auto px-4 py-16 grid md:grid-cols-2 gap-12 items-center">
        <Reveal>
          <div>
            <div className="inline-flex items-center gap-2 bg-white border border-purple-200 rounded-full px-4 py-2 mb-6 shadow-sm">
              <MapPin size={14} className="text-amber-400" />
              <span className="text-purple-800 text-xs font-semibold tracking-wide">BUNGAD &amp; VILLAREAL — OFFICIAL SYSTEM</span>
            </div>

            <h2 className="text-4xl md:text-6xl font-extrabold text-slate-950 mb-4 leading-tight tracking-tight">
              Bungad &amp; Villareal{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-700 to-fuchsia-700">
                Management System
              </span>
            </h2>

            <p className="text-slate-600 text-base md:text-lg mb-8 leading-relaxed">
              A modern, AI-powered management platform for the Bungad &amp; Villareal Group.
              Manage POS, inventory, loyalty, and staff — all in one secure system.
            </p>

            <div className="flex flex-wrap gap-4 mb-8">
              <button
                type="button"
                onClick={() => openLogin('cashier')}
                className="bg-amber-400 hover:bg-amber-500 text-purple-900 font-bold px-6 py-3 rounded-lg flex items-center gap-2 transition-all shadow-lg"
              >
                <LogIn size={18} /> Login to Your Account
              </button>
              <button
                type="button"
                onClick={() => scrollTo('features')}
                className="border-2 border-purple-200 hover:border-purple-700 text-purple-800 hover:bg-purple-50 font-bold px-6 py-3 rounded-xl flex items-center gap-2 transition-all"
              >
                <Grid size={18} /> Explore Features
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 max-w-md">
              {[
                { icon: <Zap size={18} />, label: 'Real-Time POS' },
                { icon: <MessageSquare size={18} />, label: 'SMS Notifications' },
                { icon: <LineChart size={18} />, label: 'Real-Time Analytics' },
                { icon: <Lock size={18} />, label: 'Secure Records' },
              ].map((f, i) => (
                <div key={i} className="bg-white border border-purple-100 rounded-xl px-4 py-3 flex items-center gap-2 shadow-sm hover:shadow-md transition-shadow">
                  <span className="text-amber-400">{f.icon}</span>
                  <span className="text-slate-700 text-sm font-semibold">{f.label}</span>
                </div>
              ))}
            </div>
          </div>
        </Reveal>

        <Reveal delay={150}>
          <div className="bg-white border border-purple-100 rounded-3xl p-6 md:p-8 shadow-xl shadow-purple-900/5">
            <div className="text-center">
              {/* Full logo, no box / no padding frame: shown at its natural proportions */}
              <img
                src="/villareal-logo.png"
                alt="Bungad & Villareal"
                className="w-full max-w-lg h-auto object-contain mx-auto mb-6 scale-110"
              />
              <h3 className="text-slate-900 font-bold text-xl mb-6">Bungad &amp; Villareal Group</h3>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3 text-left">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 text-xs">System Status</span>
                  <span className="text-emerald-400 text-xs font-bold flex items-center gap-1">
                    <span className="w-2 h-2 bg-emerald-400 rounded-full"></span> Online
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 text-xs">Response Time</span>
                  <span className="text-amber-400 text-xs font-bold">&lt; 24 hours</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 text-xs">Coverage</span>
                  <span className="text-amber-400 text-xs font-bold">Bungad, Villareal</span>
                </div>
              </div>

              <p className="text-slate-500 text-xs mt-6 flex items-center justify-center gap-1">
                <Lock size={12} /> SSL Secured • 24/7 Available
              </p>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ============ STATS STRIP ============ */}
      <section className="max-w-7xl mx-auto px-4 pb-16">
        <Reveal>
          <div className="bg-white rounded-2xl shadow-2xl grid grid-cols-2 md:grid-cols-4 gap-0 overflow-hidden">
            {[
              { icon: <FileText size={28} />, label: 'Manage POS', color: 'purple' },
              { icon: <CheckCircle size={28} />, label: 'Track Inventory', color: 'emerald' },
              { icon: <Clock size={28} />, label: 'Loyalty Rewards', color: 'amber' },
              { icon: <AlertTriangle size={28} />, label: 'Staff Management', color: 'rose' },
            ].map((stat, i) => (
              <div key={i} className="p-6 text-center border-r last:border-r-0 border-slate-100">
                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3 ${
                    stat.color === 'purple' ? 'bg-purple-100 text-purple-600' :
                    stat.color === 'emerald' ? 'bg-emerald-100 text-emerald-600' :
                    stat.color === 'amber' ? 'bg-amber-100 text-amber-600' :
                    'bg-rose-100 text-rose-600'
                  }`}
                >
                  {stat.icon}
                </div>
                <p className="text-slate-800 font-bold text-sm">{stat.label}</p>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      {/* ============ ABOUT ============ */}
      <section id="about" className="bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 py-20">
          <Reveal>
            <div className="max-w-2xl">
              <p className="text-[11px] font-bold uppercase tracking-widest text-purple-700">About</p>
              <h2 className="mt-3 text-3xl md:text-4xl font-black text-slate-800">
                Built for the way the company runs every day.
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-slate-500">
                Bungad &amp; Villareal operates several businesses under one roof — a spa, a
                cosmetics line, a bakery, a menu kitchen, and more. The system isolates
                each business so their books, staff, and customers never mix, while the
                owner still sees the whole company on one screen.
              </p>
            </div>
          </Reveal>

          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              { icon: <Scissors size={20} />, title: 'Multi-Business', text: 'One company, many outlets. Switch tenants in one click without ever crossing data.' },
              { icon: <Clock size={20} />, title: 'Real-Time Operations', text: 'Rooms, shifts, stock and sales update the moment they happen — no batch imports.' },
              { icon: <Award size={20} />, title: 'Loyalty & Rewards', text: 'Automatic tier upgrades, points ledger, and free-item thresholds per business.' },
            ].map((card, i) => (
              <Reveal key={card.title} delay={i * 100}>
                <div className="rounded-2xl border border-slate-200 bg-white p-6 h-full">
                  <div className="w-11 h-11 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
                    {card.icon}
                  </div>
                  <h3 className="mt-4 text-sm font-bold text-slate-800">{card.title}</h3>
                  <p className="mt-2 text-xs leading-relaxed text-slate-500">{card.text}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ============ FEATURES ============ */}
      <section id="features" className="bg-white">
        <div className="max-w-7xl mx-auto px-4 py-20">
          <Reveal>
            <div className="text-center max-w-2xl mx-auto">
              <p className="text-[11px] font-bold uppercase tracking-widest text-purple-700">Features</p>
              <h2 className="mt-3 text-3xl md:text-4xl font-black text-slate-800">
                Everything the front desk, back office, and owner need.
              </h2>
            </div>
          </Reveal>

          <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            <FeatureCard
              icon={<LineChart size={22} />}
              title="Point of Sale"
              description="Fast touch-first checkout with split payments, hold/resume, loyalty discounts, and a printable receipt."
              tone="purple"
              delay={0}
            />
            <FeatureCard
              icon={<FileText size={22} />}
              title="Inventory Ledger"
              description="Every sale, restock, transfer and void writes an append-only stock movement so balances are always auditable."
              tone="lime"
              delay={80}
            />
            <FeatureCard
              icon={<Crown size={22} />}
              title="Loyalty & Rewards"
              description="Tiered discounts, points earned per peso, free items per threshold, and per-business reward rules."
              tone="amber"
              delay={160}
            />
            <FeatureCard
              icon={<Users size={22} />}
              title="Staff & Access"
              description="Role-scoped grants: cashiers see only their till, managers see their business, owners see the whole company."
              tone="blue"
              delay={0}
            />
            <FeatureCard
              icon={<Layers size={22} />}
              title="Multi-Business Isolation"
              description="Every business is a separate tenant. A cashier can never read another tenant's sales, stock or customers."
              tone="purple"
              delay={80}
            />
            <FeatureCard
              icon={<Shield size={22} />}
              title="Audit & Compliance"
              description="Every write is stamped with user, business, branch and request id — filterable, exportable, immutable."
              tone="rose"
              delay={160}
            />
          </div>
        </div>
      </section>

      {/* ============ HOW IT WORKS ============ */}
      <section id="how" className="bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 py-20">
          <Reveal>
            <div className="text-center max-w-2xl mx-auto">
              <p className="text-[11px] font-bold uppercase tracking-widest text-purple-700">How It Works</p>
              <h2 className="mt-3 text-3xl md:text-4xl font-black text-slate-800">
                Three steps from login to closing the till.
              </h2>
            </div>
          </Reveal>

          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-8">
            <Step
              number="1"
              title="Sign in with your role"
              description="Each team member logs in through their own route: /admin/login, /owner/login, /cashier/login, /staff/login."
              delay={0}
            />
            <Step
              number="2"
              title="Land on your workspace"
              description="Cashiers open the POS in full-screen. Managers and owners open the dashboard of their business."
              delay={120}
            />
            <Step
              number="3"
              title="Work, and it just records"
              description="Every sale, void, restock and roster change is written to the ledger with a signed audit trail behind it."
              delay={240}
            />
          </div>

          <Reveal delay={200}>
            <div className="mt-12 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => openLogin('admin')}
                className="rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs px-5 py-3 transition-all"
              >
                Login as Superadmin
              </button>
              <button
                type="button"
                onClick={() => openLogin('owner')}
                className="rounded-xl bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs px-5 py-3 transition-all"
              >
                Login as Owner
              </button>
              <button
                type="button"
                onClick={() => openLogin('cashier')}
                className="rounded-xl bg-gradient-to-r from-amber-300 to-amber-400 hover:from-amber-400 hover:to-amber-500 text-purple-900 font-bold text-xs px-5 py-3 shadow-md transition-all"
              >
                Login as Cashier
              </button>
              <button
                type="button"
                onClick={() => openLogin('staff')}
                className="rounded-xl border border-slate-300 hover:border-slate-400 text-slate-700 font-bold text-xs px-5 py-3 transition-all"
              >
                Login as Staff
              </button>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ============ CONTACT ============ */}
      <section id="contact" className="bg-white">
        <div className="max-w-7xl mx-auto px-4 py-20 grid grid-cols-1 lg:grid-cols-2 gap-10">
          <Reveal>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-purple-700">Contact</p>
              <h2 className="mt-3 text-3xl md:text-4xl font-black text-slate-800">Talk to the team.</h2>
              <p className="mt-4 text-sm leading-relaxed text-slate-500">
                For account access, business onboarding, or a walkthrough of the system, reach
                out during business hours.
              </p>

              <div className="mt-8 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                    <MapPin size={18} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-700">Head Office</p>
                    <p className="text-xs text-slate-500">Bungad &amp; Villareal, Philippines</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                    <Mail size={18} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-700">Email</p>
                    <p className="text-xs text-slate-500">support@bungad-villareal.local</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                    <Phone size={18} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-700">Phone</p>
                    <p className="text-xs text-slate-500">Available on request</p>
                  </div>
                </div>
              </div>
            </div>
          </Reveal>

          <Reveal delay={150}>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
              <h3 className="text-sm font-bold text-slate-800">Quick logins</h3>
              <p className="mt-1 text-xs text-slate-500">Pick a role to open the prefilled sign-in screen.</p>
              <div className="mt-5 grid grid-cols-2 gap-3">
                {QUICK_ACCOUNTS.map((row) => (
                  <button
                    key={row.key}
                    type="button"
                    onClick={() => openLogin(row.key)}
                    className="rounded-xl font-bold text-xs px-3 py-3 transition-all bg-white border border-slate-200 hover:border-purple-400 hover:text-purple-800 text-slate-700 flex items-center justify-center gap-2"
                  >
                    {row.icon} {row.label}
                  </button>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ============ FOOTER ============ */}
      <footer className="bg-slate-950 text-slate-300 border-t-4 border-purple-600">
        <div className="max-w-7xl mx-auto px-4 pt-12 pb-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
            <div className="lg:col-span-2">
              <div className="flex items-center gap-3">
                {/* Footer is dark, so the logo keeps a white plate, but it now fits the whole image */}
                <div className="rounded-xl bg-white px-3 py-2 shadow-lg">
                  <img src="/villareal-logo.png" alt="Villareal Salon & Spa" className="h-12 w-auto max-w-[170px] object-contain" />
                </div>
                <div>
                  <p className="text-base font-extrabold text-white">Bungad &amp; Villareal</p>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-purple-300 mt-1">Management System</p>
                </div>
              </div>
              <p className="mt-5 max-w-md text-sm leading-6 text-slate-400">
                One secure platform for managing sales, inventory, loyalty rewards, and staff operations across the Bungad &amp; Villareal Group.
              </p>
              <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-xs font-semibold text-emerald-300">
                <span className="h-2 w-2 rounded-full bg-emerald-400" /> Designed for secure business operations
              </div>
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Quick Links</h3>
              <div className="mt-4 space-y-3 text-sm">
                <button type="button" onClick={() => scrollTo('home')} className="block text-slate-400 hover:text-white transition-colors">Home</button>
                <button type="button" onClick={() => scrollTo('about')} className="block text-slate-400 hover:text-white transition-colors">About the System</button>
                <button type="button" onClick={() => scrollTo('features')} className="block text-slate-400 hover:text-white transition-colors">Features</button>
                <button type="button" onClick={() => scrollTo('how')} className="block text-slate-400 hover:text-white transition-colors">How It Works</button>
                <button type="button" onClick={() => scrollTo('contact')} className="block text-slate-400 hover:text-white transition-colors">Contact</button>
              </div>
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Platform Features</h3>
              <ul className="mt-4 space-y-3 text-sm text-slate-400">
                <li className="flex items-center gap-2"><CheckCircle size={15} className="text-purple-300" /> Point of Sale</li>
                <li className="flex items-center gap-2"><CheckCircle size={15} className="text-purple-300" /> Inventory Tracking</li>
                <li className="flex items-center gap-2"><CheckCircle size={15} className="text-purple-300" /> Loyalty &amp; Rewards</li>
                <li className="flex items-center gap-2"><CheckCircle size={15} className="text-purple-300" /> Staff &amp; Access Control</li>
              </ul>
            </div>
          </div>
          <div className="mt-10 border-t border-white/10 pt-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
            <p className="text-xs text-slate-500">© {new Date().getFullYear()} Bungad &amp; Villareal Group. All rights reserved.</p>
            <button type="button" onClick={() => openLogin('cashier')} className="inline-flex items-center gap-2 rounded-lg bg-amber-400 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-amber-300 transition-colors"><LogIn size={14} /> Secure System Login</button>
          </div>
        </div>
      </footer>

      {/* ============ LOGIN MODAL ============ */}
      {loginOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              type="button"
              onClick={() => setLoginOpen(false)}
              className="absolute top-4 right-4 text-white/80 hover:text-white z-10"
            >
              <X size={20} />
            </button>

            <div className="rounded-t-2xl bg-gradient-to-r from-purple-800 to-indigo-700 px-6 py-5 text-white">
              <div className="flex items-center gap-3">
                {/* Purple header: white plate so the full logo stays readable */}
                <div className="rounded-lg bg-white px-2 py-1.5 shadow-sm">
                  <img
                    src="/villareal-logo.png"
                    alt="Villareal"
                    className="h-10 w-auto max-w-[120px] object-contain"
                  />
                </div>
                <div>
                  <h2 className="text-base font-bold">Welcome Back</h2>
                  <p className="text-[11px] text-purple-100">
                    Sign in as <span className="font-bold uppercase tracking-wide">{loginRole}</span>
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Demo Accounts — click to fill</p>
                <div className="space-y-1.5">
                  {QUICK_ACCOUNTS.map((acc) => (
                    <button
                      key={acc.key}
                      type="button"
                      onClick={() => quickPick(acc.key)}
                      className={`w-full text-left rounded-xl border px-3 py-2 transition-all flex items-center gap-3 ${
                        loginRole === acc.key
                          ? 'bg-purple-50 border-purple-300 text-purple-900'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 hover:border-purple-200'
                      }`}
                    >
                      <span className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${loginRole === acc.key ? 'bg-purple-200 text-purple-700' : 'bg-slate-200 text-slate-500'}`}>
                        {acc.icon}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-bold">{acc.label}</span>
                          {loginRole === acc.key && (
                            <span className="text-[9px] font-bold text-purple-600 uppercase tracking-wide">Selected</span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-400 font-mono truncate">{acc.username}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <form onSubmit={submitLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Username</label>
                  <input
                    type="text"
                    value={loginForm.username}
                    onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm outline-none focus:border-purple-500"
                    placeholder="Enter your username"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Password</label>
                  <input
                    type="password"
                    value={loginForm.password}
                    onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm outline-none focus:border-purple-500"
                    placeholder="Enter your password"
                    required
                  />
                </div>

                {loginError && (
                  <div className="bg-rose-50 border border-rose-200 text-rose-600 text-xs p-3 rounded-lg">
                    {loginError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={busy}
                  className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold rounded-lg hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {busy ? 'Signing in…' : (<>Sign In <ArrowRight size={16} /></>)}
                </button>
              </form>

              <p className="text-[10px] text-slate-400 text-center">
                Demo credentials are for local development only.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
