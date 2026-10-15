import React from 'react';
import { Search, Filter, Plus, X } from 'lucide-react';

export default function MatrixControls({
  searchTerm,
  onSearchChange,
  categoryFilter,
  categories,
  onCategoryChange,
  selectedItems,
  onBulkAdd,
  onClearSelection,
  isDarkMode = false,
}) {
  const input = isDarkMode
    ? 'bg-slate-700 border-slate-600 text-white'
    : 'bg-white border-slate-200 text-slate-700';

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search items..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className={"w-full pl-9 pr-4 py-2 rounded-lg border text-sm " + input}
          />
        </div>

        <select
          value={categoryFilter}
          onChange={(e) => onCategoryChange(e.target.value)}
          className={"rounded-lg border p-2 text-sm " + input}
        >
          <option value="">All Categories</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>
      </div>

      {selectedItems.length > 0 && (
        <div className="flex items-center gap-2 p-2 rounded-lg bg-cyan-50 border border-cyan-200">
          <span className="text-sm text-cyan-700">
            {selectedItems.length} item{selectedItems.length !== 1 ? 's' : ''} selected
          </span>
          <button
            type="button"
            onClick={onBulkAdd}
            className="px-3 py-1 bg-cyan-500 text-white text-xs font-medium rounded hover:bg-cyan-600"
          >
            Add to Selected Businesses
          </button>
          <button
            type="button"
            onClick={onClearSelection}
            className="p-1 text-cyan-600 hover:bg-cyan-100 rounded"
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

