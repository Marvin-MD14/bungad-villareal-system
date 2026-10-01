import { useEffect, useMemo, useState } from 'react';
import { Building2, UserCheck, Edit3, Save, X, Search, Users, CheckCircle2, AlertTriangle, Plus, Store, Globe } from 'lucide-react';
import { getActiveBusinessSlug, getGrantedBusinesses } from '../utils/session';
import { api } from '../utils/api';

const records = (response) => response.data.results || response.data;
const initialUser = { username: '', first_name: '', last_name: '', email: '', role: '', branch: '', services: [] };

// §6.3 role codes. Company-wide roles carry business=NULL; the rest are
// business roles and are the ones an operator can be assigned at an outlet.
// (BRANCH_ADMIN is the pre-rename spelling of BUSINESS_MANAGER.)
const COMPANY_WIDE_ROLES = ['SUPERADMIN', 'OWNER', 'COMPANY_ADMIN', 'ACCOUNTANT'];
const OUTLET_ROLES = ['BUSINESS_MANAGER', 'SUPERVISOR', 'CASHIER', 'STAFF'];
const initialBranch = { name: '', address: '', contact_number: '', email: '', business: '' };
const initialBusiness = { name: '', slug: '', business_type: '', description: '', currency: '', tax_rate: '' };

/** The signed-in account, as stored by the login handler. */
const currentUser = () => {
  try {
    return JSON.parse(localStorage.getItem('authUser')) || {};
  } catch {
    return {};
  }
};

/** "Front Desk Spa" -> "front-desk-spa" */
const slugify = (value) =>
  String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

// A brand-new branch defaults to the business the operator is currently acting
// as; company-wide OWNERs with several grants can switch it in the form.
const defaultBusinessId = () => {
  const slug = getActiveBusinessSlug();
  const match = getGrantedBusinesses().find((business) => business.slug === slug);
  return match ? String(match.id) : '';
};

