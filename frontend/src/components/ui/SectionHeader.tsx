'use client';

import React from 'react';

interface SectionHeaderProps {
  title: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  subtitle,
  actions
}) => {
  return (
    <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 mb-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-white mb-1">
          {title}
        </h1>
        {subtitle && (
          <p className="text-sm sm:text-base text-gray-400">
            {subtitle}
          </p>
        )}
      </div>

      {actions && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 w-full lg:w-auto">
          {actions}
        </div>
      )}
    </div>
  );
};
