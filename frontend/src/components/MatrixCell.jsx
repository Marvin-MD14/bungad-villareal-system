import React from 'react';
import { Check, X } from 'lucide-react';

export default function MatrixCell({
  itemId,
  businessId,
  isAvailable,
  priceOverride,
  defaultPrice,
  onToggle,
  onPriceChange,
  isDarkMode = false,
}) {
  const handleToggle = () => {
    if (onToggle) {
      onToggle(itemId, businessId, !isAvailable);
    }
  };

  const handlePriceChange = (e) => {
    const value = e.target.value;
    if (onPriceChange) {
      onPriceChange(itemId, businessId, value === '' ? null : parseFloat(value));
    }
  };

  const displayPrice = priceOverride !== null && priceOverride !== undefined
    ? priceOverride
    : defaultPrice;

  return (
    <div className="flex flex-col items-center gap-1 p-2">
      <button
        type="button"
        onClick={handleToggle}
        className={
          "w-8 h-8 rounded-full flex items-center justify-center transition " +
          (isAvailable
            ? "bg-emerald-100 text-emerald-600 hover:bg-emerald-200"
            : "bg-slate-100 text-slate-400 hover:bg-slate-200")
        }
        title={isAvailable ? "Available - click to remove" : "Not available - click to add"}
      >
        {isAvailable ? <Check size={16} /> : <X size={16} />}
      </button>
      
      {isAvailable && (
        <input
          type="number"
          value={priceOverride !== null && priceOverride !== undefined ? priceOverride : ''}
          onChange={handlePriceChange}
          placeholder={String(defaultPrice)}
          className={
            "w-16 text-center text-xs rounded border p-1 " +
            (isDarkMode
              ? "bg-slate-700 border-slate-600 text-white"
              : "bg-white border-slate-200 text-slate-700")
          }
          title={"Override price (default: " + defaultPrice + ")"}
        />
      )}
    </div>
  );
}

