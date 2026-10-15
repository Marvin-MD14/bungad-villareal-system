import React, { useEffect } from 'react';

/**
 * PageTitle - Displays page title with business context and updates document.title
 * 
 * Sets document.title with format: "{Page Name} - {Business Name} | Villareal Management"
 * Updates automatically when business context changes.
 * 
 * Requirements: 3.2
 */
export default function PageTitle({ pageTitle, businessName, isDarkMode = false }) {
  // Update document.title when page or business changes
  useEffect(() => {
    const parts = [];
    
    if (pageTitle) {
      parts.push(pageTitle);
    }
    
    if (businessName) {
      parts.push(businessName);
    }
    
    parts.push('Villareal Management');
    
    document.title = parts.join(' - ');
    
    // Cleanup: reset title on unmount (optional)
    return () => {
      document.title = 'Villareal Management';
    };
  }, [pageTitle, businessName]);

  return (
    <h1
      className={
        text-xl font-bold tracking-tight
        
      }
    >
      {pageTitle}
    </h1>
  );
}
