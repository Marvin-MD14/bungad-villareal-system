import React from 'react';
import { ChevronRight, Home } from 'lucide-react';

/**
 * Breadcrumbs - Navigation trail showing Home > Business Name > Current Page
 * 
 * Links "Home" to dashboard, "Business Name" to business overview.
 * Updates automatically when business context changes.
 * 
 * Requirements: 3.3, 3.6
 */
export default function Breadcrumbs({ businessName, currentPage, onNavigate, isDarkMode = false }) {
  const handleHomeClick = (e) => {
    e.preventDefault();
    if (onNavigate) onNavigate('home');
  };

  const handleBusinessClick = (e) => {
    e.preventDefault();
    if (onNavigate) onNavigate('business');
  };

  return (
    <nav
      className={
        flex items-center gap-1 text-xs
        
      }
      aria-label="Breadcrumb"
    >
      {/* Home */}
      <button
        onClick={handleHomeClick}
        className={
          inline-flex items-center gap-1 hover:underline
          
        }
      >
        <Home size={12} />
        <span>Home</span>
      </button>

      {/* Separator */}
      <ChevronRight size={12} className="text-slate-300" />

      {/* Business Name */}
      {businessName && (
        <>
          <button
            onClick={handleBusinessClick}
            className={
              hover:underline
              
            }
          >
            {businessName}
          </button>
          <ChevronRight size={12} className="text-slate-300" />
        </>
      )}

      {/* Current Page */}
      <span
        className={
          font-medium
          
        }
      >
        {currentPage}
      </span>
    </nav>
  );
}