export default function AdministrationPage({ isDarkMode = false }) {
  const [branches, setBranches] = useState([]);
  const [businesses, setBusinesses] = useState(getGrantedBusinesses());
  const [businessTypes, setBusinessTypes] = useState([]);
  // Assignable roles, fetched from the API (UserAccess.ROLE_CHOICES).
  const [roles, setRoles] = useState([]);
  const [activeBusinessId, setActiveBusinessId] = useState(() => defaultBusinessId());
  const [businessForm, setBusinessForm] = useState(initialBusiness);
  const [showBusinessForm, setShowBusinessForm] = useState(false);
  // When set, the business form edits that business instead of creating one.
  const [editingBusinessId, setEditingBusinessId] = useState(null);
  const [staffing, setStaffing] = useState({});
  const [services, setServices] = useState([]);
  const [branchForm, setBranchForm] = useState(() => ({ ...initialBranch, business: defaultBusinessId() }));
  const [editingBranchId, setEditingBranchId] = useState(null);
  const [userForm, setUserForm] = useState(initialUser);
  const [profiles, setProfiles] = useState([]);
  const [selectedProfileId, setSelectedProfileId] = useState('');
  const [profileSearch, setProfileSearch] = useState('');
  const [selectedBranchId, setSelectedBranchId] = useState(null);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  const loadOptions = async () => {
    const [branchResponse, serviceResponse, profileResponse, businessResponse, typeResponse, capsResponse] = await Promise.all([
      api.get('/branches/'),
      // Unified catalog (the retired /vss-services/ shim is gone).
      api.get('/catalog/items/?item_type=SERVICE'),
      api.get('/user-profiles/'),
      api.get('/businesses/'),
      api.get('/business-types/'),
      api.get('/auth/capabilities/'),
    ]);
    setBranches(records(branchResponse));
    setServices(records(serviceResponse));
    setProfiles(records(profileResponse));
    // Server truth beats the cached login list: it includes businesses created
    // since sign-in and carries `branch_count` for the tabs.
    const businessRows = records(businessResponse);
    if (businessRows.length) setBusinesses(businessRows);
    setBusinessTypes(records(typeResponse));
    // Role list for the assignment dropdown — the API's copy of ROLE_CHOICES.
    const caps = records(capsResponse);
    if (caps.roles) setRoles(caps.roles);
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
      const branchPayload = { ...branchForm };
      delete branchPayload.business; // a branch cannot move businesses
      const payload = { ...branchPayload };
      if (editingBranchId) {
        await api.patch(`/branches/${editingBranchId}/`, payload);
        setMessage('Outlet information updated successfully.');
      } else {
        // The open tab is the destination; fall back to the form value.
        const destination = businesses.some((b) => String(b.id) === String(activeBusinessId))
          ? activeBusinessId : (businesses[0]?.id ?? '');
        if (destination) payload.business = Number(destination);
        else if (payload.business) payload.business = Number(payload.business);
        else delete payload.business; // else infer from active grant
        await api.post('/branches/', payload);
        setMessage('Outlet created successfully. Select an existing user to assign to it.');
      }
      setBranchForm({ ...initialBranch, business: defaultBusinessId() });
      setEditingBranchId(null);
      await loadOptions();
    } catch (error) {
      const data = error.response?.data;
      const first = data && (data.business?.[0] || data.name?.[0] || data.detail);
      setMessage(first || 'Unable to create branch.');
    } finally {
      setSaving(false);
    }
  };

  const createBusiness = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: businessForm.name.trim(),
        slug: businessForm.slug.trim() || slugify(businessForm.name),
        business_type: Number(businessForm.business_type),
        description: businessForm.description || '',
        currency: businessForm.currency || '',
      };
      if (businessForm.tax_rate !== '') payload.tax_rate = businessForm.tax_rate;

      if (editingBusinessId) {
        await api.patch(`/businesses/${editingBusinessId}/`, payload);
        setMessage(`Business "${payload.name}" updated.`);
      } else {
        const response = await api.post('/businesses/', payload);
        // A new business is created with a default "Main" outlet, so it is
        // immediately usable — tell the operator that instead of leaving them to
        // wonder why they have to add a branch.
        setMessage(`Business "${response.data.name}" created with its default "Main" branch.`);
        if (response.data?.id) setActiveBusinessId(String(response.data.id));
      }
      setBusinessForm(initialBusiness);
      setShowBusinessForm(false);
      setEditingBusinessId(null);
      await loadOptions();
    } catch (error) {
      const data = error.response?.data;
      const first = data && (data.slug?.[0] || data.name?.[0] || data.business_type?.[0] || data.detail);
      setMessage(first || (editingBusinessId ? 'Unable to update business.' : 'Unable to create business.'));
    } finally {
      setSaving(false);
    }
  };

  const startBusinessEdit = (business) => {
    setEditingBusinessId(business.id);
    setActiveBusinessId(String(business.id));
    setBusinessForm({
      name: business.name || '',
      slug: business.slug || '',
      business_type: business.business_type || '',
      description: business.description || '',
      currency: business.currency || '',
      tax_rate: business.tax_rate ?? '',
    });
    setShowBusinessForm(true);
    setMessage('');
  };

  const closeBusinessForm = () => {
    setShowBusinessForm(false);
    setEditingBusinessId(null);
    setBusinessForm(initialBusiness);
  };

  // §7.10: retiring a business sets is_active=False so its sales, expenses and
  // reports stay truthful. This is the safe default over deleting.
  const setBusinessActive = async (business, isActive) => {
    setSaving(true);
    try {
      await api.patch(`/businesses/${business.id}/`, { is_active: isActive });
      setMessage(`Business "${business.name}" ${isActive ? 'reactivated' : 'deactivated'}.`);
      await loadOptions();
    } catch (error) {
      setMessage(error.response?.data?.detail || `Unable to ${isActive ? 'reactivate' : 'deactivate'} the business.`);
    } finally {
      setSaving(false);
    }
  };

  const deleteBusiness = async (business) => {
    const confirmed = window.confirm(
      `Delete "${business.name}"?\n\nThis is permanent. If it has any sales, stock or staff history the API will ` +
      'refuse and ask you to deactivate it instead.'
    );
    if (!confirmed) return;
    setSaving(true);
    try {
      await api.delete(`/businesses/${business.id}/`);
      setMessage(`Business "${business.name}" deleted.`);
      closeBusinessForm();
      await loadOptions();
    } catch (error) {
      const detail = error.response?.data?.detail;
      // 409 = it still owns history; the API tells us to deactivate instead.
      setMessage(detail || 'Unable to delete the business.');
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
      // A company-wide role is not tied to an outlet, so the grant takes no
      // branch. (Was ['OWNER', 'SUPERADMIN'] — SUPERADMIN is the pre-rename name.)
      if (COMPANY_WIDE_ROLES.includes(userForm.role)) {
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
  const updateBusiness = (field, value) => setBusinessForm((current) => ({ ...current, [field]: value }));

  // Business management (create/edit/retire a business) is a *platform* action,
  // which §6.3's split assigns to SUPERADMIN. The Owner runs the company and
  // deliberately cannot restructure it, so gate on the role code.
  const me = currentUser();
  const isSuperadmin = me.role_code === 'SUPERADMIN' || me.role === 'SUPERADMIN';

  // Each business is its own ecosystem: its outlets, and the staff working them.
  // Branch rows carry `business` (id) and profiles carry `branch`, so the whole
  // page can be scoped to one business tab without a second request.
  const branchBusiness = useMemo(
    () => Object.fromEntries(branches.map((branch) => [String(branch.id), String(branch.business)])),
    [branches]
  );
  const profileBusinessId = (profile) => branchBusiness[String(profile.branch)] || null;
  // Derived, not synced in an effect: the cached default tab may name a business
  // this account can no longer see, so fall back to the first one still listed.
  const tabId = businesses.length && !businesses.some((b) => String(b.id) === String(activeBusinessId))
    ? String(businesses[0].id)
    : activeBusinessId;
  const scopedBranches = tabId
    ? branches.filter((branch) => String(branch.business) === String(tabId))
    : branches;

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
    if (!OUTLET_ROLES.includes(profile.role)) return false;
    // Keep the list inside the selected business's ecosystem.
    if (tabId && profileBusinessId(profile) !== String(tabId)) return false;
    const search = profileSearch.toLowerCase();
    return `${profile.username} ${profile.first_name} ${profile.last_name} ${profile.role_display} ${profile.branch_name}`.toLowerCase().includes(search);
  });
  const operationalProfiles = profiles.filter((profile) => OUTLET_ROLES.includes(profile.role));
  const selectedProfile = operationalProfiles.find((profile) => String(profile.id) === selectedProfileId);
  const readyBranches = scopedBranches.filter((branch) => staffing[branch.name]?.ready).length;
  const assignedProfiles = profiles.filter((profile) => profile.branch);
  const activeBusiness = businesses.find((business) => String(business.id) === String(tabId));

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
        <div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-600">Organization control</p><h3 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>System Administration</h3><p className="mt-1 text-xs text-slate-500">Manage businesses and their outlets, and assign existing users to their operational roles.</p></div>
        <div className="flex items-center gap-3">
          <div className="text-xs text-slate-500">{scopedBranches.length} outlets · {filteredProfiles.length} staff</div>
          {isSuperadmin && (
            <button type="button" onClick={() => (showBusinessForm ? closeBusinessForm() : setShowBusinessForm(true))} className="flex items-center gap-2 rounded-lg bg-cyan-600 px-3 py-2 text-xs font-semibold text-white hover:bg-cyan-700">
              {showBusinessForm ? <X size={15} /> : <Plus size={15} />}{showBusinessForm ? 'Cancel' : 'New Business'}
            </button>
          )}
        </div>
      </div>
      {message && <div className="rounded-lg border border-cyan-200 bg-cyan-50 px-4 py-3 text-xs text-cyan-700">{message}</div>}

      {isSuperadmin && showBusinessForm && (
        <form onSubmit={createBusiness} className={`${panel} space-y-3 rounded-xl border p-5`}>
          <div className="flex items-center gap-2"><Globe size={18} className="text-cyan-600" /><h4 className="font-bold">{editingBusinessId ? 'Edit Business' : 'Create a Business'}</h4></div>
          <p className="text-xs text-slate-500">
            {editingBusinessId ? (
              <>Update the details of this business. Its <strong>slug</strong> is the identifier sent as the <code>X-Business</code> header, so changing it switches every client to the new value.</>
            ) : (
              <>A <strong>Business</strong> is the top unit you run; it is created with a default <strong>&quot;Main&quot;</strong> outlet so it is usable immediately. Add more outlets from the tab below.</>
            )}
          </p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <input required placeholder="Business name" value={businessForm.name} onChange={(event) => updateBusiness('name', event.target.value)} className={`${input} rounded-lg border p-2 text-sm`} />
            <input placeholder="Slug (auto from name)" value={businessForm.slug} onChange={(event) => updateBusiness('slug', event.target.value)} className={`${input} rounded-lg border p-2 text-sm`} />
            <select required value={businessForm.business_type} onChange={(event) => updateBusiness('business_type', event.target.value)} className={`${input} rounded-lg border p-2 text-sm`}>
              <option value="">Business type…</option>
              {businessTypes.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}
            </select>
            <input placeholder="Currency (blank = company default)" value={businessForm.currency} onChange={(event) => updateBusiness('currency', event.target.value)} className={`${input} rounded-lg border p-2 text-sm`} />
            <input placeholder="Tax rate % (optional)" type="number" step="0.01" value={businessForm.tax_rate} onChange={(event) => updateBusiness('tax_rate', event.target.value)} className={`${input} rounded-lg border p-2 text-sm`} />
            <input placeholder="Description (optional)" value={businessForm.description} onChange={(event) => updateBusiness('description', event.target.value)} className={`${input} rounded-lg border p-2 text-sm`} />
          </div>
          <button disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-600 py-2 text-sm font-semibold text-white disabled:opacity-50"><Save size={15} />{editingBusinessId ? 'Save Changes' : 'Create Business'}</button>
          {editingBusinessId && <button type="button" onClick={closeBusinessForm} className="flex w-full items-center justify-center gap-2 rounded-lg border py-2 text-sm"><X size={15} />Cancel</button>}
        </form>
      )}

      {businesses.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2">
          <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500"><Store size={13} />Businesses</span>
          {businesses.map((business) => {
            const selected = String(business.id) === String(tabId);
            return (
              <button key={business.id} type="button" onClick={() => setActiveBusinessId(String(business.id))}
                className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${selected ? 'border-cyan-500 bg-cyan-600 text-white' : 'border-slate-200 hover:border-cyan-300'}`}>
                {business.name}
                <span className={`ml-2 text-[10px] ${selected ? 'text-cyan-100' : 'text-slate-400'}`}>
                  {branches.filter((branch) => String(branch.business) === String(business.id)).length}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {activeBusiness && (
        <div className="flex flex-col justify-between gap-2 md:flex-row md:items-center">
          <p className="text-xs text-slate-500">
            Showing the ecosystem of <strong>{activeBusiness.name}</strong>
            {activeBusiness.slug ? <> (<code className="text-[11px]">{activeBusiness.slug}</code>)</> : null}
            {' '}— its outlets and the staff assigned to them.
            {activeBusiness.is_active === false && <span className="ml-2 rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold uppercase text-slate-600">Inactive</span>}
          </p>
          {isSuperadmin && (
            // Only the Owner may change org structure; the API enforces this too
            // (Business:* is denied to BUSINESS_MANAGER), this just avoids
            // showing buttons that would 403.
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => startBusinessEdit(activeBusiness)} className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold hover:border-cyan-400">
                <Edit3 size={14} /> Edit
              </button>
              <button type="button" disabled={saving} onClick={() => setBusinessActive(activeBusiness, activeBusiness.is_active === false)} className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold hover:border-cyan-400 disabled:opacity-50">
                {activeBusiness.is_active === false ? 'Reactivate' : 'Deactivate'}
              </button>
              <button type="button" disabled={saving} onClick={() => deleteBusiness(activeBusiness)} className="flex items-center gap-1.5 rounded-lg border border-rose-300 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50">
                <X size={14} /> Delete
              </button>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className={`${panel} flex items-center gap-3 rounded-xl border p-4`}><Building2 className="text-cyan-600" size={20} /><div><p className="text-[10px] uppercase tracking-wider text-slate-500">Outlets</p><strong className="text-xl">{scopedBranches.length}</strong></div></div>
        <div className={`${panel} flex items-center gap-3 rounded-xl border p-4`}><CheckCircle2 className="text-emerald-600" size={20} /><div><p className="text-[10px] uppercase tracking-wider text-slate-500">Ready outlets</p><strong className="text-xl">{readyBranches}</strong></div></div>
        <div className={`${panel} flex items-center gap-3 rounded-xl border p-4`}><Users className="text-blue-600" size={20} /><div><p className="text-[10px] uppercase tracking-wider text-slate-500">Assigned users</p><strong className="text-xl">{assignedProfiles.length}</strong></div></div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <form onSubmit={createBranch} className={`${panel} border rounded-xl p-5 space-y-3`}>
          <div className="flex items-center gap-2"><Building2 size={18} className="text-cyan-600" /><h4 className="font-bold">{editingBranchId ? 'Edit Outlet' : 'Add Outlet'}</h4></div>
          <p className="text-xs text-slate-500">An <strong>outlet</strong> (branch) belongs to {activeBusiness ? <><strong>{activeBusiness.name}</strong></> : 'the selected business'}.</p>
          {editingBranchId ? (
            <p className="rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-500">
              Business: <strong>{(branches.find((b) => b.id === editingBranchId)?.business_name) || 'Current business'}</strong> · an outlet cannot be moved to another business.
            </p>
          ) : tabId ? (
            <p className="rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-500">
              Adding to <strong>{activeBusiness?.name || 'the selected business'}</strong>
            </p>
          ) : businesses.length > 1 ? (
            <select required value={branchForm.business} onChange={(event) => setBranchForm({ ...branchForm, business: event.target.value })} className={`${input} w-full rounded-lg border p-2 text-sm`}>
              <option value="">Select a business…</option>
              {businesses.map((business) => <option key={business.id} value={String(business.id)}>{business.name}</option>)}
            </select>
          ) : null}
          <input required value={branchForm.name} onChange={(event) => setBranchForm({ ...branchForm, name: event.target.value })} placeholder="Outlet name" className={`${input} w-full rounded-lg border p-2 text-sm`} />
          <textarea value={branchForm.address} onChange={(event) => setBranchForm({ ...branchForm, address: event.target.value })} placeholder="Address or description" className={`${input} w-full rounded-lg border p-2 text-sm`} />
          <input value={branchForm.contact_number} onChange={(event) => setBranchForm({ ...branchForm, contact_number: event.target.value })} placeholder="Contact number" className={`${input} w-full rounded-lg border p-2 text-sm`} />
          <input type="email" value={branchForm.email} onChange={(event) => setBranchForm({ ...branchForm, email: event.target.value })} placeholder="Email" className={`${input} w-full rounded-lg border p-2 text-sm`} />
          <button disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-600 py-2 text-sm font-semibold text-white disabled:opacity-50"><Save size={15} />{editingBranchId ? 'Save Outlet' : 'Add Outlet'}</button>
          {editingBranchId && <button type="button" onClick={() => { setEditingBranchId(null); setBranchForm({ ...initialBranch, business: defaultBusinessId() }); }} className="flex w-full items-center justify-center gap-2 rounded-lg border py-2 text-sm"><X size={15} />Cancel</button>}
          <div className="border-t pt-3 text-xs text-slate-500">Existing outlets in this business: {scopedBranches.length}</div>
          <div className="space-y-2 pt-2">
            {branches.map((branch) => {
              if (activeBusinessId && String(branch.business) !== String(activeBusinessId)) return null;
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
            {/* Roles come from UserAccess.ROLE_CHOICES via /auth/capabilities/.
                This list used to be four hardcoded options and still offered
                the retired BRANCH_ADMIN, which §6.3 renamed BUSINESS_MANAGER. */}
            <select value={userForm.role} onChange={(event) => updateUser('role', event.target.value)} className={`${input} rounded-lg border p-2 text-sm`}>
              <option value="">Select a role…</option>
              {(roles.length ? roles : OUTLET_ROLES.map((value) => ({ value, label: value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) }))).map((role) => (
                <option key={role.value} value={role.value}>{role.label}</option>
              ))}
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
