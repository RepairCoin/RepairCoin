"use client";

import React from 'react';
import { showToast } from '@/utils/toast';

/**
 * Demo component to showcase toast notifications
 * You can remove this component after testing
 */
export const ToastDemo: React.FC = () => {
  return (
    <div className="fixed bottom-4 left-4 z-50 p-4 bg-gray-900 rounded-lg shadow-lg">
      <p className="text-white text-sm mb-2">Toast Demo (Dev Only)</p>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => showToast.success('Success message!')}
          className="px-3 py-1 bg-green-500 text-white rounded text-xs hover:bg-green-600"
        >
          Success
        </button>
        <button
          onClick={() => showToast.error('Error message!')}
          className="px-3 py-1 bg-red-500 text-white rounded text-xs hover:bg-red-600"
        >
          Error
        </button>
        <button
          onClick={() => {
            const promise = new Promise((resolve) => {
              setTimeout(() => resolve('Done!'), 2000);
            });
            showToast.promise(promise, {
              loading: 'Loading...',
              success: 'Task completed!',
              error: 'Task failed!',
            });
          }}
          className="px-3 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600"
        >
          Promise
        </button>
        <button
          onClick={() => showToast.walletNotConnected()}
          className="px-3 py-1 bg-yellow-500 text-white rounded text-xs hover:bg-yellow-600"
        >
          Wallet
        </button>
      </div>
    </div>
  );
};