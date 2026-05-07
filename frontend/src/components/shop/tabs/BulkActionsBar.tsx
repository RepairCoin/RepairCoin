// frontend/src/components/shop/tabs/BulkActionsBar.tsx
import React from 'react';
import { X, Trash2, Edit, CheckCircle, XCircle } from 'lucide-react';

interface BulkActionsBarProps {
  selectedCount: number;
  onClearSelection: () => void;
  onBulkDelete: () => void;
  onBulkUpdateStatus: () => void;
}

export const BulkActionsBar: React.FC<BulkActionsBarProps> = ({
  selectedCount,
  onClearSelection,
  onBulkDelete,
  onBulkUpdateStatus,
}) => {
  if (selectedCount === 0) return null;

  return (
    <div className="bg-[#1A1A1A] border border-[#FFCC00] rounded-lg p-4 mb-4 animate-in slide-in-from-top duration-300">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        {/* Left side - Selection count */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#FFCC00]/20 flex items-center justify-center">
            <CheckCircle className="w-5 h-5 text-[#FFCC00]" />
          </div>
          <div>
            <p className="text-white font-medium">
              {selectedCount} {selectedCount === 1 ? 'item' : 'items'} selected
            </p>
            <p className="text-sm text-gray-400">Choose an action to perform</p>
          </div>
        </div>

        {/* Right side - Action buttons */}
        <div className="flex items-center gap-2">
          {/* Update Status */}
          <button
            onClick={onBulkUpdateStatus}
            className="px-4 py-2 bg-blue-500/20 border border-blue-500/50 text-blue-400 rounded-lg hover:bg-blue-500/30 hover:border-blue-500 transition-colors flex items-center gap-2 text-sm font-medium"
          >
            <Edit className="w-4 h-4" />
            Update Status
          </button>

          {/* Delete */}
          <button
            onClick={onBulkDelete}
            className="px-4 py-2 bg-red-500/20 border border-red-500/50 text-red-400 rounded-lg hover:bg-red-500/30 hover:border-red-500 transition-colors flex items-center gap-2 text-sm font-medium"
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </button>

          {/* Clear Selection */}
          <button
            onClick={onClearSelection}
            className="px-4 py-2 bg-[#101010] border border-gray-700 text-gray-300 rounded-lg hover:border-gray-600 transition-colors flex items-center gap-2 text-sm"
          >
            <X className="w-4 h-4" />
            Clear
          </button>
        </div>
      </div>
    </div>
  );
};
