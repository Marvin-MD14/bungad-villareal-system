import React from 'react';
import { Crown, Award, Star, Shield } from 'lucide-react';

const TIER_CONFIG = {
  BRONZE: {
    color: 'from-amber-600 to-amber-800',
    icon: <Shield size={12} />,
    label: 'Bronze',
    textColor: 'text-amber-700',
    bgLight: 'bg-amber-50',
    borderColor: 'border-amber-200',
  },
  SILVER: {
    color: 'from-slate-400 to-slate-600',
    icon: <Award size={12} />,
    label: 'Silver',
    textColor: 'text-slate-700',
    bgLight: 'bg-slate-50',
    borderColor: 'border-slate-300',
  },
  GOLD: {
    color: 'from-yellow-400 to-yellow-600',
    icon: <Star size={12} />,
    label: 'Gold',
    textColor: 'text-yellow-700',
    bgLight: 'bg-yellow-50',
    borderColor: 'border-yellow-300',
  },
  PLATINUM: {
    color: 'from-cyan-400 to-blue-600',
    icon: <Crown size={12} />,
    label: 'Platinum',
    textColor: 'text-cyan-700',
    bgLight: 'bg-cyan-50',
    borderColor: 'border-cyan-300',
  },
};

export default function CustomerTierBadge({ tier = 'BRONZE', size = 'sm', variant = 'solid' }) {
  const config = TIER_CONFIG[tier] || TIER_CONFIG.BRONZE;
  const sizeClasses =
    size === 'lg'
      ? 'px-3 py-1.5 text-xs'
      : size === 'md'
      ? 'px-2.5 py-1 text-[11px]'
      : 'px-2 py-0.5 text-[10px]';

  if (variant === 'light') {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full font-bold ${config.textColor} ${config.bgLight} ${config.borderColor} border ${sizeClasses}`}
      >
        {config.icon}
        {config.label}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-bold text-white bg-gradient-to-r ${config.color} ${sizeClasses}`}
    >
      {config.icon}
      {config.label}
    </span>
  );
}

export { TIER_CONFIG };
