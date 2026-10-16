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

// Wide container: uses almost the whole desktop viewport instead of a narrow 7xl column.
const CONTAINER = 'w-full max-w-[1760px] mx-auto px-5 sm:px-8 lg:px-14 2xl:px-24';

// Subtle dot-grid used on dark sections.
const DOT_GRID = {
  backgroundImage: 'radial-gradient(rgba(255,255,255,0.10) 1px, transparent 1px)',
  backgroundSize: '26px 26px',
};

// Subtle dot-grid used on light sections.
const DOT_GRID_LIGHT = {
  backgroundImage: 'radial-gradient(rgba(109,40,217,0.10) 1px, transparent 1px)',
  backgroundSize: '28px 28px',
};

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
      className="flex items-center gap-1.5 text-sm font-medium text-purple-100/80 hover:text-amber-300 transition-colors"
    >
      {icon} {label}
    </button>
  );
}

function SectionHeading({ eyebrow, title, align = 'center', dark = false }) {
  return (
    <div className={`max-w-3xl ${align === 'center' ? 'mx-auto text-center' : ''}`}>
      <span
        className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] ${
          dark ? 'bg-white/10 text-amber-300 border border-white/15' : 'bg-purple-100 text-purple-700 border border-purple-200'
        }`}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${dark ? 'bg-amber-300' : 'bg-purple-600'}`} />
        {eyebrow}
      </span>
      <h2 className={`mt-4 text-3xl md:text-4xl 2xl:text-5xl font-black leading-tight ${dark ? 'text-white' : 'text-slate-900'}`}>
        {title}
      </h2>
    </div>
  );
}

