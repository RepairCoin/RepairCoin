'use client';

import React from 'react';
import { CustomerNoShowStatus, getTierColor, getTierLabel, getTierIcon } from '@/services/api/noShow';

interface CustomerNoShowBadgeProps {
  status: CustomerNoShowStatus | null;
  size?: 'sm' | 'md' | 'lg';
  showDetails?: boolean;
}

export default function CustomerNoShowBadge({
  status,
  size = 'md',
  showDetails = false
}: CustomerNoShowBadgeProps) {
  if (!status || status.tier === 'normal') {
    return null; // Don't show badge for customers in good standing
  }

  const sizeClasses = {
    sm: 'text-xs px-2 py-1',
    md: 'text-sm px-3 py-1.5',
    lg: 'text-base px-4 py-2'
  };

  const tierColor = getTierColor(status.tier);
  const tierLabel = getTierLabel(status.tier);
  const tierIcon = getTierIcon(status.tier);

  return (
    <div className="flex flex-col gap-2">
      {/* Badge */}
      <div className={`inline-flex items-center gap-1.5 ${tierColor} text-white rounded-full ${sizeClasses[size]} font-medium shadow-sm w-fit`}>
        <span>{tierIcon}</span>
        <span>{tierLabel}</span>
        <span className="bg-white/20 rounded-full px-2 py-0.5 text-xs">
          {status.noShowCount} no-show{status.noShowCount !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Details (optional) */}
      {showDetails && status.restrictions.length > 0 && (
        <div className="text-xs text-gray-600 mt-1">
          {status.restrictions.map((restriction, index) => (
            <div key={index} className="flex items-start gap-1">
              <span className="text-gray-400">•</span>
              <span>{restriction}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
