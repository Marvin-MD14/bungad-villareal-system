import { useEffect, useState } from 'react';
import axios from 'axios';
import {
  Users, Gift, TrendingUp, Loader2, Search, Crown,
  Award, Star, Shield, ChevronLeft, ChevronRight,
} from 'lucide-react';
import CustomerTierBadge from './CustomerTierBadge';

const api = axios.create({ baseURL: 'http://127.0.0.1:8000/api' });
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');
  if (token) config.headers.Authorization = `Token ${token}`;
  return config;
});

const records = (response) => response.data.results || response.data;

export default function CustomersRewardsPage({ isDarkMode }) {
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerRewards, setCustomerRewards] = useState([]);
  const [showRewardsModal, setShowRewardsModal] = useState(false);

  const entriesPerPage = 10;

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await api.get('/clients/');
        setCustomers(records(res));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filtered = customers.filter((c) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      c.full_name?.toLowerCase().includes(q) ||
      c.phone_number?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q);
    const matchTier = tierFilter === 'ALL' || c.loyalty_tier === tierFilter;
    return matchSearch && matchTier;
  });

  const totalPages = Math.ceil(filtered.length / entriesPerPage) || 1;
  const paginated = filtered.slice((page - 1) * entriesPerPage, page * entriesPerPage);

  const loadCustomerRewards = async (customer) => {
    setSelectedCustomer(customer);
    setShowRewardsModal(true);
    try {
      const res = await api.get(`/customer-rewards/?customer_id=${customer.id}`);
      setCustomerRewards(records(res));
    } catch (e) {
      setCustomerRewards([]);
    }
  };

  const panel = isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200';
  const input = isDarkMode
    ? 'bg-slate-700 border-slate-600 text-white'
    : 'bg-white border-slate-200 text-slate-700';

  // Tier stats
  const tierStats = {
    BRONZE: customers.filter((c) => c.loyalty_tier === 'BRONZE').length,
    SILVER: customers.filter((c) => c.loyalty_tier === 'SILVER').length,
    GOLD: customers.filter((c) => c.loyalty_tier === 'GOLD').length,
    PLATINUM: customers.filter((c) => c.loyalty_tier === 'PLATINUM').length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={32} className="animate-spin text-cyan-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
        <div>
          <h2 className={`text-lg font-bold flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
            <Gift className="text-cyan-600" size={20} />
            Customer Loyalty & Rewards
          </h2>
          <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            {customers.length} total customers · Track tiers, points, and rewards
          </p>
        </div>
      </div>

      {/* Tier Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className={`${panel} border rounded-xl p-4 flex items-center gap-3`}>
          <div className="w-10 h-10 bg-gradient-to-r from-amber-600 to-amber-800 rounded-lg flex items-center justify-center">
            <Shield size={18} className="text-white" />
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold text-slate-500">Bronze</p>
            <p className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
              {tierStats.BRONZE}
            </p>
          </div>
        </div>

        <div className={`${panel} border rounded-xl p-4 flex items-center gap-3`}>
          <div className="w-10 h-10 bg-gradient-to-r from-slate-400 to-slate-600 rounded-lg flex items-center justify-center">
            <Award size={18} className="text-white" />
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold text-slate-500">Silver</p>
            <p className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
              {tierStats.SILVER}
            </p>
          </div>
        </div>

        <div className={`${panel} border rounded-xl p-4 flex items-center gap-3`}>
          <div className="w-10 h-10 bg-gradient-to-r from-yellow-400 to-yellow-600 rounded-lg flex items-center justify-center">
            <Star size={18} className="text-white" />
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold text-slate-500">Gold</p>
            <p className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
              {tierStats.GOLD}
            </p>
          </div>
        </div>

        <div className={`${panel} border rounded-xl p-4 flex items-center gap-3`}>
          <div className="w-10 h-10 bg-gradient-to-r from-cyan-400 to-blue-600 rounded-lg flex items-center justify-center">
            <Crown size={18} className="text-white" />
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold text-slate-500">Platinum</p>
            <p className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
              {tierStats.PLATINUM}
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className={`${panel} border rounded-xl p-3 flex flex-col md:flex-row gap-2`}>
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, phone, or email..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className={`${input} w-full pl-9 pr-3 py-2 rounded-lg text-xs border outline-none focus:border-cyan-500`}
          />
        </div>
        <select
          value={tierFilter}
          onChange={(e) => { setTierFilter(e.target.value); setPage(1); }}
          className={`${input} rounded-lg border px-3 py-2 text-xs font-semibold min-w-[150px]`}
        >
          <option value="ALL">All Tiers</option>
          <option value="BRONZE">Bronze</option>
          <option value="SILVER">Silver</option>
          <option value="GOLD">Gold</option>
          <option value="PLATINUM">Platinum</option>
        </select>
      </div>

      {/* Customer Table */}
      <div className={`${panel} border rounded-xl overflow-hidden`}>
        <table className="w-full text-left">
          <thead className={`${isDarkMode ? 'bg-slate-700/60 text-slate-400' : 'bg-slate-100 text-slate-500'} text-[10px] font-bold uppercase`}>
            <tr>
              <th className="py-3 px-4">Customer</th>
              <th className="py-3 px-4">Tier</th>
              <th className="py-3 px-4 text-right">Total Spent</th>
              <th className="py-3 px-4 text-right">Points</th>
              <th className="py-3 px-4 text-center">Free Items</th>
              <th className="py-3 px-4 text-center">Rewards</th>
              <th className="py-3 px-4 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className={`divide-y ${isDarkMode ? 'divide-slate-700' : 'divide-slate-100'}`}>
            {paginated.length === 0 ? (
              <tr>
                <td colSpan="7" className={`text-center py-8 text-xs ${isDarkMode ? 'text-slate-500' : 'text-slate-400'} italic`}>
                  No customers found
                </td>
              </tr>
            ) : (
              paginated.map((c) => (
                <tr key={c.id} className={isDarkMode ? 'hover:bg-slate-700/50' : 'hover:bg-slate-50/50'}>
                  <td className="py-3 px-4">
                    <div>
                      <p className={`text-xs font-semibold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                        {c.full_name}
                      </p>
                      <p className="text-[10px] text-slate-500">{c.phone_number || c.email || 'No contact'}</p>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <CustomerTierBadge tier={c.loyalty_tier || 'BRONZE'} size="sm" />
                  </td>
                  <td className={`py-3 px-4 text-xs font-bold text-right ${isDarkMode ? 'text-cyan-400' : 'text-cyan-600'}`}>
                    ₱{Number(c.total_spent || 0).toFixed(2)}
                  </td>
                  <td className={`py-3 px-4 text-xs font-semibold text-right ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                    {Number(c.loyalty_points || 0).toFixed(0)}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      c.free_items_available > 0
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-slate-100 text-slate-500'
                    }`}>
                      {c.free_items_available || 0}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      c.available_rewards_count > 0
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-slate-100 text-slate-500'
                    }`}>
                      {c.available_rewards_count || 0}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <button
                      onClick={() => loadCustomerRewards(c)}
                      className="text-[10px] font-bold px-2 py-1 rounded bg-cyan-600 hover:bg-cyan-700 text-white"
                    >
                      View Rewards
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination */}
        <div className={`flex justify-between items-center px-4 py-3 border-t ${
          isDarkMode ? 'border-slate-700 text-slate-400' : 'border-slate-100 text-slate-500'
        } text-xs`}>
          <div>Showing {paginated.length} of {filtered.length} customers</div>
          <div className="flex items-center gap-1">
            <button
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
              className={`px-2 py-1 border rounded disabled:opacity-40 ${isDarkMode ? 'border-slate-600' : 'border-slate-200'}`}
            >
              <ChevronLeft size={12} />
            </button>
            <span className="px-2 font-bold">{page} / {totalPages}</span>
            <button
              disabled={page === totalPages}
              onClick={() => setPage(page + 1)}
              className={`px-2 py-1 border rounded disabled:opacity-40 ${isDarkMode ? 'border-slate-600' : 'border-slate-200'}`}
            >
              <ChevronRight size={12} />
            </button>
          </div>
        </div>
      </div>

      {/* Rewards Modal */}
      {showRewardsModal && selectedCustomer && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={`${panel} border rounded-2xl max-w-lg w-full max-h-[80vh] overflow-y-auto`}>
            <div className={`sticky top-0 ${panel} border-b p-4 flex justify-between items-center`}>
              <div>
                <h3 className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                  {selectedCustomer.full_name}'s Rewards
                </h3>
                <div className="mt-1 flex items-center gap-2">
                  <CustomerTierBadge tier={selectedCustomer.loyalty_tier || 'BRONZE'} size="sm" />
                  <span className="text-[10px] text-slate-500">
                    Total Spent: ₱{Number(selectedCustomer.total_spent).toFixed(2)}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setShowRewardsModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="p-4 space-y-2">
              {customerRewards.length === 0 ? (
                <p className="text-xs text-center py-8 text-slate-400 italic">No rewards yet.</p>
              ) : (
                customerRewards.map((r) => (
                  <div
                    key={r.id}
                    className={`p-3 rounded-lg border ${
                      r.status === 'AVAILABLE'
                        ? isDarkMode
                          ? 'bg-emerald-900/20 border-emerald-700/50'
                          : 'bg-emerald-50 border-emerald-200'
                        : isDarkMode
                          ? 'bg-slate-700/30 border-slate-600'
                          : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <p className={`text-xs font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                          {r.title}
                        </p>
                        <p className="text-[10px] text-slate-500 mt-0.5">{r.description}</p>
                      </div>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                        r.status === 'AVAILABLE'
                          ? 'bg-emerald-100 text-emerald-700'
                          : r.status === 'CLAIMED'
                            ? 'bg-slate-100 text-slate-600'
                            : 'bg-red-100 text-red-600'
                      }`}>
                        {r.status}
                      </span>
                    </div>
                    {r.discount_percent > 0 && (
                      <p className="text-[10px] font-bold text-emerald-600 mt-1">
                        Discount: -{Number(r.discount_percent).toFixed(0)}%
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}