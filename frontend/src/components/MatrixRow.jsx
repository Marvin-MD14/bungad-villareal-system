import React from 'react';
import MatrixCell from './MatrixCell';

/**
 * MatrixRow Component
 * 
 * Renders a row in the availability matrix with item name (sticky first column)
 * and cells for each business.
 * 
 * Requirements: 5.2, 5.3
 * 
 * @param {Object} item - The catalog item for this row
 * @param {Object[]} businesses - Array of businesses to display as columns
 * @param {Object[]} businessItems - Array of BusinessItem associations
 * @param {Function} onToggle - Callback for availability toggle (itemId, businessId, isAvailable)
 * @param {Function} onPriceChange - Callback for price override change (itemId, businessId, priceOverride)
 * @param {boolean} selected - Whether this item is selected for bulk operations
 * @param {Function} onToggleSelect - Callback to toggle item selection
 * @param {boolean} isDarkMode - Dark mode styling flag
 */
export default function MatrixRow({
  item,
  businesses,
  businessItems,
  onToggle,
  onPriceChange,
  selected = false,
  onToggleSelect,
  isDarkMode = false,
}) {
  const getBusinessItem = (businessId) => {
    return businessItems.find(
      (bi) => bi.item === item.id && bi.business === businessId
    );
  };

  const rowBgClass = selected
    ? (isDarkMode ? 'bg-cyan-900/20' : 'bg-cyan-50')
    : '';

  return (
    <tr className={`${isDarkMode ? 'hover:bg-slate-800' : 'hover:bg-slate-50'} ${rowBgClass}`}>
      {/* Sticky first column - Item name with selection checkbox */}
      <td
        className={
          'sticky left-0 z-10 px-4 py-2 font-medium text-sm border-r ' +
          (isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200') +
          (selected ? (isDarkMode ? ' bg-cyan-900/30' : ' bg-cyan-50') : '')
        }
      >
        <div className="flex items-center gap-2">
          {onToggleSelect && (
            <input
              type="checkbox"
              checked={selected}
              onChange={() => onToggleSelect(item.id)}
              className="rounded"
              title={selected ? 'Deselect item' : 'Select item for bulk operation'}
            />
          )}
          <div className="min-w-0">
            <p className="truncate">{item.name}</p>
            <p className="text-xs text-slate-500">
              {item.item_type} {item.sku && '- ' + item.sku}
            </p>
          </div>
        </div>
      </td>
      {/* Business cells */}
      {businesses.map((business) => {
        const bi = getBusinessItem(business.id);
        return (
          <td key={business.id} className="px-2 py-2 text-center">
            <MatrixCell
              itemId={item.id}
              businessId={business.id}
              isAvailable={bi ? bi.is_available : false}
              priceOverride={bi ? bi.price_override : null}
              defaultPrice={item.selling_price}
              onToggle={onToggle}
              onPriceChange={onPriceChange}
              isDarkMode={isDarkMode}
            />
          </td>
        );
      })}
    </tr>
  );
}
