import { useEffect, useState } from 'react';
import axios from 'axios';
import { Building2, UserCheck, Edit3, Save, X, Search, Users, CheckCircle2, AlertTriangle } from 'lucide-react';

const api = axios.create({
  baseURL: 'http://127.0.0.1:8000/api',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');
  if (token) config.headers.Authorization = `Token ${token}`;
  return config;
});

const records = (response) => response.data.results || response.data;
const initialUser = { username: '', first_name: '', last_name: '', email: '', role: 'BRANCH_ADMIN', branch: '', services: [] };
const initialBranch = { name: '', address: '', contact_number: '', email: '' };

export default function AdministrationPage({ isDarkMode = false }) {
  const [branches, setBranches] = useState([]);
  const [staffing, setStaffing] = useState({});
  const [services, setServices] = useState([]);
  const [branchForm, setBranchForm] = useState(initialBranch);
  const [editingBranchId, setEditingBranchId] = useState(null);
  const [userForm, setUserForm] = useState(initialUser);
  const [profiles, setProfiles] = useState([]);
  const [selectedProfileId, setSelectedProfileId] = useState('');
  const [profileSearch, setProfileSearch] = useState('');
  const [selectedBranchId, setSelectedBranchId] = useState(null);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  const loadOptions = async () => {
    const [branchResponse, serviceResponse, profileResponse] = await Promise.all([
      api.get('/branches/'),
      api.get('/vss-services/'),
      api.get('/user-profiles/'),
    ]);
    setBranches(records(branchResponse));
    setServices(records(serviceResponse));
    setProfiles(records(profileResponse));
    const staffingResponses = await Promise.all(
      records(branchResponse).map((branch) => api.get(`/branches/${branch.id}/staffing/`))
    );
    setStaffing(Object.fromEntries(staffingResponses.map((response) => [response.data.branch, response.data])));
  };

  useEffect(() => {
    loadOptions().catch((error) => setMessage(error.response?.data?.detail || 'Unable to load administration data.'));
  }, []);

  const createBranch = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = { ...branchForm };
      if (editingBranchId) {
        await api.patch(`/branches/${editingBranchId}/`, payload);
        setMessage('Branch information updated successfully.');
      } else {
        await api.post('/branches/', payload);
        setMessage('Branch created successfully. Select an existing user to assign to it.');
      }
      setBranchForm(initialBranch);
      setEditingBranchId(null);
      await loadOptions();
    } catch (error) {
      setMessage(error.response?.data?.detail || 'Unable to create branch.');
    } finally {
      setSaving(false);
    }
  };

  const assignUser = async (event) => {
    event.preventDefault();
    if (!selectedProfileId) return;
    setSaving(true);
    try {
      const assignment = {
        services: userForm.services.map(Number),
        role: userForm.role,
      };
      if (['OWNER', 'SUPERADMIN'].includes(userForm.role)) {
        assignment.branch = null;
      }
      await api.patch(`/user-profiles/${selectedProfileId}/`, assignment);
      setMessage('Existing user assignment updated successfully.');
      setUserForm(initialUser);
      setSelectedProfileId('');
      await loadOptions();
    } catch (error) {
      const detail = error.response?.data?.detail || Object.values(error.response?.data || {}).flat().join(' ');
      setMessage(detail || 'Unable to save user assignment.');
    } finally {
      setSaving(false);
    }
  };

  const panel = isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200';
  const input = isDarkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200 text-slate-700';
  const updateUser = (field, value) => setUserForm((current) => ({ ...current, [field]: value }));
  const startBranchEdit = (branch) => {
    setSelectedBranchId(branch.id);
    setEditingBranchId(branch.id);
    setBranchForm({
      name: branch.name || '',
      address: branch.address || '',
      contact_number: branch.contact_number || '',
      email: branch.email || '',
    });
  };
  const startProfileEdit = (profile) => {
    setSelectedProfileId(String(profile.id));
    setUserForm({
      username: profile.username || '', first_name: profile.first_name || '',
      last_name: profile.last_name || '', email: profile.email || '', role: profile.role,
      branch: profile.branch ? String(profile.branch) : '', services: (profile.services || []).map(String),
    });
  };

  const filteredProfiles = profiles.filter((profile) => {
    if (!['BRANCH_ADMIN', 'CASHIER', 'STAFF'].includes(profile.role)) return false;
    const search = profileSearch.toLowerCase();
    return `${profile.username} ${profile.first_name} ${profile.last_name} ${profile.role_display} ${profile.branch_name}`.toLowerCase().includes(search);
  });
  const operationalProfiles = profiles.filter((profile) => ['BRANCH_ADMIN', 'CASHIER', 'STAFF'].includes(profile.role));
  const selectedProfile = operationalProfiles.find((profile) => String(profile.id) === selectedProfileId);
  const readyBranches = branches.filter((branch) => staffing[branch.name]?.ready).length;
  const assignedProfiles = profiles.filter((profile) => profile.branch);

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
        <div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-600">Organization control</p><h3 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>System Administration</h3><p className="mt-1 text-xs text-slate-500">Manage branches and assign existing users to their operational roles.</p></div>
        <div className="text-right text-xs text-slate-500">{branches.length} branches · {assignedProfiles.length} assigned users</div>
      </div>
      {message && <div className="rounded-lg border border-cyan-200 bg-cyan-50 px-4 py-3 text-xs text-cyan-700">{message}</div>}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className={`${panel} flex items-center gap-3 rounded-xl border p-4`}><Building2 className="text-cyan-600" size={20} /><div><p className="text-[10px] uppercase tracking-wider text-slate-500">Branches</p><strong className="text-xl">{branches.length}</strong></div></div>
        <div className={`${panel} flex items-center gap-3 rounded-xl border p-4`}><CheckCircle2 className="text-emerald-600" size={20} /><div><p className="text-[10px] uppercase tracking-wider text-slate-500">Ready branches</p><strong className="text-xl">{readyBranches}</strong></div></div>
        <div className={`${panel} flex items-center gap-3 rounded-xl border p-4`}><Users className="text-blue-600" size={20} /><div><p className="text-[10px] uppercase tracking-wider text-slate-500">Assigned users</p><strong className="text-xl">{assignedProfiles.length}</strong></div></div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <form onSubmit={createBranch} className={`${panel} border rounded-xl p-5 space-y-3`}>
          <div className="flex items-center gap-2"><Building2 size={18} className="text-cyan-600" /><h4 className="font-bold">{editingBranchId ? 'Edit Branch' : 'Create Branch'}</h4></div>
          <input required value={branchForm.name} onChange={(event) => setBranchForm({ ...branchForm, name: event.target.value })} placeholder="Branch name" className={`${input} w-full rounded-lg border p-2 text-sm`} />
          <textarea value={branchForm.address} onChange={(event) => setBranchForm({ ...branchForm, address: event.target.value })} placeholder="Branch description or address" className={`${input} w-full rounded-lg border p-2 text-sm`} />
          <input value={branchForm.contact_number} onChange={(event) => setBranchForm({ ...branchForm, contact_number: event.target.value })} placeholder="Contact number" className={`${input} w-full rounded-lg border p-2 text-sm`} />
          <input type="email" value={branchForm.email} onChange={(event) => setBranchForm({ ...branchForm, email: event.target.value })} placeholder="Branch email" className={`${input} w-full rounded-lg border p-2 text-sm`} />
          <button disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-600 py-2 text-sm font-semibold text-white disabled:opacity-50"><Save size={15} />{editingBranchId ? 'Save Branch' : 'Create Branch'}</button>
          {editingBranchId && <button type="button" onClick={() => { setEditingBranchId(null); setBranchForm(initialBranch); }} className="flex w-full items-center justify-center gap-2 rounded-lg border py-2 text-sm"><X size={15} />Cancel</button>}
          <div className="border-t pt-3 text-xs text-slate-500">Existing branches: {branches.length}</div>
          <div className="space-y-2 pt-2">
            {branches.map((branch) => {
              const status = staffing[branch.name];
              const selected = selectedBranchId === branch.id;
              return <button type="button" key={branch.id} onClick={() => startBranchEdit(branch)} className={`w-full rounded-lg border p-3 text-left text-xs transition ${selected ? 'border-cyan-500 bg-cyan-50' : 'border-slate-200 hover:border-cyan-300'}`}><div className="flex justify-between font-semibold"><span>{branch.name}</span>{status?.ready ? <CheckCircle2 size={14} className="text-emerald-600" /> : <AlertTriangle size={14} className="text-amber-500" />}</div><p className="mt-1 text-slate-500">{branch.address || 'No description'}</p><p className="mt-1 text-slate-500">{branch.contact_number || 'No contact'} · {branch.email || 'No email'}</p><div className="mt-2 grid grid-cols-3 gap-1 text-center text-[10px]"><span className="rounded bg-slate-100 px-1 py-1">Admin<br /><strong>{status?.roles?.BRANCH_ADMIN || 0}</strong></span><span className="rounded bg-slate-100 px-1 py-1">Cashier<br /><strong>{status?.roles?.CASHIER || 0}</strong></span><span className="rounded bg-slate-100 px-1 py-1">Staff<br /><strong>{status?.roles?.STAFF || 0}</strong></span></div></button>;
            })}
          </div>
        </form>

        <form onSubmit={assignUser} className={`${panel} border rounded-xl p-5 space-y-3 lg:col-span-2`}>
          <div className="flex items-center gap-2"><UserCheck size={18} className="text-cyan-600" /><h4 className="font-bold">Assign Existing User</h4></div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <select required value={selectedProfileId} onChange={(event) => { const profile = profiles.find((item) => String(item.id) === event.target.value); if (profile) startProfileEdit(profile); }} className={`${input} rounded-lg border p-2 text-sm md:col-span-2`}>
              <option value="">Select an existing user</option>
              {operationalProfiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.username} · {profile.role_display} · {profile.branch_name || 'Organization-wide'}</option>)}
            </select>
            {selectedProfile && <div className="rounded-lg border border-cyan-200 bg-cyan-50 p-3 text-xs md:col-span-2"><div className="flex items-center justify-between"><div><p className="font-bold text-cyan-900">{selectedProfile.first_name || selectedProfile.username} {selectedProfile.last_name}</p><p className="text-cyan-700">{selectedProfile.email || 'No email'} · {selectedProfile.branch_name || 'No branch assigned'}</p></div><span className="rounded-full bg-white px-2 py-1 font-semibold text-cyan-700">{selectedProfile.role_display}</span></div></div>}
            <select value={userForm.role} onChange={(event) => updateUser('role', event.target.value)} className={`${input} rounded-lg border p-2 text-sm`}>
              <option value="OWNER">Owner</option><option value="BRANCH_ADMIN">Branch Admin</option><option value="CASHIER">Cashier</option><option value="STAFF">Staff</option>
            </select>
            <select multiple value={userForm.services} onChange={(event) => updateUser('services', Array.from(event.target.selectedOptions, (option) => option.value))} className={`${input} min-h-24 rounded-lg border p-2 text-sm`}>
              {services.map((service) => <option key={service.id} value={service.id}>{service.description}</option>)}
            </select>
          </div>
          <p className="text-[11px] text-slate-500">Select an existing user, then update their role and Staff services. Their current branch assignment is preserved.</p>
          <button disabled={saving || !selectedProfileId} className="flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-600 py-2 text-sm font-semibold text-white disabled:opacity-50"><Save size={16} />Save User Assignment</button>
          {selectedProfileId && <button type="button" onClick={() => { setSelectedProfileId(''); setUserForm(initialUser); }} className="flex w-full items-center justify-center gap-2 rounded-lg border py-2 text-sm"><X size={15} />Cancel</button>}
        </form>
      </div>
      <section className={`${panel} border rounded-xl p-5`}>
        <div className="mb-3 flex flex-col justify-between gap-3 md:flex-row md:items-center"><div><h4 className="font-bold">User assignments</h4><p className="text-xs text-slate-500">Select an existing account to update its role and services.</p></div><div className="relative w-full md:w-64"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={profileSearch} onChange={(event) => setProfileSearch(event.target.value)} placeholder="Search users" className={`${input} w-full rounded-lg border py-2 pl-8 pr-3 text-xs`} /></div></div>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">{filteredProfiles.map((profile) => <button type="button" key={profile.id} onClick={() => startProfileEdit(profile)} className={`flex items-center justify-between rounded-lg border p-3 text-left text-xs transition ${selectedProfileId === String(profile.id) ? 'border-cyan-500 bg-cyan-50' : 'border-slate-200 hover:border-cyan-300'}`}><div><p className="font-semibold">{profile.first_name || profile.username} {profile.last_name} <span className="ml-1 text-cyan-600">{profile.role_display}</span></p><p className="text-slate-500">{profile.username} · {profile.branch_name || 'Organization-wide'}</p><p className="mt-1 text-slate-400">{profile.service_names?.length || 0} assigned services</p></div><Edit3 size={15} className="text-cyan-600" /></button>)}</div>
      </section>
    </div>
  );
}
