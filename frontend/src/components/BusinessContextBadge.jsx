import React from 'react';
import { Store, AlertCircle } from 'lucide-react';

/**
 * BusinessContextBadge - Displays the active business context
 *
 * Shows a cyan badge with the business name when a business is active.
 * Shows an amber placeholder badge when no business is selected.
 *
 * Requirements: 3.1, 3.5
 */
export default function BusinessContextBadge({ businessName, businessSlug, isDarkMode = false }) {
  const hasBusiness = Boolean(businessName && businessSlug);

  if (!hasBusiness) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200">
        <AlertCircle size={12} />
        Select a business
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-cyan-100 text-cyan-800 border border-cyan-200">
      <Store size={12} />
      {businessName}
    </span>
  );
}
