'use client';

import React from 'react';

interface StatCardProps {
  icon?: string | React.ReactNode;
  value: string | number;
  label: string;
  subtitle?: string;
  description?: string;
  trend?: string;
  trendUp?: boolean;
  color?: 'purple' | 'green' | 'blue' | 'yellow' | 'red' | 'orange';
}

export const StatCard: React.FC<StatCardProps> = ({ 
  icon, 
  value, 
  label, 
  subtitle,
  description, 
  trend, 
  trendUp,
  color = 'blue' 
}) => {
  const colorClasses = {
    purple: 'text-purple-500',
    green: 'text-green-500',
    blue: 'text-blue-500',
    yellow: 'text-[#FFCC00]',
    red: 'text-red-500',
    orange: 'text-orange-500'
  };

  const isEmoji = typeof icon === 'string';

  return (
    <div className="bg-gradient-to-br from-[#1C1C1C] to-[#252525] rounded-2xl p-6 border border-gray-800 hover:border-gray-700 transition-all">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-400">{label}</p>
          {subtitle && (
            <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
          )}
        </div>
        {icon && (
          <div className={isEmoji ? "text-3xl" : `${colorClasses[color]} opacity-50`}>
            {icon}
          </div>
        )}
      </div>
      
      <div className={`text-3xl font-bold ${colorClasses[color]} mb-1`}>
        {value}
      </div>
      
      {(description || trend) && (
        <div className="flex items-center justify-between mt-4">
          {description && (
            <p className="text-xs text-gray-400">{description}</p>
          )}
          {trend && (
            <span className={`text-sm font-medium ${trendUp ? 'text-green-500' : trendUp === false ? 'text-red-500' : 'text-gray-400'}`}>
              {trendUp !== undefined && (trendUp ? '↑' : '↓')} {trend}
            </span>
          )}
        </div>
      )}
    </div>
  );
};