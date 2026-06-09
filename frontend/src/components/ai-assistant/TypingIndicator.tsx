/**
 * AI Chat Assistant - Typing Indicator
 * Animated "AI is typing..." indicator
 */

'use client';

import React from 'react';
import { motion } from 'framer-motion';

export const TypingIndicator: React.FC = () => {
  return (
    <div className="flex justify-start mb-4" aria-live="polite" aria-label="Assistant is typing">
      <div className="flex items-end gap-2">
        {/* AI Avatar */}
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#1A1A1A] border border-gray-700 flex items-center justify-center text-white text-lg">
          🤖
        </div>

        {/* Typing animation */}
        <div className="px-4 py-3 rounded-lg bg-[#1A1A1A] border border-gray-800">
          <div className="flex gap-1">
            {[0, 1, 2].map((index) => (
              <motion.div
                key={index}
                className="w-2 h-2 bg-[#FFCC00] rounded-full"
                animate={{
                  y: [0, -8, 0],
                }}
                transition={{
                  duration: 0.6,
                  repeat: Infinity,
                  delay: index * 0.15,
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
