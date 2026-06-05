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
    <div className="px-4 py-2">
      <div className="flex flex-wrap gap-2">
        {actions.map((action) => (
          <motion.button
            key={action.id}
            onClick={() => !disabled && onActionClick(action)}
            disabled={disabled}
            whileHover={{ scale: disabled ? 1 : 1.05 }}
            whileTap={{ scale: disabled ? 1 : 0.95 }}
            className={`
              px-4 py-2 rounded-full text-sm font-medium
              border-2 border-blue-500 text-blue-600
              hover:bg-blue-50 active:bg-blue-100
              transition-colors duration-200
              disabled:opacity-50 disabled:cursor-not-allowed
            `}
          >
            <span>{action.label}</span>
          </motion.button>
        ))}
      </div>
    </div>
  );
};
