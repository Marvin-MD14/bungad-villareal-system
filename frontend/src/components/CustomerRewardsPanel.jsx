import { useEffect, useState } from 'react';
import axios from 'axios';
import { Gift, Loader2, TrendingUp, Sparkles } from 'lucide-react';
import CustomerTierBadge from './CustomerTierBadge';
import { applyBusinessHeader } from '../utils/session';

const api = axios.create({ baseURL: 'http://127.0.0.1:8000/api' });
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');
  if (token) config.headers.Authorization = `Token ${token}`;
  return applyBusinessHeader(config);
});

export default function CustomerRewardsPanel({
  customerId,
  isDarkMode,
  onRewardsChange,
  onTierDiscountChange,
}) {
  const [tierData, setTierData] = useState(null);
  const [rewards, setRewards] = useState([]);
  const [selectedRewards, setSelectedRewards] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!customerId) {
      setTierData(null);
      setRewards([]);
      setSelectedRewards([]);
      if (onRewardsChange) onRewardsChange([]);
      if (onTierDiscountChange) onTierDiscountChange(0);
      return;
    }

    const load = async () => {
      setLoading(true);
      try {
        const [tierRes, rewardsRes] = await Promise.all([
          api.get(`/customer-tier/by-customer/${customerId}/`),
          api.get(`/customer-rewards/?customer_id=${customerId}&status=AVAILABLE`),
        ]);
        setTierData(tierRes.data);
        setRewards(rewardsRes.data.results || rewardsRes.data);

        // Notify parent of tier discount rate
        if (onTierDiscountChange) {
          onTierDiscountChange(tierRes.data.discount_rate || 0);
        }
      } catch (error) {
        console.error('Load rewards error:', error);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [customerId]);

  useEffect(() => {
    if (onRewardsChange) onRewardsChange(selectedRewards);
  }, [selectedRewards]);

  if (!customerId) return null;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 size={20} className="animate-spin text-cyan-600" />
      </div>
    );
  }

  if (!tierData) return null;

  const toggleReward = (rewardId) => {
    setSelectedRewards((prev) =>
      prev.includes(rewardId) ? prev.filter((id) => id !== rewardId) : [...prev, rewardId]
    );
  };

  const panel = isDarkMode
    ? 'bg-slate-700/50 border-slate-600'
    : 'bg-gradient-to-r from-cyan-50 to-blue-50 border-cyan-200';

  const totalRewardDiscount = rewards
    .filter((r) => selectedRewards.includes(r.id))
    .reduce((sum, r) => sum + (Number(r.discount_percent) || 0), 0);

  return (
    <div className={`${panel} border rounded-xl p-3 space-y-3 mb-3`}>
      {/* Tier Info */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CustomerTierBadge tier={tierData.loyalty_tier} size="md" />
          <span
            className={`text-[10px] font-semibold ${
              isDarkMode ? 'text-slate-400' : 'text-slate-500'
            }`}
          >
            {tierData.discount_rate}% discount
          </span>
        </div>
        <div className="text-right">
          <p
            className={`text-[10px] uppercase font-semibold ${
              isDarkMode ? 'text-slate-400' : 'text-slate-500'
            }`}
          >
            Total Spent
          </p>
          <p className={`text-xs font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
            ₱{Number(tierData.total_spent).toFixed(2)}
          </p>
        </div>
      </div>

      {/* Progress to Next Tier */}
      {tierData.next_tier_info?.next_tier && (
        <div>
          <div className="flex justify-between text-[10px] font-semibold mb-1">
            <span className={isDarkMode ? 'text-slate-400' : 'text-slate-500'}>
              <TrendingUp size={10} className="inline mr-1" />
              Progress to {tierData.next_tier_info.next_tier}
            </span>
            <span className="text-cyan-600">
              ₱{Number(tierData.next_tier_info.remaining_to_next).toFixed(2)} to go
            </span>
          </div>
          <div
            className={`w-full ${
              isDarkMode ? 'bg-slate-600' : 'bg-slate-200'
            } rounded-full h-2 overflow-hidden`}
          >
            <div
              className="h-full bg-gradient-to-r from-cyan-500 to-blue-600 transition-all duration-500"
              style={{ width: `${tierData.next_tier_info.progress_percent}%` }}
            />
          </div>
        </div>
      )}

      {/* Points & Free Items */}
      <div className="grid grid-cols-2 gap-2">
        <div className={`rounded-lg p-2 ${isDarkMode ? 'bg-slate-700' : 'bg-white'}`}>
          <p className="text-[9px] uppercase font-semibold text-slate-500">Points</p>
          <p className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
            {Number(tierData.loyalty_points).toFixed(0)}
          </p>
        </div>
        <div className={`rounded-lg p-2 ${isDarkMode ? 'bg-slate-700' : 'bg-white'}`}>
          <p className="text-[9px] uppercase font-semibold text-slate-500">Free Items</p>
          <p className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
            {tierData.free_items_available}
          </p>
        </div>
      </div>

      {/* Available Rewards */}
      {rewards.length > 0 && (
        <div>
          <p
            className={`text-[10px] font-bold uppercase mb-2 flex items-center gap-1 ${
              isDarkMode ? 'text-cyan-400' : 'text-cyan-700'
            }`}
          >
            <Gift size={12} /> Available Rewards ({rewards.length})
          </p>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {rewards.map((reward) => (
              <label
                key={reward.id}
                className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-all ${
                  selectedRewards.includes(reward.id)
                    ? 'bg-emerald-100 border border-emerald-300'
                    : isDarkMode
                    ? 'bg-slate-700 hover:bg-slate-600'
                    : 'bg-white hover:bg-slate-50'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedRewards.includes(reward.id)}
                  onChange={() => toggleReward(reward.id)}
                  className="w-3 h-3 cursor-pointer"
                />
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-[10px] font-bold truncate ${
                      isDarkMode ? 'text-white' : 'text-slate-800'
                    }`}
                  >
                    {reward.title}
                  </p>
                  <p className="text-[9px] text-slate-500 truncate">{reward.description}</p>
                </div>
                {reward.discount_percent > 0 && (
                  <span className="text-[9px] font-bold text-emerald-600">
                    -{Number(reward.discount_percent).toFixed(0)}%
                  </span>
                )}
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Summary of applied discounts */}
      {selectedRewards.length > 0 && (
        <div
          className={`text-[10px] font-semibold rounded-lg p-2 ${
            isDarkMode
              ? 'bg-emerald-900/30 text-emerald-300'
              : 'bg-emerald-50 text-emerald-700'
          }`}
        >
          <Sparkles size={10} className="inline mr-1" />
          {selectedRewards.length} reward(s) selected
          {totalRewardDiscount > 0 && ` (Total: -${totalRewardDiscount}%)`}
        </div>
      )}
    </div>
  );
}