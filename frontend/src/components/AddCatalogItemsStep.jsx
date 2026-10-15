import React, { useState, useEffect } from 'react';
import { Package, Search } from 'lucide-react';
import { api } from '../utils/api';

const records = (response) => response.data.results || response.data;

export default function AddCatalogItemsStep({
  businessId,
  initialData = [],
  onNext,
  onSkip,
  isDarkMode = false,
}) {
  const [items, setItems] = useState([]);
  const [selectedItems, setSelectedItems] = useState(new Set(initialData));
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const loadItems = async () => {
      try {
        const response = await api.get('/catalog/items/');
        setItems(records(response));
      } catch (error) {
        console.error('Failed to load items:', error);
      } finally {
        setLoading(false);
      }
    };
    loadItems();
  }, []);

  const toggleItem = (itemId) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
    } else {
      newSelected.add(itemId);
    }
    setSelectedItems(newSelected);
  };

  const selectAll = () => {
    const allIds = new Set(filteredItems.map((item) => item.id));
    setSelectedItems(allIds);
  };

  const deselectAll = () => {
    setSelectedItems(new Set());
  };

  const handleNext = () => {
    onNext(Array.from(selectedItems));
  };

  const filteredItems = items.filter(
    (item) =>
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.sku && item.sku.toLowerCase().includes(searchTerm.toLowerCase()))
  );

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
        <Package className="mx-auto h-12 w-12 text-cyan-500 mb-3" />
        <h3 className="text-lg font-bold">Add Catalog Items</h3>
        <p className="text-sm text-slate-500 mt-1">
          Select items this business will sell. You can skip this and add items later.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search items..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={"w-full pl-9 pr-4 py-2 rounded-lg border text-sm " + input}
          />
        </div>
        <button
          type="button"
          onClick={selectAll}
          className="px-3 py-2 text-xs font-medium text-cyan-600 hover:bg-cyan-50 rounded-lg"
        >
          Select All
        </button>
        <button
          type="button"
          onClick={deselectAll}
          className="px-3 py-2 text-xs font-medium text-slate-500 hover:bg-slate-50 rounded-lg"
        >
          Deselect All
        </button>
      </div>

      <p className="text-sm text-slate-500">
        {selectedItems.size} item{selectedItems.size !== 1 ? 's' : ''} selected
      </p>

      <div className="max-h-64 overflow-y-auto space-y-1">
        {filteredItems.map((item) => {
          const isSelected = selectedItems.has(item.id);
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => toggleItem(item.id)}
              className={"w-full flex items-center gap-3 p-2 rounded-lg text-left transition " + (isSelected ? (isDarkMode ? 'bg-cyan-900/20' : 'bg-cyan-50') : (isDarkMode ? 'hover:bg-slate-700' : 'hover:bg-slate-50'))}
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => {}}
                className="rounded border-slate-300 text-cyan-600"
              />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{item.name}</p>
                <p className="text-xs text-slate-500">
                  {item.item_type} {item.sku && '- ' + item.sku}
                </p>
              </div>
              <p className="text-sm font-medium">P{item.selling_price}</p>
            </button>
          );
        })}
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
          onClick={handleNext}
          className="px-6 py-2 bg-cyan-500 text-white text-sm font-semibold rounded-lg hover:bg-cyan-600 transition"
        >
          Next
        </button>
      </div>
    </div>
  );
}

