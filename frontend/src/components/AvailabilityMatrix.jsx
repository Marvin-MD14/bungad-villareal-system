import React, { useState, useMemo, useCallback } from 'react';
import MatrixControls from './MatrixControls';
import MatrixRow from './MatrixRow';

/**
 * AvailabilityMatrix Component
 * 
 * Renders a table with businesses as columns and items as rows.
 * Supports sticky header and first column, horizontal scroll,
 * and bulk operations on selected items.
 * 
 * Requirements: 5.1, 5.2, 5.3, 5.8
 * 
 * @param {Object[]} items - Array of catalog items
 * @param {Object[]} businesses - Array of businesses
 * @param {Object[]} businessItems - Array of BusinessItem associations
 * @param {Function} onUpdate - Callback for cell updates (itemId, businessId, isAvailable, priceOverride?)
 * @param {Function} onBulkUpdate - Callback for bulk operations (updates array)
 * @param {boolean} isDarkMode - Dark mode styling flag
 */
export default function AvailabilityMatrix({
  items = [],
  businesses = [],
  businessItems = [],
  onUpdate,
  onBulkUpdate,
  isDarkMode = false,
}) {
  // State for selected items (for bulk operations)
  const [selectedItems, setSelectedItems] = useState(new Set());

  // Filter state
  const [categoryFilter, setCategoryFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [businessFilter, setBusinessFilter] = useState('');

  // Extract unique categories from items
  const categories = useMemo(() => {
    const categoryMap = new Map();
    items.forEach(item => {
      if (item.category && !categoryMap.has(item.category.id)) {
        categoryMap.set(item.category.id, item.category);
      }
    });
    return Array.from(categoryMap.values());
  }, [items]);

  // Filter items based on category, search, and business filter
  const filteredItems = useMemo(() => {
    let result = [...items];

    // Category filter
    if (categoryFilter) {
      result = result.filter(item => 
        item.category && String(item.category.id) === String(categoryFilter)
      );
    }

    // Search filter (by name or SKU)
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(item =>
        item.name.toLowerCase().includes(term) ||
        (item.sku && item.sku.toLowerCase().includes(term))
      );
    }

    // Business filter - show only items that have BusinessItem for selected business
    if (businessFilter) {
      const itemIdsWithBusiness = new Set(
        businessItems
          .filter(bi => String(bi.business) === String(businessFilter))
          .map(bi => bi.item)
      );
      result = result.filter(item => itemIdsWithBusiness.has(item.id));
    }

    return result;
  }, [items, categoryFilter, searchTerm, businessFilter, businessItems]);

  // Filtered businesses based on business filter selection
  const displayBusinesses = useMemo(() => {
    if (businessFilter) {
      return businesses.filter(b => String(b.id) === String(businessFilter));
    }
    return businesses;
  }, [businesses, businessFilter]);

  // Toggle item selection for bulk operations
  const toggleItemSelection = useCallback((itemId) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  }, []);

  // Select/deselect all filtered items
  const toggleSelectAll = useCallback(() => {
    setSelectedItems(prev => {
      const allSelected = filteredItems.every(item => prev.has(item.id));
      if (allSelected) {
        // Deselect all
        return new Set();
      } else {
        // Select all filtered items
        return new Set(filteredItems.map(item => item.id));
      }
    });
  }, [filteredItems]);

  // Clear selection
  const clearSelection = useCallback(() => {
    setSelectedItems(new Set());
  }, []);

  // Handle bulk add operation
  const handleBulkAdd = useCallback(() => {
    if (selectedItems.size === 0 || !onBulkUpdate) return;

    // Create updates for all selected items to all displayed businesses
    const updates = [];
    filteredItems.forEach(item => {
      if (selectedItems.has(item.id)) {
        displayBusinesses.forEach(business => {
          // Check if BusinessItem already exists
          const existingBI = businessItems.find(
            bi => bi.item === item.id && bi.business === business.id
          );
          
          updates.push({
            itemId: item.id,
            businessId: business.id,
            isAvailable: existingBI ? existingBI.is_available : true,
            priceOverride: existingBI ? existingBI.price_override : null,
          });
        });
      }
    });

    onBulkUpdate(updates);
    clearSelection();
  }, [selectedItems, filteredItems, displayBusinesses, businessItems, onBulkUpdate, clearSelection]);

  // Handle cell toggle
  const handleToggle = useCallback((itemId, businessId, isAvailable) => {
    if (onUpdate) {
      onUpdate(itemId, businessId, isAvailable);
    }
  }, [onUpdate]);

  // Handle price change
  const handlePriceChange = useCallback((itemId, businessId, priceOverride) => {
    if (onUpdate) {
      onUpdate(itemId, businessId, true, priceOverride);
    }
  }, [onUpdate]);

  // Theme-based styling
  const headerClass = isDarkMode
    ? 'bg-slate-800 text-slate-100'
    : 'bg-slate-50 text-slate-700';

  const borderClass = isDarkMode
    ? 'border-slate-700'
    : 'border-slate-200';

  return (
    <div className="space-y-4">
      {/* Controls */}
      <MatrixControls
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        categoryFilter={categoryFilter}
        categories={categories}
        onCategoryChange={setCategoryFilter}
        selectedItems={Array.from(selectedItems)}
        onBulkAdd={handleBulkAdd}
        onClearSelection={clearSelection}
        isDarkMode={isDarkMode}
      />

      {/* Business filter dropdown */}
      <div className="flex items-center gap-2">
        <label className={`text-xs font-medium ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
          Filter by Business:
        </label>
        <select
          value={businessFilter}
          onChange={(e) => setBusinessFilter(e.target.value)}
          className={`rounded-lg border p-2 text-sm ${
            isDarkMode
              ? 'bg-slate-700 border-slate-600 text-white'
              : 'bg-white border-slate-200 text-slate-700'
          }`}
        >
          <option value="">All Businesses</option>
          {businesses.map((business) => (
            <option key={business.id} value={business.id}>
              {business.name}
            </option>
          ))}
        </select>
      </div>

      {/* Matrix Table */}
      <div className="overflow-x-auto rounded-lg border shadow-sm" style={{ maxHeight: '70vh' }}>
        <table className="w-full border-collapse">
          <thead className={`sticky top-0 z-20 ${headerClass}`}>
            <tr>
              {/* Sticky first column header - Item name */}
              <th
                className={`sticky left-0 z-30 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider border-b border-r ${headerClass} ${borderClass}`}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={filteredItems.length > 0 && filteredItems.every(item => selectedItems.has(item.id))}
                    onChange={toggleSelectAll}
                    className="rounded"
                    title="Select all items"
                  />
                  <span>Item</span>
                </div>
              </th>
              {/* Business column headers */}
              {displayBusinesses.map((business) => (
                <th
                  key={business.id}
                  className={`px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider border-b ${borderClass}`}
                >
                  <div className="min-w-24">
                    {business.name}
                    {!business.is_active && (
                      <span className="ml-1 text-slate-400">(Inactive)</span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className={isDarkMode ? 'bg-slate-900' : 'bg-white'}>
            {filteredItems.length === 0 ? (
              <tr>
                <td
                  colSpan={displayBusinesses.length + 1}
                  className={`px-4 py-8 text-center ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}
                >
                  {searchTerm || categoryFilter || businessFilter
                    ? 'No items match the current filters'
                    : 'No items available'}
                </td>
              </tr>
            ) : (
              filteredItems.map((item) => (
                <MatrixRow
                  key={item.id}
                  item={item}
                  businesses={displayBusinesses}
                  businessItems={businessItems}
                  onToggle={handleToggle}
                  onPriceChange={handlePriceChange}
                  selected={selectedItems.has(item.id)}
                  onToggleSelect={toggleItemSelection}
                  isDarkMode={isDarkMode}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Summary footer */}
      <div className={`flex items-center justify-between text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
        <span>
          Showing {filteredItems.length} of {items.length} items
          {businessFilter && ` for ${businesses.find(b => String(b.id) === String(businessFilter))?.name || 'selected business'}`}
        </span>
        {selectedItems.size > 0 && (
          <span className="text-cyan-600 font-medium">
            {selectedItems.size} item{selectedItems.size !== 1 ? 's' : ''} selected for bulk operation
          </span>
        )}
      </div>
    </div>
  );
}
