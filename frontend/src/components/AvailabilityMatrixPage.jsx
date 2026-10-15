import React, { useState, useEffect, useCallback } from 'react';
import { Layers, Building2 } from 'lucide-react';
import AvailabilityMatrix from './AvailabilityMatrix';
import { api } from '../utils/api';

const records = (r) => r.data.results || r.data;

export default function AvailabilityMatrixPage({ isDarkMode = false, activeBusinessName, activeBusiness, isCompanyWide = false }) {
  const [matrixData, setMatrixData] = useState({ items: [], businesses: [] });
  const [businessItems, setBusinessItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadMatrix = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [matrixRes, biRes] = await Promise.all([
        api.get('/catalog/availability-matrix/'),
        api.get('/catalog/business-items/'),
      ]);
      setMatrixData(matrixRes.data);
      setBusinessItems(records(biRes));
    } catch {
      setError('Failed to load availability matrix.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadMatrix(); }, [loadMatrix]);

  const handleUpdate = useCallback(async (itemId, businessId, isAvailable, priceOverride) => {
    const existing = businessItems.find(bi => bi.item === itemId && bi.business === businessId);
    try {
      if (existing) {
        const patch = { is_available: isAvailable };
        if (priceOverride !== undefined) patch.price_override = priceOverride;
        await api.patch(`/catalog/business-items/${existing.id}/`, patch);
      } else {
        await api.post('/catalog/business-items/', {
          item: itemId,
          business: businessId,
          is_available: isAvailable,
          price_override: priceOverride ?? null,
        });
      }
      const biRes = await api.get('/catalog/business-items/');
      setBusinessItems(records(biRes));
    } catch (err) {
      console.error('Failed to update business item:', err);
    }
  }, [businessItems]);

  const handleBulkUpdate = useCallback(async (updates) => {
    const byBusiness = {};
    for (const u of updates) {
      if (!byBusiness[u.businessId]) byBusiness[u.businessId] = [];
      byBusiness[u.businessId].push({
        item_id: u.itemId,
        is_available: u.isAvailable,
        price_override: u.priceOverride ?? null,
      });
    }
    try {
      await Promise.all(
        Object.entries(byBusiness).map(([bid, items]) =>
          api.post('/catalog/business-items/batch/', { business_id: Number(bid), items })
        )
      );
      const biRes = await api.get('/catalog/business-items/');
      setBusinessItems(records(biRes));
    } catch (err) {
      console.error('Failed to bulk update:', err);
    }
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {activeBusinessName && (
        <div className={`flex items-center justify-between gap-2 text-xs px-3 py-2 rounded-lg ${isDarkMode ? "bg-slate-700 text-slate-300" : "bg-purple-50 text-purple-800"}`}>
          <div className="flex items-center gap-2">
            <Building2 size={13} className="text-purple-600 shrink-0" />
            <span>Showing data for <strong>{activeBusinessName}</strong></span>
          </div>
          {isCompanyWide && (
            <span className="text-[10px] font-bold text-purple-500 uppercase tracking-wide">Company-wide view</span>
          )}
        </div>
      )}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-600">Catalog Management</p>
        <h3 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
          Availability Matrix
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          Toggle catalog item availability and set per-business price overrides.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">
          {error}
        </div>
      )}

      <div className={`${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-purple-200'} border rounded-2xl p-5 shadow-sm`}>
        <div className="flex items-center gap-2 mb-5">
          <Layers size={18} className="text-cyan-600" />
          <h4 className="font-bold text-sm">Item x Business Matrix</h4>
          <span className={`ml-auto text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            {matrixData.items.length} items / {matrixData.businesses.length} businesses
          </span>
        </div>
        <AvailabilityMatrix
          items={matrixData.items}
          businesses={matrixData.businesses}
          businessItems={businessItems}
          onUpdate={handleUpdate}
          onBulkUpdate={handleBulkUpdate}
          isDarkMode={isDarkMode}
        />
      </div>
    </div>
  );
}
