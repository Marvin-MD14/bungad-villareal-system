import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { CreditCard, Plus, Receipt, Trash2 } from 'lucide-react';
import { applyBusinessHeader, newIdempotencyKey } from '../utils/session';

const API_BASE_URL = 'http://127.0.0.1:8000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');
  if (token) config.headers.Authorization = `Token ${token}`;
  return applyBusinessHeader(config);
});

const records = (response) => response.data.results || response.data;

export default function SalesPage({ isDarkMode = false, readOnly = false }) {
  const [branches, setBranches] = useState([]);
  const [products, setProducts] = useState([]);
  const [services, setServices] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [cart, setCart] = useState([]);
  const [catalogType, setCatalogType] = useState('PRODUCT');
  const [catalogId, setCatalogId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [branchId, setBranchId] = useState('');
  // One idempotency key per unsold cart; cleared once a sale is recorded.
  const saleKeyRef = useRef('');
  const [customerId, setCustomerId] = useState('');
  const [discount, setDiscount] = useState('0');
  const [amountPaid, setAmountPaid] = useState('0');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [branchResponse, productResponse, serviceResponse, customerResponse, transactionResponse] = await Promise.all([
        api.get('/branches/'),
        api.get('/products/'),
        api.get('/vss-services/'),
        api.get('/clients/'),
        api.get('/transactions/today/'),
      ]);
      const branchRecords = records(branchResponse);
      setBranches(branchRecords);
      setProducts(records(productResponse));
      setServices(records(serviceResponse));
      setCustomers(records(customerResponse));
      setTransactions(records(transactionResponse));
      if (!branchId && branchRecords[0]) setBranchId(String(branchRecords[0].id));
    } catch (error) {
      setMessage(error.response?.data?.detail || 'Unable to load sales data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const selectedCatalogItem = catalogType === 'PRODUCT'
    ? products.find((item) => String(item.id) === catalogId)
    : services.find((item) => String(item.id) === catalogId);

  const addToCart = () => {
    if (!selectedCatalogItem) return;
    const price = Number(catalogType === 'PRODUCT' ? selectedCatalogItem.selling_price : selectedCatalogItem.price);
    const description = catalogType === 'PRODUCT' ? selectedCatalogItem.name : selectedCatalogItem.description;
    const existing = cart.find((item) => item.item_type === catalogType && item.catalogId === catalogId);
    if (existing) {
      setCart(cart.map((item) => item === existing ? { ...item, quantity: item.quantity + Number(quantity) } : item));
    } else {
      setCart([...cart, {
        item_type: catalogType,
        catalogId,
        product: catalogType === 'PRODUCT' ? Number(catalogId) : undefined,
        service: catalogType === 'SERVICE' ? Number(catalogId) : undefined,
        description,
        price,
        quantity: Number(quantity),
      }]);
    }
    setCatalogId('');
    setQuantity(1);
  };

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const total = Math.max(0, subtotal - Number(discount || 0));

  const completeSale = async (event) => {
    event.preventDefault();
    setMessage('');
    if (!branchId || cart.length === 0) {
      setMessage('Select a branch and add at least one item.');
      return;
    }
    if (Number(amountPaid) < total) {
      setMessage('Amount paid must cover the transaction total.');
      return;
    }

    setSubmitting(true);
    // Reuse the key on retry so a timed-out submission replays instead of double-recording.
    if (!saleKeyRef.current) saleKeyRef.current = newIdempotencyKey();
    try {
      await api.post('/transactions/checkout/', {
        branch: Number(branchId),
        customer: customerId ? Number(customerId) : null,
        discount: Number(discount || 0),
        amount_paid: Number(amountPaid || 0),
        items: cart.map((item) => ({
          item_type: item.item_type,
          product: item.product,
          service: item.service,
          quantity: item.quantity,
        })),
      }, {
        headers: { 'Idempotency-Key': saleKeyRef.current },
      });
      saleKeyRef.current = '';
      setCart([]);
      setDiscount('0');
      setAmountPaid('0');
      setCustomerId('');
      setMessage('Sale completed successfully.');
      await loadData();
    } catch (error) {
      setMessage(error.response?.data?.detail || 'Sale could not be completed.');
    } finally {
      setSubmitting(false);
    }
  };

  const panel = isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200';
  const input = isDarkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200 text-slate-700';

  if (loading) return <div className="p-8 text-sm text-slate-500">Loading sales workspace...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Sales & POS</h3>
          <p className="text-xs text-slate-500">Create paid transactions and update branch stock safely.</p>
        </div>
        <Receipt className="text-cyan-600" size={24} />
      </div>

      {message && <div className="rounded-lg border border-cyan-200 bg-cyan-50 px-4 py-3 text-xs text-cyan-700">{message}</div>}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {!readOnly && <form onSubmit={completeSale} className={`${panel} border rounded-xl p-5 space-y-4 xl:col-span-2`}>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <label className="text-xs font-semibold text-slate-500">Branch
              <select required value={branchId} onChange={(event) => setBranchId(event.target.value)} className={`${input} mt-1 w-full rounded-lg border p-2`}>
                <option value="">Select branch</option>
                {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
              </select>
            </label>
            <label className="text-xs font-semibold text-slate-500 md:col-span-2">Customer (optional)
              <select value={customerId} onChange={(event) => setCustomerId(event.target.value)} className={`${input} mt-1 w-full rounded-lg border p-2`}>
                <option value="">Walk-in customer</option>
                {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.full_name}</option>)}
              </select>
            </label>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <select value={catalogType} onChange={(event) => { setCatalogType(event.target.value); setCatalogId(''); }} className={`${input} rounded-lg border p-2 text-sm`}>
              <option value="PRODUCT">Product</option>
              <option value="SERVICE">Service</option>
            </select>
            <select value={catalogId} onChange={(event) => setCatalogId(event.target.value)} className={`${input} rounded-lg border p-2 text-sm md:col-span-2`}>
              <option value="">Select {catalogType.toLowerCase()}</option>
              {(catalogType === 'PRODUCT' ? products : services).map((item) => (
                <option key={item.id} value={item.id}>{catalogType === 'PRODUCT' ? item.name : item.description}</option>
              ))}
            </select>
            <div className="flex gap-2">
              <input min="1" type="number" value={quantity} onChange={(event) => setQuantity(event.target.value)} className={`${input} w-full rounded-lg border p-2 text-sm`} />
              <button type="button" onClick={addToCart} className="rounded-lg bg-cyan-600 px-3 text-white" title="Add item"><Plus size={16} /></button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-left text-xs"><thead className="bg-slate-50"><tr><th className="p-3">Item</th><th className="p-3">Qty</th><th className="p-3">Price</th><th className="p-3">Total</th><th /></tr></thead>
              <tbody>{cart.map((item) => <tr key={`${item.item_type}-${item.catalogId}`} className="border-t"><td className="p-3">{item.description}</td><td className="p-3">{item.quantity}</td><td className="p-3">₱{item.price.toFixed(2)}</td><td className="p-3">₱{(item.price * item.quantity).toFixed(2)}</td><td className="p-3"><button type="button" onClick={() => setCart(cart.filter((cartItem) => cartItem !== item))} className="text-red-500"><Trash2 size={14} /></button></td></tr>)}</tbody>
            </table>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <label className="text-xs font-semibold text-slate-500">Discount<input type="number" min="0" value={discount} onChange={(event) => setDiscount(event.target.value)} className={`${input} mt-1 w-full rounded-lg border p-2`} /></label>
            <label className="text-xs font-semibold text-slate-500">Amount paid<input required type="number" min="0" value={amountPaid} onChange={(event) => setAmountPaid(event.target.value)} className={`${input} mt-1 w-full rounded-lg border p-2`} /></label>
            <div className="rounded-lg bg-cyan-50 p-3 text-right"><span className="block text-xs text-cyan-700">Total</span><strong className="text-xl text-cyan-800">₱{total.toFixed(2)}</strong></div>
          </div>
          <button disabled={submitting} className="flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-600 py-3 text-sm font-semibold text-white disabled:opacity-50"><CreditCard size={16} />{submitting ? 'Processing...' : 'Complete Sale'}</button>
        </form>}

        <section className={`${panel} border rounded-xl p-5 ${readOnly ? 'xl:col-span-3' : ''}`}>
          <h4 className={`mb-3 font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Today&apos;s Transactions</h4>
          <div className="space-y-2">{transactions.length === 0 && <p className="text-xs text-slate-500">No sales recorded today.</p>}{transactions.slice(0, 8).map((transaction) => <div key={transaction.id} className="rounded-lg border border-slate-200 p-3 text-xs"><div className="flex justify-between font-semibold"><span>{transaction.transaction_number}</span><span>₱{Number(transaction.total).toFixed(2)}</span></div><p className="mt-1 text-slate-500">{transaction.customer_name || 'Walk-in customer'}</p></div>)}</div>
        </section>
      </div>
    </div>
  );
}
