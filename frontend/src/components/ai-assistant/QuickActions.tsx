/**
 * AI Chat Assistant - Quick Actions
 * Quick reply chips for common responses
 */

'use client';

import React from 'react';
import { QuickAction } from '@/types/aiChat';
import { motion } from 'framer-motion';

interface QuickActionsProps {
  actions: QuickAction[];
  onActionClick: (action: QuickAction) => void;
  disabled?: boolean;
}

export const QuickActions: React.FC<QuickActionsProps> = ({ actions, onActionClick, disabled = false }) => {
  if (!actions || actions.length === 0) {
    return null;
  }

  return (
    <div className="px-4 py-2 bg-[#101010] border-b border-gray-800">
      <div className="flex flex-wrap gap-2">
        {actions.map((action) => (
          <motion.button
            key={action.id}
            onClick={() => !disabled && onActionClick(action)}
            disabled={disabled}
            whileHover={{ scale: disabled ? 1 : 1.05 }}
            whileTap={{ scale: disabled ? 1 : 0.95 }}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-[#1A1A1A] border border-gray-700 text-gray-300 hover:border-[#FFCC00] hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span>{action.label}</span>
          </motion.button>
        ))}
      </div>
    </div>
  );
};
