import { useState } from 'react';
import { Info } from 'lucide-react';

/**
 * BusinessPickerTooltip - Help text for company-wide role users
 * 
 * Displays tooltip: "Your role can operate across all businesses. 
 * Select which business this record belongs to."
 * 
 * @param {Object} props
 * @param {boolean} props.isDarkMode - Whether dark mode is enabled
 */
export default function BusinessPickerTooltip({ isDarkMode = false }) {
  const [isVisible, setIsVisible] = useState(false);

  const tooltipStyle = {
    backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
    borderRadius: '10px',
    border: isDarkMode ? '1px solid #334155' : '1px solid #e2e8f0',
    fontSize: '11px',
    color: isDarkMode ? '#fff' : '#000',
    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
  };

  return (
    <div className="relative inline-flex items-center">
      <button
        type="button"
        className={`p-1 rounded-full transition-colors ${
          isDarkMode 
            ? 'hover:bg-slate-700 text-slate-400 hover:text-slate-200' 
            : 'hover:bg-slate-100 text-slate-500 hover:text-slate-700'
        }`}
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        onFocus={() => setIsVisible(true)}
        onBlur={() => setIsVisible(false)}
        aria-label="Information about business selection"
      >
        <Info size={14} />
      </button>
      
      {isVisible && (
        <div
          className="absolute z-50 left-6 top-1/2 -translate-y-1/2 w-64 p-3"
          style={tooltipStyle}
          role="tooltip"
        >
          <p className="text-xs leading-relaxed">
            Your role can operate across all businesses. Select which business this record belongs to.
          </p>
          {/* Arrow pointing to the icon */}
          <div
            className={`absolute left-0 top-1/2 -translate-x-1 -translate-y-1/2 w-2 h-2 rotate-45 ${
              isDarkMode ? 'bg-slate-800 border-l border-b border-slate-700' : 'bg-white border-l border-b border-slate-200'
            }`}
          />
        </div>
      )}
    </div>
  );
}
