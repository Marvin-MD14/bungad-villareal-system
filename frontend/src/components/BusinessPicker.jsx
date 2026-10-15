import { useEffect, useMemo } from 'react';
import { Building2 } from 'lucide-react';
import { getActiveBusinessSlug } from '../utils/session';

/**
 * BusinessPicker - A dropdown component for selecting a business.
 *
 * Filters to show only active businesses and pre-selects the active business
 * from session context.
 *
 * @param {Object} props
 * @param {string|number} props.value - Selected business ID
 * @param {function} props.onChange - Callback when selection changes
 * @param {Array} props.businesses - Array of business objects
 * @param {string} props.label - Label text (defaults to "Select the business for this record")
 * @param {string} props.placeholder - Placeholder text (defaults to "Select a business…")
 * @param {boolean} props.required - Whether the field is required (defaults to true)
 * @param {boolean} props.showTooltip - Show help tooltip
 * @param {boolean} props.disabled - Whether the dropdown is disabled
 * @param {boolean} props.isDarkMode - Dark mode styling
 */
export default function BusinessPicker({
  value,
  onChange,
  businesses = [],
  label = 'Select the business for this record',
  placeholder = 'Select a business…',
  required = true,
  showTooltip = false,
  disabled = false,
  isDarkMode = false,
}) {
  // Filter to only show active businesses
  const activeBusinesses = useMemo(
    () => businesses.filter((business) => business.is_active !== false),
    [businesses]
  );

  // Pre-select active business from session context when no value is set
  useEffect(() => {
    if (!value && activeBusinesses.length > 0) {
      const activeSlug = getActiveBusinessSlug();
      const activeBusiness = activeBusinesses.find(
        (business) => business.slug === activeSlug
      );
      if (activeBusiness) {
        onChange(String(activeBusiness.id));
      }
    }
  }, [value, activeBusinesses, onChange]);

  // Styling based on dark mode
  const input = isDarkMode
    ? 'bg-slate-700 border-slate-600 text-white'
    : 'bg-white border-slate-200 text-slate-700';

  const labelClass = isDarkMode
    ? 'text-slate-300'
    : 'text-slate-700';

  return (
    <div className="space-y-1.5">
      {/* Label */}
      <label className={`flex items-center gap-1.5 text-xs font-semibold ${labelClass}`}>
        <Building2 size={14} className="text-cyan-600" />
        {label}
        {required && <span className="text-rose-500">*</span>}
        {showTooltip && (
          <span
            className="ml-1 cursor-help text-slate-400"
            title="Choose the business this record belongs to. Only active businesses are shown."
          >
            ℹ️
          </span>
        )}
      </label>

      {/* Select dropdown */}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        disabled={disabled}
        className={`${input} w-full rounded-lg border p-2 text-sm transition-colors focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 disabled:cursor-not-allowed disabled:opacity-50`}
      >
        <option value="">{placeholder}</option>
        {activeBusinesses.map((business) => (
          <option key={business.id} value={String(business.id)}>
            {business.name}
            {business.slug ? ` (${business.slug})` : ''}
          </option>
        ))}
      </select>

      {/* Validation message area */}
      {required && !value && (
        <p className="text-[10px] text-slate-500">
          A business must be selected for this record.
        </p>
      )}
    </div>
  );
}