function FeatureCard({ icon, title, description, tone = 'purple', delay = 0 }) {
  const tones = {
    purple: { icon: 'bg-purple-100 text-purple-700', bar: 'from-purple-500 to-fuchsia-500' },
    lime: { icon: 'bg-lime-100 text-lime-700', bar: 'from-lime-400 to-emerald-500' },
    amber: { icon: 'bg-amber-100 text-amber-700', bar: 'from-amber-300 to-orange-400' },
    rose: { icon: 'bg-rose-100 text-rose-700', bar: 'from-rose-400 to-pink-500' },
    blue: { icon: 'bg-blue-100 text-blue-700', bar: 'from-blue-400 to-indigo-500' },
    emerald: { icon: 'bg-emerald-100 text-emerald-700', bar: 'from-emerald-400 to-teal-500' },
  };
  const t = tones[tone] || tones.purple;
  return (
    <Reveal delay={delay} className="h-full">
      <div className="group relative h-full overflow-hidden rounded-2xl border border-purple-100 bg-white p-7 shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:shadow-2xl hover:shadow-purple-900/10">
        <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${t.bar}`} />
        <div className={`mb-5 flex h-14 w-14 items-center justify-center rounded-2xl ${t.icon} transition-transform duration-300 group-hover:scale-110`}>
          {icon}
        </div>
        <h3 className="text-base font-bold text-slate-900">{title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">{description}</p>
      </div>
    </Reveal>
  );
}

function Step({ number, title, description, delay = 0 }) {
  return (
    <Reveal delay={delay} className="h-full">
      <div className="relative h-full rounded-2xl border border-white/10 bg-white/5 p-7 backdrop-blur-sm transition-all hover:bg-white/10">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-amber-300 to-amber-500 text-lg font-black text-purple-950 shadow-lg shadow-amber-500/30">
          {number}
        </div>
        <h4 className="mt-5 text-base font-bold text-white">{title}</h4>
        <p className="mt-2 text-sm leading-relaxed text-purple-100/70">{description}</p>
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
    <div className="min-h-screen bg-[#f5f0ff] font-sans text-slate-800 overflow-x-clip">
      {/* ============ HEADER ============ */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-gradient-to-r from-[#1b0838]/95 via-purple-950/95 to-indigo-950/95 backdrop-blur-md shadow-lg shadow-purple-950/30">
        <div className={`${CONTAINER} py-3 flex items-center justify-between`}>
          <div className="flex items-center gap-4">
            {/* Logo sits on a soft white plate so the dark "SALON & SPA" text stays readable on the dark header */}
            <div className="rounded-2xl bg-white px-4 py-2 shadow-lg shadow-black/20 ring-2 ring-amber-300/60">
              <img
                src="/villareal-logo.png"
                alt="Villareal Salon & Spa"
                className="h-12 w-auto max-w-[210px] object-contain"
              />
            </div>
            <div className="hidden sm:block border-l border-white/20 pl-4">
              <h1 className="text-white font-extrabold text-xl leading-none">Bungad &amp; Villareal</h1>
              <p className="text-amber-300 text-[10px] font-semibold tracking-[0.25em] mt-1.5">MANAGEMENT SYSTEM</p>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-8 lg:gap-10">
            <NavLink icon={<Home size={16} />} label="Home" targetId="home" />
            <NavLink icon={<Info size={16} />} label="About" targetId="about" />
            <NavLink icon={<Grid size={16} />} label="Features" targetId="features" />
            <NavLink icon={<HelpCircle size={16} />} label="How It Works" targetId="how" />
            <NavLink icon={<Phone size={16} />} label="Contact" targetId="contact" />
            <button
              type="button"
              onClick={() => openLogin('cashier')}
              className="bg-gradient-to-r from-amber-300 to-amber-400 hover:from-amber-400 hover:to-amber-500 text-purple-950 font-bold px-7 py-2.5 rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-amber-500/30"
            >
              <LogIn size={16} /> Login
            </button>
          </nav>

          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden text-white"
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden border-t border-white/10 bg-purple-950 px-4 py-3 space-y-3 shadow-lg">
            <button type="button" onClick={() => scrollTo('home')} className="block w-full text-left text-sm font-medium text-purple-100 hover:text-amber-300">Home</button>
            <button type="button" onClick={() => scrollTo('about')} className="block w-full text-left text-sm font-medium text-purple-100 hover:text-amber-300">About</button>
            <button type="button" onClick={() => scrollTo('features')} className="block w-full text-left text-sm font-medium text-purple-100 hover:text-amber-300">Features</button>
            <button type="button" onClick={() => scrollTo('how')} className="block w-full text-left text-sm font-medium text-purple-100 hover:text-amber-300">How It Works</button>
            <button type="button" onClick={() => scrollTo('contact')} className="block w-full text-left text-sm font-medium text-purple-100 hover:text-amber-300">Contact</button>
            <button
              type="button"
              onClick={() => { setMobileMenuOpen(false); openLogin('cashier'); }}
              className="w-full bg-amber-400 text-purple-950 font-bold py-2.5 rounded-lg flex items-center justify-center gap-2"
            >
              <LogIn size={16} /> Login
            </button>
          </div>
        )}
      </header>

      {/* ============ HERO ============ */}
      <section
        id="home"
        className="relative overflow-hidden bg-gradient-to-br from-[#1b0838] via-purple-900 to-indigo-950 pb-28 lg:pb-36"
      >
        {/* decorative layers */}
        <div className="pointer-events-none absolute inset-0 opacity-60" style={DOT_GRID} />
        <div className="pointer-events-none absolute -top-40 -left-40 h-[520px] w-[520px] rounded-full bg-fuchsia-600/30 blur-[120px]" />
        <div className="pointer-events-none absolute top-1/3 -right-40 h-[560px] w-[560px] rounded-full bg-indigo-500/30 blur-[130px]" />
        <div className="pointer-events-none absolute -bottom-40 left-1/3 h-[420px] w-[420px] rounded-full bg-amber-400/15 blur-[120px]" />

        <div className={`${CONTAINER} relative grid lg:grid-cols-[1.1fr_0.9fr] gap-12 xl:gap-20 items-center pt-14 lg:pt-20`}>
          <Reveal>
            <div>
              <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-2 mb-7 backdrop-blur-sm">
                <MapPin size={14} className="text-amber-300" />
                <span className="text-purple-100 text-xs font-semibold tracking-wide">BUNGAD &amp; VILLAREAL — OFFICIAL SYSTEM</span>
              </div>

              <h2 className="text-5xl md:text-6xl xl:text-7xl 2xl:text-8xl font-extrabold text-white mb-6 leading-[1.05] tracking-tight">
                Bungad &amp; Villareal{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-amber-300 to-fuchsia-300">
                  Management System
                </span>
              </h2>

              <p className="text-purple-100/80 text-base md:text-lg xl:text-xl mb-9 leading-relaxed max-w-2xl">
                A modern, AI-powered management platform for the Bungad &amp; Villareal Group.
                Manage POS, inventory, loyalty, and staff — all in one secure system.
              </p>

              <div className="flex flex-wrap gap-4 mb-10">
                <button
                  type="button"
                  onClick={() => openLogin('cashier')}
                  className="bg-gradient-to-r from-amber-300 to-amber-400 hover:from-amber-400 hover:to-amber-500 text-purple-950 font-bold px-8 py-4 rounded-xl flex items-center gap-2 transition-all shadow-xl shadow-amber-500/30 hover:-translate-y-0.5"
                >
                  <LogIn size={18} /> Login to Your Account
                </button>
                <button
                  type="button"
                  onClick={() => scrollTo('features')}
                  className="border-2 border-white/25 hover:border-amber-300 text-white hover:bg-white/10 font-bold px-8 py-4 rounded-xl flex items-center gap-2 transition-all backdrop-blur-sm"
                >
                  <Grid size={18} /> Explore Features
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 max-w-xl">
                {[
                  { icon: <Zap size={18} />, label: 'Real-Time POS' },
                  { icon: <MessageSquare size={18} />, label: 'SMS Notifications' },
                  { icon: <LineChart size={18} />, label: 'Real-Time Analytics' },
                  { icon: <Lock size={18} />, label: 'Secure Records' },
                ].map((f, i) => (
                  <div
                    key={i}
                    className="bg-white/10 border border-white/15 rounded-xl px-4 py-3.5 flex items-center gap-3 backdrop-blur-sm hover:bg-white/15 transition-colors"
                  >
                    <span className="text-amber-300">{f.icon}</span>
                    <span className="text-white text-sm font-semibold">{f.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>

          <Reveal delay={150}>
            <div className="relative mx-auto w-full max-w-[680px]">
              {/* glow behind the card */}
              <div className="absolute -inset-6 rounded-[2.5rem] bg-gradient-to-br from-fuchsia-500/40 via-purple-500/30 to-amber-300/40 blur-2xl" />
              {/* decorative rings */}
              <div className="pointer-events-none absolute -top-8 -right-8 h-32 w-32 rounded-full border-2 border-amber-300/40" />
              <div className="pointer-events-none absolute -bottom-10 -left-10 h-44 w-44 rounded-full border-2 border-lime-300/30" />

              {/* gradient border frame */}
              <div className="relative rounded-[2rem] bg-gradient-to-br from-amber-300 via-fuchsia-400 to-lime-300 p-[3px] shadow-2xl shadow-black/40">
                <div className="rounded-[calc(2rem-3px)] bg-white p-6 md:p-10">
                  <div className="text-center">
                    {/* Logo on a soft lavender spotlight, full proportions, no cropping */}
                    <div className="relative mb-6 rounded-3xl bg-gradient-to-b from-purple-50 via-white to-purple-50 px-4 py-8 md:px-8 md:py-12 ring-1 ring-purple-100">
                      <div className="pointer-events-none absolute inset-0 rounded-3xl opacity-70" style={DOT_GRID_LIGHT} />
                      <img
                        src="/villareal-logo.png"
                        alt="Bungad & Villareal"
                        className="relative mx-auto h-auto w-full max-w-[520px] object-contain drop-shadow-[0_12px_24px_rgba(88,28,135,0.25)]"
                      />
                    </div>

                    <h3 className="text-slate-900 font-extrabold text-2xl mb-1">Bungad &amp; Villareal Group</h3>
                    <p className="text-purple-700 text-[11px] font-bold uppercase tracking-[0.25em] mb-6">
                      Salon • Spa • Cosmetics • Bakery
                    </p>

                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-3 text-left">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500 text-xs">System Status</span>
                        <span className="text-emerald-500 text-xs font-bold flex items-center gap-1.5">
                          <span className="relative flex h-2 w-2">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                          </span>
                          Online
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500 text-xs">Response Time</span>
                        <span className="text-amber-500 text-xs font-bold">&lt; 24 hours</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500 text-xs">Coverage</span>
                        <span className="text-amber-500 text-xs font-bold">Bungad, Villareal</span>
                      </div>
                    </div>

                    <p className="text-slate-500 text-xs mt-5 flex items-center justify-center gap-1">
                      <Lock size={12} /> SSL Secured • 24/7 Available
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ============ STATS STRIP (overlaps hero) ============ */}
      <section className={`${CONTAINER} relative z-10 -mt-14 lg:-mt-20 pb-20`}>
        <Reveal>
          <div className="bg-white rounded-3xl shadow-2xl shadow-purple-900/20 ring-1 ring-purple-100 grid grid-cols-2 md:grid-cols-4 overflow-hidden">
            {[
              { icon: <FileText size={30} />, label: 'Manage POS', sub: 'Fast, touch-first checkout', color: 'purple' },
              { icon: <CheckCircle size={30} />, label: 'Track Inventory', sub: 'Audit-ready stock ledger', color: 'emerald' },
              { icon: <Clock size={30} />, label: 'Loyalty Rewards', sub: 'Tiers, points & free items', color: 'amber' },
              { icon: <AlertTriangle size={30} />, label: 'Staff Management', sub: 'Role-scoped access', color: 'rose' },
            ].map((stat, i) => (
              <div
                key={i}
                className="p-7 lg:p-9 text-center border-r last:border-r-0 border-purple-50 hover:bg-purple-50/50 transition-colors"
              >
                <div
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 ${
                    stat.color === 'purple' ? 'bg-purple-100 text-purple-600' :
                    stat.color === 'emerald' ? 'bg-emerald-100 text-emerald-600' :
                    stat.color === 'amber' ? 'bg-amber-100 text-amber-600' :
                    'bg-rose-100 text-rose-600'
                  }`}
                >
                  {stat.icon}
                </div>
                <p className="text-slate-900 font-bold text-base">{stat.label}</p>
                <p className="text-slate-500 text-xs mt-1">{stat.sub}</p>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      {/* ============ ABOUT ============ */}
      <section id="about" className="relative scroll-mt-24 bg-gradient-to-b from-[#f5f0ff] to-white">
        <div className="pointer-events-none absolute inset-0 opacity-50" style={DOT_GRID_LIGHT} />
        <div className={`${CONTAINER} relative py-20 lg:py-24`}>
          <Reveal>
            <div className="grid lg:grid-cols-2 gap-8 lg:gap-16 items-end">
              <SectionHeading
                align="left"
                eyebrow="About"
                title="Built for the way the company runs every day."
              />
              <p className="text-base leading-relaxed text-slate-600">
                Bungad &amp; Villareal operates several businesses under one roof — a spa, a
                cosmetics line, a bakery, a menu kitchen, and more. The system isolates
                each business so their books, staff, and customers never mix, while the
                owner still sees the whole company on one screen.
              </p>
            </div>
          </Reveal>

          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { icon: <Scissors size={22} />, title: 'Multi-Business', text: 'One company, many outlets. Switch tenants in one click without ever crossing data.' },
              { icon: <Clock size={22} />, title: 'Real-Time Operations', text: 'Rooms, shifts, stock and sales update the moment they happen — no batch imports.' },
              { icon: <Award size={22} />, title: 'Loyalty & Rewards', text: 'Automatic tier upgrades, points ledger, and free-item thresholds per business.' },
            ].map((card, i) => (
              <Reveal key={card.title} delay={i * 100} className="h-full">
                <div className="h-full rounded-2xl border border-purple-100 bg-white/90 p-8 shadow-sm backdrop-blur-sm transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-purple-900/10">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-purple-600/30">
                    {card.icon}
                  </div>
                  <h3 className="mt-5 text-base font-bold text-slate-900">{card.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-500">{card.text}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ============ FEATURES ============ */}
      <section id="features" className="relative scroll-mt-24 bg-gradient-to-b from-white via-purple-50/60 to-[#f5f0ff]">
        <div className={`${CONTAINER} py-20 lg:py-24`}>
          <Reveal>
            <SectionHeading
              eyebrow="Features"
              title="Everything the front desk, back office, and owner need."
            />
          </Reveal>

          <div className="mt-14 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            <FeatureCard
              icon={<LineChart size={24} />}
              title="Point of Sale"
              description="Fast touch-first checkout with split payments, hold/resume, loyalty discounts, and a printable receipt."
              tone="purple"
              delay={0}
            />
            <FeatureCard
              icon={<FileText size={24} />}
              title="Inventory Ledger"
              description="Every sale, restock, transfer and void writes an append-only stock movement so balances are always auditable."
              tone="lime"
              delay={80}
            />
            <FeatureCard
              icon={<Crown size={24} />}
              title="Loyalty & Rewards"
              description="Tiered discounts, points earned per peso, free items per threshold, and per-business reward rules."
              tone="amber"
              delay={160}
            />
            <FeatureCard
              icon={<Users size={24} />}
              title="Staff & Access"
              description="Role-scoped grants: cashiers see only their till, managers see their business, owners see the whole company."
              tone="blue"
              delay={0}
            />
            <FeatureCard
              icon={<Layers size={24} />}
              title="Multi-Business Isolation"
              description="Every business is a separate tenant. A cashier can never read another tenant's sales, stock or customers."
              tone="purple"
              delay={80}
            />
            <FeatureCard
              icon={<Shield size={24} />}
              title="Audit & Compliance"
              description="Every write is stamped with user, business, branch and request id — filterable, exportable, immutable."
              tone="rose"
              delay={160}
            />
          </div>
        </div>
      </section>

      {/* ============ HOW IT WORKS (dark band) ============ */}
      <section
        id="how"
        className="relative scroll-mt-24 overflow-hidden bg-gradient-to-br from-[#1b0838] via-purple-900 to-indigo-950"
      >
        <div className="pointer-events-none absolute inset-0 opacity-50" style={DOT_GRID} />
        <div className="pointer-events-none absolute -top-32 right-0 h-[420px] w-[420px] rounded-full bg-fuchsia-600/25 blur-[120px]" />
        <div className="pointer-events-none absolute -bottom-32 -left-20 h-[420px] w-[420px] rounded-full bg-amber-400/15 blur-[120px]" />

        <div className={`${CONTAINER} relative py-20 lg:py-24`}>
          <Reveal>
            <SectionHeading
              dark
              eyebrow="How It Works"
              title="Three steps from login to closing the till."
            />
          </Reveal>

          <div className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-6">
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
                className="rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold text-xs px-6 py-3.5 transition-all backdrop-blur-sm"
              >
                Login as Superadmin
              </button>
              <button
                type="button"
                onClick={() => openLogin('owner')}
                className="rounded-xl bg-purple-500 hover:bg-purple-400 text-white font-bold text-xs px-6 py-3.5 transition-all shadow-lg shadow-purple-900/40"
              >
                Login as Owner
              </button>
              <button
                type="button"
                onClick={() => openLogin('cashier')}
                className="rounded-xl bg-gradient-to-r from-amber-300 to-amber-400 hover:from-amber-400 hover:to-amber-500 text-purple-950 font-bold text-xs px-6 py-3.5 shadow-lg shadow-amber-500/30 transition-all"
              >
                Login as Cashier
              </button>
              <button
                type="button"
                onClick={() => openLogin('staff')}
                className="rounded-xl border border-white/30 hover:border-amber-300 hover:text-amber-300 text-white font-bold text-xs px-6 py-3.5 transition-all"
              >
                Login as Staff
              </button>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ============ CONTACT ============ */}
      <section id="contact" className="relative scroll-mt-24 bg-gradient-to-b from-[#f5f0ff] to-white">
        <div className="pointer-events-none absolute inset-0 opacity-40" style={DOT_GRID_LIGHT} />
        <div className={`${CONTAINER} relative py-20 lg:py-24 grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-start`}>
          <Reveal>
            <div>
              <SectionHeading align="left" eyebrow="Contact" title="Talk to the team." />
              <p className="mt-5 text-base leading-relaxed text-slate-600 max-w-xl">
                For account access, business onboarding, or a walkthrough of the system, reach
                out during business hours.
              </p>

              <div className="mt-8 space-y-5">
                {[
                  { icon: <MapPin size={20} />, title: 'Head Office', text: 'Bungad & Villareal, Philippines' },
                  { icon: <Mail size={20} />, title: 'Email', text: 'support@bungad-villareal.local' },
                  { icon: <Phone size={20} />, title: 'Phone', text: 'Available on request' },
                ].map((row) => (
                  <div key={row.title} className="flex items-center gap-4 rounded-2xl border border-purple-100 bg-white p-4 shadow-sm">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-purple-600/25">
                      {row.icon}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-800">{row.title}</p>
                      <p className="text-sm text-slate-500">{row.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>

          <Reveal delay={150}>
            <div className="rounded-3xl border border-purple-100 bg-white p-8 shadow-xl shadow-purple-900/10">
              <h3 className="text-lg font-bold text-slate-900">Quick logins</h3>
              <p className="mt-1 text-sm text-slate-500">Pick a role to open the prefilled sign-in screen.</p>
              <div className="mt-6 grid grid-cols-2 gap-3">
                {QUICK_ACCOUNTS.map((row) => (
                  <button
                    key={row.key}
                    type="button"
                    onClick={() => openLogin(row.key)}
                    className="rounded-xl font-bold text-sm px-3 py-4 transition-all bg-purple-50/60 border border-purple-100 hover:border-purple-400 hover:bg-purple-100 hover:text-purple-800 text-slate-700 flex items-center justify-center gap-2"
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
        <div className={`${CONTAINER} pt-14 pb-8`}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
            <div className="lg:col-span-2">
              <div className="flex items-center gap-4">
                {/* Footer is dark, so the logo keeps a white plate, but it now fits the whole image */}
                <div className="rounded-2xl bg-white px-4 py-2.5 shadow-lg ring-2 ring-amber-300/50">
                  <img src="/villareal-logo.png" alt="Villareal Salon & Spa" className="h-14 w-auto max-w-[200px] object-contain" />
                </div>
                <div>
                  <p className="text-lg font-extrabold text-white">Bungad &amp; Villareal</p>
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