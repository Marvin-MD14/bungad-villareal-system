import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

/**
 * DeactivationModal - Confirmation modal for business deactivation
 * 
 * Displays consequences of deactivation:
 * - Users lose access to the business
 * - Transactions become read-only
 * - Business appears inactive in lists
 * 
 * Requirements: 2.2, 2.3
 */
export default function DeactivationModal({ business, isOpen, onConfirm, onCancel, isDarkMode = false }) {
  if (!isOpen || !business) return null;

  const consequences = [
    'Users will lose access to this business',
    'Transactions will become read-only',
    'Business will appear inactive in lists',
    'New transactions cannot be created',
    'Reports will still show historical data',
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onCancel}
      />

      {/* Modal */}
      <div
        className={`relative z-10 w-full max-w-md mx-4 rounded-2xl shadow-2xl ${
          isDarkMode ? 'bg-slate-800' : 'bg-white'
        }`}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-red-100 text-red-600">
              <AlertTriangle size={20} />
            </div>
            <div>
              <h3 className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                Deactivate Business
              </h3>
              <p className={`text-sm ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                {business.name}
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className={`p-1 rounded-lg transition-colors ${
              isDarkMode ? 'text-slate-400 hover:bg-slate-700' : 'text-slate-400 hover:bg-slate-100'
            }`}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5">
          <p className={`mb-4 text-sm ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
            Are you sure you want to deactivate this business? The following will happen:
          </p>

          <ul className="space-y-2">
            {consequences.map((consequence, index) => (
              <li
                key={index}
                className={`flex items-start gap-2 text-sm ${
                  isDarkMode ? 'text-slate-300' : 'text-slate-600'
                }`}
              >
                <span className="text-amber-500 mt-0.5">•</span>
                {consequence}
              </li>
            ))}
          </ul>

          <div
            className={`mt-4 p-3 rounded-lg text-xs ${
              isDarkMode ? 'bg-slate-700 text-slate-300' : 'bg-amber-50 text-amber-800'
            }`}
          >
            <strong>Note:</strong> Deactivation is reversible by superadmins. Historical data will be preserved.
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 p-5 border-t border-slate-200 dark:border-slate-700">
          <button
            onClick={onCancel}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              isDarkMode
                ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(business)}
            className="
              px-4 py-2 rounded-lg text-sm font-medium text-white
              bg-red-600 hover:bg-red-700 transition-colors
            "
          >
            Deactivate
          </button>
        </div>
      </div>
    </div>
  );
}
