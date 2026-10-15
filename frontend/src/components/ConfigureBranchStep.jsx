import React, { useState, useEffect } from 'react';
import { MapPin, Phone, Mail } from 'lucide-react';
import { api } from '../utils/api';

export default function ConfigureBranchStep({
  businessId,
  branchId,
  initialData = {},
  onComplete,
  onSkip,
  isDarkMode = false,
}) {
  const [form, setForm] = useState({
    name: initialData.name || 'Main',
    address: initialData.address || '',
    contact_number: initialData.contact_number || '',
    email: initialData.email || '',
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (branchId) {
      const loadBranch = async () => {
        setLoading(true);
        try {
          const response = await api.get('/branches/' + branchId + '/');
          const branch = response.data;
          setForm({
            name: branch.name || 'Main',
            address: branch.address || '',
            contact_number: branch.contact_number || '',
            email: branch.email || '',
          });
        } catch (error) {
          console.error('Failed to load branch:', error);
        } finally {
          setLoading(false);
        }
      };
      loadBranch();
    }
  }, [branchId]);

  const handleComplete = () => {
    onComplete(form);
  };

  const input = isDarkMode
    ? 'bg-slate-700 border-slate-600 text-white'
    : 'bg-white border-slate-200 text-slate-700';

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <MapPin className="mx-auto h-12 w-12 text-cyan-500 mb-3" />
        <h3 className="text-lg font-bold">Configure Branch</h3>
        <p className="text-sm text-slate-500 mt-1">
          Set up your default branch. You can skip this and configure later.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Branch Name</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className={"w-full rounded-lg border p-2 text-sm " + input}
            placeholder="Main"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Address</label>
          <textarea
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            className={"w-full rounded-lg border p-2 text-sm " + input}
            rows={2}
            placeholder="Branch address"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Phone</label>
            <input
              type="text"
              value={form.contact_number}
              onChange={(e) => setForm({ ...form, contact_number: e.target.value })}
              className={"w-full rounded-lg border p-2 text-sm " + input}
              placeholder="Contact number"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className={"w-full rounded-lg border p-2 text-sm " + input}
              placeholder="Branch email"
            />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-700">
        <button
          type="button"
          onClick={onSkip}
          className="px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-700"
        >
          Skip
        </button>
        <button
          type="button"
          onClick={handleComplete}
          className="px-6 py-2 bg-cyan-500 text-white text-sm font-semibold rounded-lg hover:bg-cyan-600 transition"
        >
          Complete Setup
        </button>
      </div>
    </div>
  );
}

