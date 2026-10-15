import { useEffect, useState, useMemo } from 'react';
import { Search, UserPlus, Building2 } from 'lucide-react';
import { api } from '../utils/api';
import BusinessPicker from './BusinessPicker';
import { getGrantedBusinesses, COMPANY_WIDE_ROLES } from '../utils/session';

const records = (response) => response.data.results || response.data;

// COMPANY_WIDE_ROLES imported from session.js (single source of truth)

export default function ClientsPage({ isDarkMode = false, readOnly = false, currentUserRoleCode = '', activeBusinessName, activeBusiness, isCompanyWideUser = false }) {
  const [clients, setClients] = useState([]);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ first_name: '', last_name: '', phone_number: '', email: '', address: '', business: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  // Determine if user is company-wide role (needs to select business explicitly)
  const isCompanyWide = COMPANY_WIDE_ROLES.has(String(currentUserRoleCode || '').toUpperCase());
  const grantedBusinesses = useMemo(() => getGrantedBusinesses(), []);

  // Auto-set business for non-company-wide roles (they get their business stamped by backend)
  useEffect(() => {
    if (!isCompanyWide && grantedBusinesses.length === 1 && !form.business) {
      setForm((prev) => ({ ...prev, business: String(grantedBusinesses[0].id) }));
    }
  }, [isCompanyWide, grantedBusinesses, form.business]);

  const loadClients = async (query = '') => {
    setLoading(true);
    try {
      const response = await api.get(query ? `/clients/search/?q=${encodeURIComponent(query)}` : '/clients/');
      setClients(records(response));
    } catch (error) {
      setMessage(error.response?.data?.detail || 'Unable to load clients.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClients();
  }, []);

  const saveClient = async (event) => {
    event.preventDefault();
    
    // Validate business selection for company-wide roles
    if (isCompanyWide && !form.business) {
      setMessage('Please select a business for this client.');
      return;
    }
    
    setSaving(true);
    setMessage('');
    try {
      const payload = { ...form };
      // Only include business in payload if it's set (company-wide roles)
      // For scoped roles, backend auto-stamps the business
      if (!payload.business) {
        delete payload.business;
      }
      await api.post('/clients/', payload);
      setForm({ first_name: '', last_name: '', phone_number: '', email: '', address: '', business: '' });
      setMessage('Client added successfully.');
      await loadClients(search);
    } catch (error) {
      setMessage(error.response?.data?.detail || 'Unable to save client.');
    } finally {
      setSaving(false);
    }
  };

  const panel = isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200';
  const input = isDarkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200 text-slate-700';

  return (
    <div className="space-y-6">
      {activeBusinessName && (
        <div className={`flex items-center justify-between gap-2 text-xs px-3 py-2 rounded-lg mb-3 ${isDarkMode ? "bg-slate-700 text-slate-300" : "bg-purple-50 text-purple-800"}`}>
          <div className="flex items-center gap-2">
            <Building2 size={13} className="text-purple-600 shrink-0" />
            <span>Showing data for <strong>{activeBusinessName}</strong></span>
          </div>
          {isCompanyWide && (
            <span className="text-[10px] font-bold text-purple-500 uppercase tracking-wide">Company-wide view</span>
          )}
        </div>
      )}
            <div className="flex items-center justify-between">
        <div><h3 className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Clients</h3><p className="text-xs text-slate-500">Find customer history and register walk-in clients.</p></div>
        <Search className="text-cyan-600" size={24} />
      </div>
      {message && <div className="rounded-lg border border-cyan-200 bg-cyan-50 px-4 py-3 text-xs text-cyan-700">{message}</div>}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {!readOnly && <form onSubmit={saveClient} className={`${panel} border rounded-xl p-5 space-y-3`}>
          <h4 className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Register Client</h4>
          
          {/* BusinessPicker for company-wide roles */}
          {isCompanyWide && (
            <BusinessPicker
              value={form.business}
              onChange={(value) => setForm({ ...form, business: value })}
              businesses={grantedBusinesses}
              isDarkMode={isDarkMode}
              label="Select the business for this client"
              placeholder="Choose a business…"
              required={true}
            />
          )}
          
          {['first_name', 'last_name', 'phone_number', 'email', 'address'].map((field) => <label key={field} className="block text-xs font-semibold capitalize text-slate-500">{field.replace('_', ' ')}<input required={field === 'first_name' || field === 'last_name'} value={form[field]} onChange={(event) => setForm({ ...form, [field]: event.target.value })} className={`${input} mt-1 w-full rounded-lg border p-2`} /></label>)}
          <button disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-600 py-2 text-sm font-semibold text-white disabled:opacity-50"><UserPlus size={16} />{saving ? 'Saving...' : 'Add Client'}</button>
        </form>}

        <section className={`${panel} border rounded-xl p-5 lg:col-span-2`}>
          <div className="mb-4 flex gap-2"><input value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && loadClients(search)} placeholder="Search name or phone" className={`${input} w-full rounded-lg border p-2 text-sm`} /><button onClick={() => loadClients(search)} className="rounded-lg bg-slate-700 px-3 text-white"><Search size={16} /></button></div>
          {loading ? <p className="text-sm text-slate-500">Loading clients...</p> : <div className="space-y-2">{clients.length === 0 && <p className="text-sm text-slate-500">No clients found.</p>}{clients.map((client) => <div key={client.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-3"><div><p className="text-sm font-semibold">{client.full_name || `${client.first_name} ${client.last_name}`}</p><p className="text-xs text-slate-500">{client.phone_number || 'No phone'} · {client.email || 'No email'}</p></div><div className="text-right text-xs text-slate-500"><span className="block">Points: {client.loyalty_points}</span><span>Spent: ₱{Number(client.total_spent || 0).toFixed(2)}</span></div></div>)}</div>}
        </section>
      </div>
    </div>
  );
}
