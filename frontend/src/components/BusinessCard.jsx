import React from 'react';
import { Store, Edit3, X, Power, PowerOff } from 'lucide-react';

/**
 * BusinessCard - Reusable component for displaying a business in a card/tab format
 * 
 * Extracted from AdministrationPage to support:
 * - Active/inactive badge styling
 * - Role-based Deactivate/Reactivate buttons
 * - Consistent business display across the app
 * 
 * Requirements: 2.1, 2.5, 2.7, 2.8
 */
export default function BusinessCard({
  business,
  isSelected = false,
  onSelect,
  onEdit,
  onDeactivate,
  onReactivate,
  onDelete,
  branchCount = 0,
  isSuperadmin = false,
  isDarkMode = false,
}) {
  const isActive = business.is_active !== false;

  const handleSelect = () => {
    if (onSelect) onSelect(business);
  };

  const handleEdit = (e) => {
    e.stopPropagation();
    if (onEdit) onEdit(business);
  };

  const handleDeactivate = (e) => {
    e.stopPropagation();
    if (onDeactivate) onDeactivate(business);
  };

  const handleReactivate = (e) => {
    e.stopPropagation();
    if (onReactivate) onReactivate(business);
  };

  const handleDelete = (e) => {
    e.stopPropagation();
    if (onDelete) onDelete(business);
  };

  // Tab-style button for business selector
  if (onSelect && !onEdit) {
    return (
      <button
        type="button"
        onClick={handleSelect}
        disabled={!isActive}
        className={`relative rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
          isSelected
            ? 'bg-cyan-500 text-white border-cyan-500'
            : isDarkMode
              ? 'bg-slate-700 text-slate-300 border-slate-600 hover:border-cyan-400'
              : 'bg-white text-slate-700 border-slate-200 hover:border-cyan-400'
        } ${!isActive ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        {business.name}
        <span className={`ml-2 text-[10px] ${isSelected ? 'text-cyan-100' : 'text-slate-400'}`}>
          {branchCount}
        </span>
        {!isActive && (
          <span className="ml-2 rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold uppercase text-slate-600">
            Inactive
          </span>
        )}
      </button>
    );
  }

  // Card-style display for administration page
  return (
    <div
      className={`relative rounded-xl border p-4 transition ${
        isDarkMode
          ? 'bg-slate-800 border-slate-700 hover:border-cyan-500'
          : 'bg-white border-slate-200 hover:border-cyan-400'
      } ${!isActive ? 'opacity-60' : ''}`}
    >
      {/* Inactive badge */}
      {!isActive && (
        <span className={`absolute top-2 right-2 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
          isDarkMode ? 'bg-slate-700 text-slate-400' : 'bg-slate-200 text-slate-500'
        }`}>
          Inactive
        </span>
      )}

      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-lg ${isDarkMode ? 'bg-slate-700' : 'bg-cyan-50'}`}>
          <Store size={20} className="text-cyan-600" />
        </div>

        <div className="flex-1 min-w-0">
          <h4 className={`font-bold truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
            {business.name}
          </h4>
          <p className={`text-xs truncate ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            {business.slug && <code className="text-[11px]">{business.slug}</code>}
            {business.business_type_name && (
              <span className="ml-2">· {business.business_type_name}</span>
            )}
          </p>
          <p className={`text-xs mt-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            {branchCount} {branchCount === 1 ? 'outlet' : 'outlets'}
          </p>
        </div>
      </div>

      {/* Action buttons - only for superadmin */}
      {isSuperadmin && (
        <div className="flex flex-wrap items-center gap-2 mt-4 pt-3 border-t border-slate-200 dark:border-slate-700">
          <button
            type="button"
            onClick={handleEdit}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
              isDarkMode
                ? 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Edit3 size={14} /> Edit
          </button>

          {isActive ? (
            <button
              type="button"
              onClick={handleDeactivate}
              className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition border-amber-300 text-amber-600 hover:bg-amber-50"
            >
              <PowerOff size={14} /> Deactivate
            </button>
          ) : (
            <button
              type="button"
              onClick={handleReactivate}
              className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition border-emerald-300 text-emerald-600 hover:bg-emerald-50"
            >
              <Power size={14} /> Reactivate
            </button>
          )}

          <button
            type="button"
            onClick={handleDelete}
            className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition border-rose-300 text-rose-600 hover:bg-rose-50"
          >
            <X size={14} /> Delete
          </button>
        </div>
      )}
    </div>
  );
}
