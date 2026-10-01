import { useEffect, useState, useRef, useMemo } from 'react';
import Swal from 'sweetalert2';
import {
  Search, Plus, Minus, Trash2, CreditCard, X,
  Scissors, Sparkles, ShoppingBag, Clock, Package,
  Printer, Loader2, AlertCircle, User,
  ChevronDown, ChevronRight, Tag, UserPlus,
  Mail, Phone, MapPin, Calendar, Gift, Star
} from 'lucide-react';
import CustomerRewardsPanel from './CustomerRewardsPanel';
import CustomerTierBadge from './CustomerTierBadge';
import { newIdempotencyKey } from '../utils/session';
import { api } from '../utils/api';

const records = (response) => response.data.results || response.data;


// ============ CUSTOMER INFO MODAL COMPONENT ============
// ✅ NASA LABAS ito ng CashierPOS para hindi ma-recreate ang component
function CustomerInfoModal({ isOpen, onClose, onSubmit, isDarkMode }) {
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    age: '',
    address: '',
    phone_number: '',
    email: '',
    gender: 'Female',
  });
  const [saving, setSaving] = useState(false);

  // ✅ FIX: `isOpen` lang ang dependency — hindi `initialData`
  // Reset lang ang form kapag nag-open ang modal (false -> true)
  useEffect(() => {
    if (isOpen) {
      setForm({
        first_name: '',
        last_name: '',
        age: '',
        address: '',
        phone_number: '',
        email: '',
        gender: 'Female',
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const panel = isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200';
  const input = isDarkMode
    ? 'bg-slate-700 border-slate-600 text-white placeholder:text-slate-400'
    : 'bg-white border-slate-200 text-slate-700';

  // ✅ Handle change na may functional update para hindi mag-reset
  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.first_name.trim()) {
      Swal.fire({ icon: 'warning', title: 'First name is required' });
      return;
    }
    setSaving(true);
    await onSubmit(form);
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div className={`${panel} border rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto shadow-2xl`}>
        {/* Header */}
        <div className={`sticky top-0 ${panel} border-b p-4 flex justify-between items-center z-10`}>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center">
              <UserPlus size={18} className="text-white" />
            </div>
            <div>
              <h3 className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                Customer Information
              </h3>
              <p className="text-[10px] text-slate-500">
                Fill up para sa loyalty tracking at rewards
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`p-1.5 rounded-lg ${isDarkMode ? 'hover:bg-slate-700' : 'hover:bg-slate-100'}`}
          >
            <X size={16} className={isDarkMode ? 'text-slate-400' : 'text-slate-500'} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          {/* Name Row */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={`block text-[10px] font-bold uppercase mb-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                First Name *
              </label>
              <input
                type="text"
                value={form.first_name}
                onChange={(e) => handleChange('first_name', e.target.value)}
                placeholder="Juan"
                autoFocus
                autoComplete="off"
                className={`${input} w-full rounded-lg border p-2 text-xs outline-none focus:border-cyan-500`}
              />
            </div>
            <div>
              <label className={`block text-[10px] font-bold uppercase mb-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                Last Name
              </label>
              <input
                type="text"
                value={form.last_name}
                onChange={(e) => handleChange('last_name', e.target.value)}
                placeholder="Dela Cruz"
                autoComplete="off"
                className={`${input} w-full rounded-lg border p-2 text-xs outline-none focus:border-cyan-500`}
              />
            </div>
          </div>

          {/* Age & Gender */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={`block text-[10px] font-bold uppercase mb-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                <Calendar size={10} className="inline mr-1" />
                Age
              </label>
              <input
                type="number"
                min="1"
                max="120"
                value={form.age}
                onChange={(e) => handleChange('age', e.target.value)}
                placeholder="25"
                autoComplete="off"
                className={`${input} w-full rounded-lg border p-2 text-xs outline-none focus:border-cyan-500`}
              />
            </div>
            <div>
              <label className={`block text-[10px] font-bold uppercase mb-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                Gender
              </label>
              <select
                value={form.gender}
                onChange={(e) => handleChange('gender', e.target.value)}
                className={`${input} w-full rounded-lg border p-2 text-xs font-semibold outline-none focus:border-cyan-500`}
              >
                <option value="Female">Female</option>
                <option value="Male">Male</option>
              </select>
            </div>
          </div>

          {/* Address */}
          <div>
            <label className={`block text-[10px] font-bold uppercase mb-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              <MapPin size={10} className="inline mr-1" />
              Taga Saan (Address)
            </label>
            <input
              type="text"
              value={form.address}
              onChange={(e) => handleChange('address', e.target.value)}
              placeholder="Brgy. San Isidro, Virac, Catanduanes"
              autoComplete="off"
              className={`${input} w-full rounded-lg border p-2 text-xs outline-none focus:border-cyan-500`}
            />
          </div>

          {/* Phone */}
          <div>
            <label className={`block text-[10px] font-bold uppercase mb-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              <Phone size={10} className="inline mr-1" />
              Contact Number
            </label>
            <input
              type="text"
              value={form.phone_number}
              onChange={(e) => handleChange('phone_number', e.target.value)}
              placeholder="0912 345 6789"
              autoComplete="off"
              className={`${input} w-full rounded-lg border p-2 text-xs outline-none focus:border-cyan-500`}
            />
          </div>

          {/* Email */}
          <div>
            <label className={`block text-[10px] font-bold uppercase mb-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              <Mail size={10} className="inline mr-1" />
              Email (Optional)
            </label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => handleChange('email', e.target.value)}
              placeholder="juan@email.com"
              autoComplete="off"
              className={`${input} w-full rounded-lg border p-2 text-xs outline-none focus:border-cyan-500`}
            />
          </div>

          {/* Info Note */}
          <div className={`rounded-lg p-2 ${isDarkMode ? 'bg-cyan-900/30 border border-cyan-700/50' : 'bg-cyan-50 border border-cyan-200'}`}>
            <p className={`text-[10px] ${isDarkMode ? 'text-cyan-300' : 'text-cyan-700'}`}>
              <Star size={10} className="inline mr-1" />
              Ang customer info na ito ay gagamitin para sa loyalty rewards. Kapag bumalik ang customer, madedetect agad ang kanyang tier at discounts!
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold border ${input}`}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
              {saving ? 'Saving...' : 'Save & Continue'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


// ============ REWARD NOTIFICATION MODAL ============
// ✅ NASA LABAS din ito ng CashierPOS
function RewardNotificationModal({ isOpen, onClose, customer, rewards, isDarkMode }) {
  if (!isOpen || !customer) return null;

  const panel = isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200';

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div className={`${panel} border rounded-2xl max-w-sm w-full shadow-2xl`}>
        <div className="p-5 text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center mx-auto mb-3 shadow-lg shadow-amber-500/30">
            <Gift size={32} className="text-white" />
          </div>
          <h3 className={`text-base font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
            🎉 Welcome Back!
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            {customer.full_name}
          </p>

          <div className="mt-3 flex items-center justify-center gap-2">
            <CustomerTierBadge tier={customer.loyalty_tier || 'BRONZE'} size="md" />
          </div>

          {rewards && rewards.length > 0 && (
            <div className={`mt-4 rounded-lg p-3 ${isDarkMode ? 'bg-amber-900/20 border border-amber-700/50' : 'bg-amber-50 border border-amber-200'}`}>
              <p className={`text-[11px] font-bold ${isDarkMode ? 'text-amber-300' : 'text-amber-700'}`}>
                🎁 May {rewards.length} reward(s) ka!
              </p>
              <p className={`text-[10px] mt-1 ${isDarkMode ? 'text-amber-400' : 'text-amber-600'}`}>
                Automatic na ia-apply ang discount sa checkout.
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={onClose}
            className="w-full mt-4 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white text-xs font-bold rounded-xl"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}


// ============ MAIN POS COMPONENT ============
export default function CashierPOS({ isDarkMode = false }) {
  // ============ STATE ============
  const [branch, setBranch] = useState(null);
  const [catalog, setCatalog] = useState({ vss_services: [], vreal_products: [], bb_products: [] });
  const [activeTab, setActiveTab] = useState('VSS');
  const [cart, setCart] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [customerId, setCustomerId] = useState('');
  const [customers, setCustomers] = useState([]);
  const [walkinName, setWalkinName] = useState('');
  const [selectedRewards, setSelectedRewards] = useState([]);
  const [tierDiscountRate, setTierDiscountRate] = useState(0);
  const [discount, setDiscount] = useState('0');
  const [amountPaid, setAmountPaid] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [lastReceipt, setLastReceipt] = useState(null);
  const [heldTransactions, setHeldTransactions] = useState([]);
  const [currentDateTime, setCurrentDateTime] = useState(new Date());
  const [expandedCategories, setExpandedCategories] = useState({});
  const searchRef = useRef(null);
  // One idempotency key per unsold cart; cleared once a sale is recorded.
  const saleKeyRef = useRef('');

  // Customer Info Modal States
  const [showCustomerInfoModal, setShowCustomerInfoModal] = useState(false);
  // (was `pendingCustomerData` — written on save/close but never read; the
  //  selected customer is carried by `customerId`.)
  const [showRewardNotification, setShowRewardNotification] = useState(false);
  const [notifiedCustomer, setNotifiedCustomer] = useState(null);
  const [notifiedRewards, setNotifiedRewards] = useState([]);

  // ============ LIVE CLOCK ============
  useEffect(() => {
    const timer = setInterval(() => setCurrentDateTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // ============ LOAD BRANCH & CATALOG ============
  useEffect(() => {
    const load = async () => {
      try {
        const authUser = JSON.parse(localStorage.getItem('authUser') || '{}');
        const branchId = authUser?.branch?.id;

        if (!branchId) {
          Swal.fire({
            icon: 'error',
            title: 'No Branch Assigned',
            text: 'Your account is not assigned to any branch. Contact your administrator.',
          });
          setLoading(false);
          return;
        }

        const catalogRes = await api.get(`/branch-catalog/by-branch/${branchId}/`);
        setBranch({
          id: catalogRes.data.branch_id,
          name: catalogRes.data.branch_name,
          type: catalogRes.data.branch_type,
          typeDisplay: catalogRes.data.branch_type_display,
        });
        setCatalog({
          vss_services: catalogRes.data.vss_services || [],
          vreal_products: catalogRes.data.vreal_products || [],
          bb_products: catalogRes.data.bb_products || [],
        });

        const type = catalogRes.data.branch_type;
        if (type === 'VSS') setActiveTab('VSS');
        else if (type === 'VREAL') setActiveTab('VREAL');
        else if (type === 'BB') setActiveTab('BB');
        else if (type === 'MIXED') setActiveTab('VSS');

        try {
          const custRes = await api.get('/clients/');
          setCustomers(records(custRes));
        } catch (e) {
          console.warn('Could not load customers:', e);
        }
      } catch (error) {
        console.error(error);
        Swal.fire({
          icon: 'error',
          title: 'Load Error',
          text: error.response?.data?.detail || 'Unable to load POS data.',
        });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // ============ KEYBOARD SHORTCUTS (FIXED WITH DEPENDENCY ARRAY) ============
  // The listener is registered once and reads the *current* `completeSale`
  // through a ref. Calling it directly meant the handler closed over whichever
  // render happened when the effect ran, so the sale it ran against could be
  // stale (and ESLint rightly flags calling a later `const` before it exists).
  const completeSaleRef = useRef(null);
  useEffect(() => {
    const handleKey = (e) => {
      // ✅ Huwag i-trigger ang shortcuts kapag bukas ang modal
      if (showCustomerInfoModal || showRewardNotification || showReceipt) return;

      if (e.key === 'F2') { e.preventDefault(); searchRef.current?.focus(); }
      if (e.key === 'F4') {
        e.preventDefault();
        if (cart.length > 0) completeSaleRef.current?.();
      }
      if (e.key === 'Escape') {
        setSearch('');
        setSelectedCategory('ALL');
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [cart.length, showCustomerInfoModal, showRewardNotification, showReceipt]);

  // ============ COMPUTED VALUES ============
  const currentItems = useMemo(() => {
    if (activeTab === 'VSS') return catalog.vss_services;
    if (activeTab === 'VREAL') return catalog.vreal_products;
    if (activeTab === 'BB') return catalog.bb_products;
    return [];
  }, [activeTab, catalog]);

  const groupedByCategory = useMemo(() => {
    const groups = {};
    currentItems.forEach((item) => {
      const cat = item.category_display || item.category || 'Uncategorized';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(item);
    });
    return groups;
  }, [currentItems]);

  const categories = useMemo(() => Object.keys(groupedByCategory).sort(), [groupedByCategory]);

  const filteredGroups = useMemo(() => {
    const q = search.toLowerCase().trim();
    const result = {};
    Object.entries(groupedByCategory).forEach(([cat, items]) => {
      if (selectedCategory !== 'ALL' && cat !== selectedCategory) return;
      const matched = items.filter((item) => {
        if (!q) return true;
        const name = (item.description || item.product || item.product_name || '').toLowerCase();
        const category = (item.category_display || item.category || '').toLowerCase();
        return name.includes(q) || category.includes(q);
      });
      if (matched.length > 0) result[cat] = matched;
    });
    return result;
  }, [groupedByCategory, search, selectedCategory]);

  const subtotal = useMemo(
    () => cart.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0),
    [cart]
  );

  const tierDiscountAmount = useMemo(
    () => (subtotal * Number(tierDiscountRate || 0)) / 100,
    [subtotal, tierDiscountRate]
  );

  const total = useMemo(
    () => Math.max(0, subtotal - Number(discount || 0) - tierDiscountAmount),
    [subtotal, discount, tierDiscountAmount]
  );

  const change = useMemo(
    () => Math.max(0, Number(amountPaid || 0) - total),
    [amountPaid, total]
  );

  const totalItems = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity, 0),
    [cart]
  );

  // ============ CART ACTIONS ============
  const addToCart = (item) => {
    const itemType = activeTab;
    const price = Number(item.price || 0);
    const description = item.description || item.product || item.product_name || 'Unknown';
    const catalogId = item.id;

    const existing = cart.find((c) => c.item_type === itemType && c.catalogId === catalogId);
    if (existing) {
      setCart(cart.map((c) => c === existing ? { ...c, quantity: c.quantity + 1 } : c));
    } else {
      setCart([...cart, { item_type: itemType, catalogId, description, price, quantity: 1 }]);
    }
  };

  const updateQuantity = (item, delta) => {
    const newQty = item.quantity + delta;
    if (newQty <= 0) setCart(cart.filter((c) => c !== item));
    else setCart(cart.map((c) => (c === item ? { ...c, quantity: newQty } : c)));
  };

  const removeFromCart = (item) => setCart(cart.filter((c) => c !== item));

  const clearCart = () => {
    if (cart.length === 0) return;
    Swal.fire({
      title: 'Clear cart?',
      text: 'All items will be removed.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      confirmButtonText: 'Yes, clear it',
    }).then((result) => {
      if (result.isConfirmed) {
        setCart([]); setDiscount('0'); setAmountPaid(''); setCustomerId('');
        setWalkinName(''); setSelectedRewards([]); setTierDiscountRate(0);
      }
    });
  };

  // ============ HOLD / RESUME ============
  const holdTransaction = () => {
    if (cart.length === 0) return;
    const held = {
      id: Date.now(),
      cart: [...cart],
      discount,
      amountPaid,
      customerId,
      walkinName,
      selectedRewards,
      tierDiscountRate,
      timestamp: new Date().toISOString(),
    };
    setHeldTransactions([...heldTransactions, held]);
    setCart([]); setDiscount('0'); setAmountPaid(''); setCustomerId('');
    setWalkinName(''); setSelectedRewards([]); setTierDiscountRate(0);
    Swal.fire({
      icon: 'success',
      title: 'Transaction Held',
      text: `Transaction #${held.id} is on hold.`,
      timer: 1500,
      showConfirmButton: false,
    });
  };

  const resumeTransaction = (held) => {
    setCart(held.cart);
    setDiscount(held.discount);
    setAmountPaid(held.amountPaid);
    setCustomerId(held.customerId);
    setWalkinName(held.walkinName || '');
    setSelectedRewards(held.selectedRewards || []);
    setTierDiscountRate(held.tierDiscountRate || 0);
    setHeldTransactions(heldTransactions.filter((h) => h.id !== held.id));
  };

  // ============ PAYMENT ============
  const addPayment = (amount) => {
    const current = Number(amountPaid || 0);
    setAmountPaid(String(current + amount));
  };

  const setExactPayment = () => setAmountPaid(String(total));
  const clearPayment = () => setAmountPaid('');

  // ============ CUSTOMER DETECTION & REWARDS ============
  const checkCustomerRewards = async (custId) => {
    try {
      const [tierRes, rewardsRes] = await Promise.all([
        api.get(`/customer-tier/by-customer/${custId}/`),
        api.get(`/customer-rewards/?customer_id=${custId}&status=AVAILABLE`),
      ]);
      const rewards = rewardsRes.data.results || rewardsRes.data;

      if (rewards.length > 0 || tierRes.data.discount_rate > 0) {
        setNotifiedCustomer({
          full_name: tierRes.data.customer_name,
          loyalty_tier: tierRes.data.loyalty_tier,
          discount_rate: tierRes.data.discount_rate,
          total_spent: tierRes.data.total_spent,
        });
        setNotifiedRewards(rewards);
        setShowRewardNotification(true);
      }
    } catch (error) {
      console.warn('Could not check rewards:', error);
    }
  };

  // ============ SAVE CUSTOMER INFO & CONTINUE SALE ============
  const handleSaveCustomerInfo = async (formData) => {
    try {
      const fullName = `${formData.first_name} ${formData.last_name}`.trim();

      const customerRes = await api.post('/clients/', {
        first_name: formData.first_name,
        last_name: formData.last_name || 'Walk-in',
        age: formData.age ? parseInt(formData.age) : null,
        address: formData.address || '',
        phone_number: formData.phone_number || '',
        email: formData.email || '',
        gender: formData.gender || 'Female',
        loyalty_tier: 'BRONZE',
      });

      const newCustomer = customerRes.data;

      setCustomers([...customers, newCustomer]);
      setCustomerId(String(newCustomer.id));
      setWalkinName('');

      setShowCustomerInfoModal(false);

      await checkCustomerRewards(newCustomer.id);
      await processSale(newCustomer.id, fullName);

    } catch (error) {
      console.error('Save customer error:', error);
      Swal.fire({
        icon: 'error',
        title: 'Save Failed',
        text: error.response?.data?.detail || 'Could not save customer info.',
      });
      throw error;
    }
  };

  // ============ PROCESS SALE ============
  const processSale = async (finalCustomerId, customerName) => {
    setSubmitting(true);
    // Reuse the key on retry: a submission that timed out may already be recorded,
    // and the backend replays a checkout carrying a key it has already seen.
    if (!saleKeyRef.current) saleKeyRef.current = newIdempotencyKey();
    try {
      const items = cart.map((item) => {
        if (item.item_type === 'VSS') {
          return { item_type: 'SERVICE', service: item.catalogId, quantity: item.quantity };
        } else {
          return { item_type: 'PRODUCT', product: item.catalogId, quantity: item.quantity };
        }
      });

      const res = await api.post('/transactions/checkout/', {
        branch: branch.id,
        customer: finalCustomerId || null,
        customer_name: customerName || '',
        discount: Number(discount || 0),
        amount_paid: Number(amountPaid || 0),
        reward_ids: selectedRewards,
        apply_tier_discount: true,
        items,
        notes: `Payment: ${paymentMethod}`,
      }, {
        headers: { 'Idempotency-Key': saleKeyRef.current },
      });

      setLastReceipt({
        transaction: res.data,
        branch,
        cashier: JSON.parse(localStorage.getItem('authUser') || '{}'),
        items: [...cart],
        subtotal,
        tierDiscount: tierDiscountAmount,
        discount: Number(discount || 0),
        total,
        amountPaid: Number(amountPaid || 0),
        change,
        paymentMethod,
        selectedRewards,
        customerName: customerName || res.data.customer_name || 'Walk-in Customer',
        timestamp: new Date().toISOString(),
      });

      setShowReceipt(true);
      saleKeyRef.current = '';

      setCart([]); setDiscount('0'); setAmountPaid(''); setCustomerId('');
      setWalkinName(''); setSelectedRewards([]); setTierDiscountRate(0);
      setPaymentMethod('CASH');

    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Sale Failed',
        text: error.response?.data?.detail || 'Unable to complete the sale.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  // ============ COMPLETE SALE ============
  const completeSale = async () => {
    if (cart.length === 0) {
      Swal.fire({ icon: 'warning', title: 'Empty Cart', text: 'Add items first.' });
      return;
    }
    if (Number(amountPaid) < total) {
      Swal.fire({
        icon: 'warning',
        title: 'Insufficient Payment',
        text: `Amount paid must be at least ₱${total.toFixed(2)}`,
      });
      return;
    }

    // Kung may selected customer na, diretso na sa sale
    if (customerId) {
      const customer = customers.find((c) => String(c.id) === String(customerId));
      await processSale(customerId, customer?.full_name || '');
      return;
    }

    // Ipakita ang Customer Info Modal para sa bagong customer o walk-in
    setShowCustomerInfoModal(true);
  };
  // Keep the F4 shortcut pointing at the newest `completeSale`. The ref is
  // written in an effect (never during render) so the ref write is not a side
  // effect of rendering; the handler then always calls current state.
  useEffect(() => {
    completeSaleRef.current = completeSale;
  });

  // ============ RENDER ============
  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="animate-spin text-cyan-600" size={40} />
      </div>
    );
  }

  if (!branch) {
    return (
      <div className="text-center py-16 text-slate-500">
        <AlertCircle size={48} className="mx-auto mb-3 text-red-400" />
        <p>No branch assigned to your account.</p>
      </div>
    );
  }

  const panel = isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200';
  const input = isDarkMode
    ? 'bg-slate-700 border-slate-600 text-white placeholder:text-slate-400'
    : 'bg-white border-slate-200 text-slate-700';

  const availableTabs = [];
  if (branch.type === 'VSS' || branch.type === 'MIXED')
    availableTabs.push({ id: 'VSS', label: 'VSS Services', icon: <Scissors size={16} /> });
  if (branch.type === 'VREAL' || branch.type === 'MIXED')
    availableTabs.push({ id: 'VREAL', label: 'VReal Products', icon: <Sparkles size={16} /> });
  if (branch.type === 'BB' || branch.type === 'MIXED')
    availableTabs.push({ id: 'BB', label: 'BB Products', icon: <ShoppingBag size={16} /> });

  const formattedDate = currentDateTime.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const formattedTime = currentDateTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });

  const toggleCategory = (cat) => {
    setExpandedCategories((prev) => ({ ...prev, [cat]: !prev[cat] }));
  };

  const selectedCustomer = customers.find((c) => String(c.id) === String(customerId));

  return (
    <div className="h-[calc(100vh-140px)] flex flex-col gap-4">
      {/* HEADER */}
      <div className={`${panel} border rounded-xl p-3 flex items-center justify-between`}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center">
            <CreditCard size={20} className="text-white" />
          </div>
          <div>
            <h2 className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{branch.name}</h2>
            <p className="text-xs text-cyan-600 font-semibold">{branch.typeDisplay}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className={`text-right font-mono text-xs px-3 py-1.5 rounded-lg border ${isDarkMode ? 'bg-slate-700 border-slate-600' : 'bg-slate-50 border-slate-200'}`}>
            <span className="text-slate-400 mr-1.5">{formattedDate}</span>
            <span className="text-cyan-600 font-semibold">{formattedTime}</span>
          </div>
          {heldTransactions.length > 0 && (
            <button
              onClick={() => {
                const held = heldTransactions[0];
                if (held) resumeTransaction(held);
              }}
              className="px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-lg flex items-center gap-1"
            >
              <Clock size={14} /> Resume ({heldTransactions.length})
            </button>
          )}
          <button
            onClick={holdTransaction}
            disabled={cart.length === 0}
            className="px-3 py-2 bg-slate-600 hover:bg-slate-700 text-white text-xs font-bold rounded-lg flex items-center gap-1 disabled:opacity-40"
          >
            <Clock size={14} /> Hold
          </button>
        </div>
      </div>

      {/* MAIN GRID: CATALOG + CART */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 overflow-hidden">
        {/* LEFT: CATALOG */}
        <div className={`${panel} border rounded-xl p-4 lg:col-span-2 flex flex-col overflow-hidden`}>
          <div className="flex gap-2 mb-3 border-b pb-2">
            {availableTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); setSearch(''); setSelectedCategory('ALL'); }}
                className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${
                  activeTab === tab.id
                    ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md'
                    : isDarkMode
                      ? 'text-slate-400 hover:bg-slate-700'
                      : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>

          <div className="flex flex-col md:flex-row gap-2 mb-3">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                ref={searchRef}
                type="text"
                placeholder="Search product or service... (F2)"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={`${input} w-full pl-9 pr-3 py-2 rounded-lg text-sm border outline-none focus:border-cyan-500`}
              />
            </div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className={`${input} rounded-lg border px-3 py-2 text-sm font-semibold min-w-[180px]`}
            >
              <option value="ALL">📂 All Categories</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div className="flex-1 overflow-y-auto pr-1">
            {Object.keys(filteredGroups).length === 0 ? (
              <div className="text-center py-16 text-slate-400">
                <Package size={48} className="mx-auto mb-3 opacity-30" />
                <p>No items found</p>
              </div>
            ) : (
              Object.entries(filteredGroups).map(([category, items]) => (
                <div key={category} className="mb-4">
                  <button
                    onClick={() => toggleCategory(category)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg mb-2 transition-all ${
                      isDarkMode
                        ? 'bg-slate-700/60 hover:bg-slate-700'
                        : 'bg-gradient-to-r from-cyan-50 to-blue-50 hover:from-cyan-100 hover:to-blue-100'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Tag size={14} className="text-cyan-600" />
                      <span className={`text-xs font-bold uppercase tracking-wide ${isDarkMode ? 'text-cyan-400' : 'text-cyan-700'}`}>
                        {category}
                      </span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${isDarkMode ? 'bg-slate-600 text-slate-300' : 'bg-white text-slate-500'}`}>
                        {items.length} items
                      </span>
                    </div>
                    {expandedCategories[category] === false ? (
                      <ChevronRight size={14} className="text-slate-400" />
                    ) : (
                      <ChevronDown size={14} className="text-slate-400" />
                    )}
                  </button>

                  {expandedCategories[category] !== false && (
                    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2">
                      {items.map((item) => {
                        const name = item.description || item.product || item.product_name || 'Unknown';
                        return (
                          <button
                            key={`${activeTab}-${item.id}`}
                            onClick={() => addToCart(item)}
                            className={`${panel} border rounded-xl p-3 text-left hover:border-cyan-500 hover:shadow-md transition-all group relative`}
                          >
                            <p className={`text-xs font-semibold ${isDarkMode ? 'text-white' : 'text-slate-800'} line-clamp-2 min-h-[2.5rem]`}>
                              {name}
                            </p>
                            <div className="flex items-center justify-between mt-2">
                              <span className="text-sm font-bold text-emerald-600">₱{Number(item.price).toFixed(2)}</span>
                              <span className="w-6 h-6 rounded-lg bg-cyan-600 group-hover:bg-cyan-700 flex items-center justify-center transition-all">
                                <Plus size={12} className="text-white" />
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* RIGHT: CART & PAYMENT */}
        <div className={`${panel} border rounded-xl p-4 flex flex-col overflow-hidden`}>
          {/* Customer Selector */}
          <div className="relative mb-2">
            <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 z-10" />
            <select
              value={customerId}
              onChange={(e) => {
                setCustomerId(e.target.value);
                if (e.target.value) {
                  setWalkinName('');
                  checkCustomerRewards(e.target.value);
                }
              }}
              className={`${input} w-full pl-8 pr-2 rounded-lg border p-2 text-xs`}
            >
              <option value="">👤 Walk-in Customer</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.full_name || `${c.first_name} ${c.last_name}`}
                  {c.loyalty_tier && c.loyalty_tier !== 'BRONZE' ? ` (${c.loyalty_tier})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Walk-in Name (for rewards tracking) */}
          {!customerId && (
            <div className="relative mb-3">
              <UserPlus size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 z-10" />
              <input
                type="text"
                placeholder="Customer name (optional, for rewards)"
                value={walkinName}
                onChange={(e) => setWalkinName(e.target.value)}
                className={`${input} w-full pl-8 pr-2 rounded-lg border p-2 text-xs`}
              />
            </div>
          )}

          {/* Customer Tier Badge (for registered customers) */}
          {selectedCustomer && (
            <div className="mb-3 flex items-center justify-between">
              <CustomerTierBadge tier={selectedCustomer.loyalty_tier || 'BRONZE'} size="md" />
              {selectedCustomer.total_spent > 0 && (
                <span className={`text-[10px] font-semibold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  Total Spent: ₱{Number(selectedCustomer.total_spent).toFixed(2)}
                </span>
              )}
            </div>
          )}

          {/* Customer Rewards Panel */}
          {customerId && (
            <CustomerRewardsPanel
              customerId={customerId}
              isDarkMode={isDarkMode}
              onRewardsChange={setSelectedRewards}
              onTierDiscountChange={setTierDiscountRate}
            />
          )}

          {/* Cart Items */}
          <div className="flex-1 overflow-y-auto mb-3">
            {cart.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <ShoppingBag size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-xs">Cart is empty</p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className={`grid grid-cols-12 gap-1 px-2 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wide ${
                  isDarkMode ? 'bg-slate-700/60 text-slate-400' : 'bg-slate-100 text-slate-500'
                }`}>
                  <div className="col-span-5">Item</div>
                  <div className="col-span-3 text-center">Qty</div>
                  <div className="col-span-2 text-right">Price</div>
                  <div className="col-span-2 text-right">Subtotal</div>
                </div>

                {cart.map((item, idx) => (
                  <div
                    key={idx}
                    className={`grid grid-cols-12 gap-1 items-center px-2 py-2 rounded-lg border ${
                      isDarkMode ? 'bg-slate-700/50 border-slate-600' : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="col-span-5 min-w-0">
                      <p className={`text-[11px] font-semibold truncate ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                        {item.description}
                      </p>
                    </div>
                    <div className="col-span-3 flex items-center justify-center gap-1">
                      <button
                        onClick={() => updateQuantity(item, -1)}
                        className="w-5 h-5 bg-slate-200 hover:bg-slate-300 rounded flex items-center justify-center"
                      >
                        <Minus size={9} />
                      </button>
                      <span className={`text-xs font-bold w-6 text-center ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(item, 1)}
                        className="w-5 h-5 bg-slate-200 hover:bg-slate-300 rounded flex items-center justify-center"
                      >
                        <Plus size={9} />
                      </button>
                    </div>
                    <div className={`col-span-2 text-right text-[10px] font-semibold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                      ₱{Number(item.price).toFixed(2)}
                    </div>
                    <div className="col-span-2 text-right flex items-center justify-end gap-1">
                      <span className="text-[11px] font-bold text-cyan-600">
                        ₱{(Number(item.price) * item.quantity).toFixed(2)}
                      </span>
                      <button
                        onClick={() => removeFromCart(item)}
                        className="w-5 h-5 bg-red-100 hover:bg-red-200 text-red-600 rounded flex items-center justify-center"
                      >
                        <Trash2 size={9} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Totals */}
          <div className={`border-t pt-3 space-y-2 ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
            <div className="flex justify-between text-[10px] text-slate-500">
              <span>Total Items</span>
              <span className="font-semibold">{totalItems}</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-500 uppercase tracking-wide">Subtotal</span>
              <span className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                ₱{subtotal.toFixed(2)}
              </span>
            </div>

            {tierDiscountRate > 0 && (
              <div className="flex justify-between items-center text-emerald-600">
                <span className="text-xs uppercase tracking-wide font-semibold">
                  Tier Discount ({tierDiscountRate}%)
                </span>
                <span className="text-sm font-bold">
                  -₱{tierDiscountAmount.toFixed(2)}
                </span>
              </div>
            )}

            <div className="flex justify-between items-center gap-2">
              <span className="text-xs text-slate-500 uppercase tracking-wide flex-1">Manual Discount</span>
              <div className="relative">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">₱</span>
                <input
                  type="number"
                  min="0"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                  className={`${input} w-28 rounded border py-1 pl-5 pr-2 text-xs text-right font-semibold`}
                />
              </div>
            </div>

            <div className={`rounded-xl p-3 ${
              isDarkMode
                ? 'bg-gradient-to-r from-cyan-900/40 to-blue-900/40 border border-cyan-700/50'
                : 'bg-gradient-to-r from-cyan-50 to-blue-50 border border-cyan-200'
            }`}>
              <div className="flex justify-between items-center">
                <span className={`text-xs font-bold uppercase tracking-wider ${isDarkMode ? 'text-cyan-300' : 'text-cyan-700'}`}>
                  Total Amount Due
                </span>
                <span className={`text-2xl font-bold ${isDarkMode ? 'text-cyan-400' : 'text-cyan-700'}`}>
                  ₱{total.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Payment Section */}
          <div className="mt-3 space-y-2">
            <div className="grid grid-cols-4 gap-1">
              {[20, 50, 100, 200].map((amt) => (
                <button
                  key={amt}
                  onClick={() => addPayment(amt)}
                  className={`py-2 rounded-lg text-xs font-bold border ${isDarkMode ? 'bg-slate-700 border-slate-600 text-white hover:bg-slate-600' : 'bg-white border-slate-200 hover:bg-slate-50'}`}
                >
                  ₱{amt}
                </button>
              ))}
              {[500, 1000].map((amt) => (
                <button
                  key={amt}
                  onClick={() => addPayment(amt)}
                  className={`col-span-2 py-2 rounded-lg text-xs font-bold border ${isDarkMode ? 'bg-slate-700 border-slate-600 text-white hover:bg-slate-600' : 'bg-white border-slate-200 hover:bg-slate-50'}`}
                >
                  ₱{amt}
                </button>
              ))}
              <button
                onClick={setExactPayment}
                className="col-span-2 py-2 rounded-lg text-xs font-bold bg-cyan-500 text-white hover:bg-cyan-600"
              >
                Exact
              </button>
              <button
                onClick={clearPayment}
                className="col-span-2 py-2 rounded-lg text-xs font-bold bg-red-500 text-white hover:bg-red-600"
              >
                Clear
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className={`rounded-lg p-2 border ${isDarkMode ? 'bg-slate-700/50 border-slate-600' : 'bg-slate-50 border-slate-200'}`}>
                <p className="text-[10px] text-slate-500 uppercase font-semibold mb-0.5">Cash Received</p>
                <p className={`text-base font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                  ₱{Number(amountPaid || 0).toFixed(2)}
                </p>
              </div>
              <div className={`rounded-lg p-2 border ${
                isDarkMode ? 'bg-emerald-900/30 border-emerald-700/50' : 'bg-emerald-50 border-emerald-200'
              }`}>
                <p className="text-[10px] text-emerald-600 uppercase font-semibold mb-0.5">Change</p>
                <p className="text-base font-bold text-emerald-600">
                  ₱{change.toFixed(2)}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-1">
              {['CASH', 'GCASH', 'CARD', 'FP'].map((method) => (
                <button
                  key={method}
                  onClick={() => setPaymentMethod(method)}
                  className={`py-1.5 rounded text-[10px] font-bold ${
                    paymentMethod === method
                      ? 'bg-blue-600 text-white'
                      : isDarkMode
                        ? 'bg-slate-700 text-slate-300'
                        : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {method}
                </button>
              ))}
            </div>

            <button
              onClick={completeSale}
              disabled={submitting || cart.length === 0}
              className="w-full py-3 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 disabled:opacity-40"
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <CreditCard size={16} />}
              {submitting ? 'Processing...' : `Complete Sale (F4) - ₱${total.toFixed(2)}`}
            </button>

            <button
              onClick={clearCart}
              disabled={cart.length === 0}
              className="w-full py-2 border border-red-300 text-red-600 font-bold text-xs rounded-xl hover:bg-red-50 disabled:opacity-40"
            >
              Clear Cart
            </button>
          </div>
        </div>
      </div>

      {/* CUSTOMER INFO MODAL */}
      <CustomerInfoModal
        isOpen={showCustomerInfoModal}
        onClose={() => {
          setShowCustomerInfoModal(false);
        }}
        onSubmit={handleSaveCustomerInfo}
        isDarkMode={isDarkMode}
      />

      {/* REWARD NOTIFICATION MODAL */}
      <RewardNotificationModal
        isOpen={showRewardNotification}
        onClose={() => {
          setShowRewardNotification(false);
          setNotifiedCustomer(null);
          setNotifiedRewards([]);
        }}
        customer={notifiedCustomer}
        rewards={notifiedRewards}
        isDarkMode={isDarkMode}
      />

      {/* RECEIPT MODAL */}
      {showReceipt && lastReceipt && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 font-mono text-sm text-slate-800">
              <div className="text-center border-b-2 border-dashed pb-3 mb-3">
                <h1 className="text-xl font-bold">BUNGAD VILLAREAL</h1>
                <p className="text-xs">{lastReceipt.branch.name}</p>
                <p className="text-xs">{lastReceipt.branch.typeDisplay}</p>
                <p className="text-xs mt-1">Thank you! Please come again!</p>
              </div>

              <div className="text-xs mb-3">
                <div className="flex justify-between">
                  <span>Transaction #:</span>
                  <span className="font-bold">{lastReceipt.transaction.transaction_number}</span>
                </div>
                <div className="flex justify-between">
                  <span>Date:</span>
                  <span>{new Date(lastReceipt.timestamp).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Cashier:</span>
                  <span>{lastReceipt.cashier.username}</span>
                </div>
                <div className="flex justify-between">
                  <span>Customer:</span>
                  <span className="font-bold">{lastReceipt.customerName || 'Walk-in Customer'}</span>
                </div>
                {lastReceipt.transaction.customer_tier_at_purchase && (
                  <div className="flex justify-between">
                    <span>Tier:</span>
                    <span className="font-bold">{lastReceipt.transaction.customer_tier_at_purchase}</span>
                  </div>
                )}
              </div>

              <div className="border-t border-b border-dashed py-2 mb-3">
                {lastReceipt.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-xs mb-1">
                    <span className="flex-1">{item.quantity}× {item.description}</span>
                    <span className="font-bold">₱{(Number(item.price) * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>

              <div className="text-xs space-y-1">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>₱{lastReceipt.subtotal.toFixed(2)}</span>
                </div>
                {lastReceipt.tierDiscount > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span>Tier Discount:</span>
                    <span>-₱{lastReceipt.tierDiscount.toFixed(2)}</span>
                  </div>
                )}
                {lastReceipt.discount > 0 && (
                  <div className="flex justify-between">
                    <span>Discount:</span>
                    <span>-₱{lastReceipt.discount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-base border-t pt-1">
                  <span>TOTAL:</span>
                  <span>₱{lastReceipt.total.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Cash:</span>
                  <span>₱{lastReceipt.amountPaid.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Change:</span>
                  <span>₱{lastReceipt.change.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Payment:</span>
                  <span>{lastReceipt.paymentMethod}</span>
                </div>
              </div>

              {lastReceipt.transaction.points_earned > 0 && (
                <div className="mt-3 pt-3 border-t border-dashed text-center">
                  <p className="text-xs font-bold text-emerald-600">
                    ⭐ You earned {Number(lastReceipt.transaction.points_earned).toFixed(0)} points!
                  </p>
                </div>
              )}

              <div className="text-center mt-4 pt-3 border-t border-dashed">
                <p className="text-xs">*** Thank you! ***</p>
                <p className="text-[10px] mt-1">This serves as an official receipt.</p>
              </div>

              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => window.print()}
                  className="flex-1 py-2 bg-slate-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-2"
                >
                  <Printer size={14} /> Print
                </button>
                <button
                  onClick={() => setShowReceipt(false)}
                  className="flex-1 py-2 bg-cyan-600 text-white rounded-lg text-xs font-bold"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
