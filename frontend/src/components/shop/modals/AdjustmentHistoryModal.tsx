// frontend/src/components/shop/modals/AdjustmentHistoryModal.tsx
import React, { useState, useEffect } from 'react';
import { X, Loader2, History, TrendingUp, TrendingDown, Package, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { inventoryApi } from '@/services/api/inventory';
import type { InventoryItemWithDetails, InventoryAdjustment } from '@/types/inventory';

interface AdjustmentHistoryModalProps {
  item: InventoryItemWithDetails;
  onClose: () => void;
}

const ADJUSTMENT_TYPE_ICONS: Record<string, React.ReactNode> = {
  manual: <Package className="w-4 h-4" />,
  purchase: <TrendingUp className="w-4 h-4" />,
  sale: <TrendingDown className="w-4 h-4" />,
  return: <TrendingUp className="w-4 h-4" />,
  damage: <AlertTriangle className="w-4 h-4" />,
  loss: <TrendingDown className="w-4 h-4" />,
  recount: <Package className="w-4 h-4" />,
  transfer: <Package className="w-4 h-4" />,
};

const ADJUSTMENT_TYPE_COLORS: Record<string, string> = {
  manual: 'text-blue-400',
  purchase: 'text-green-400',
  sale: 'text-purple-400',
  return: 'text-cyan-400',
  damage: 'text-orange-400',
  loss: 'text-red-400',
  recount: 'text-gray-400',
  transfer: 'text-indigo-400',
};

export const AdjustmentHistoryModal: React.FC<AdjustmentHistoryModalProps> = ({ item, onClose }) => {
  const [adjustments, setAdjustments] = useState<InventoryAdjustment[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    loadAdjustments();
  }, [page]);

  const loadAdjustments = async () => {
    try {
      setLoading(true);
      const response = await inventoryApi.getAdjustments(item.id, page, 20);
      setAdjustments(response.items);
      setTotalPages(response.pagination?.totalPages || 1);
    } catch (error) {
      console.error('Error loading adjustments:', error);
      toast.error('Failed to load adjustment history');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const formatAdjustmentType = (type: string) => {
    return type
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-[#1A1A1A] rounded-lg w-full max-w-4xl border border-gray-800 max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#FFCC00]/20 flex items-center justify-center">
              <History className="w-5 h-5 text-[#FFCC00]" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Adjustment History</h2>
              <p className="text-sm text-gray-400">{item.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-[#FFCC00] animate-spin" />
            </div>
          ) : adjustments.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <History className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No adjustment history yet</p>
              <p className="text-sm mt-1">Stock adjustments will appear here</p>
            </div>
          ) : (
            <div className="space-y-4">
              {adjustments.map((adjustment) => (
                <div
                  key={adjustment.id}
                  className="bg-[#101010] border border-gray-700 rounded-lg p-4 hover:border-gray-600 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    {/* Left side */}
                    <div className="flex items-start gap-4 flex-1">
                      {/* Icon */}
                      <div className={`mt-1 ${ADJUSTMENT_TYPE_COLORS[adjustment.adjustmentType] || 'text-gray-400'}`}>
                        {ADJUSTMENT_TYPE_ICONS[adjustment.adjustmentType] || <Package className="w-4 h-4" />}
                      </div>

                      {/* Details */}
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className={`font-medium ${ADJUSTMENT_TYPE_COLORS[adjustment.adjustmentType] || 'text-gray-400'}`}>
                            {formatAdjustmentType(adjustment.adjustmentType)}
                          </span>
                          <span className="text-xs text-gray-500">•</span>
                          <span className="text-sm text-gray-400">{formatDate(adjustment.createdAt)}</span>
                        </div>

                        {adjustment.reason && (
                          <p className="text-sm text-gray-300">{adjustment.reason}</p>
                        )}

                        {adjustment.notes && (
                          <p className="text-xs text-gray-500 italic">{adjustment.notes}</p>
                        )}

                        {adjustment.referenceType && adjustment.referenceId && (
                          <p className="text-xs text-gray-500">
                            Reference: {adjustment.referenceType} #{adjustment.referenceId}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Right side - Quantities */}
                    <div className="ml-4 flex items-center gap-4 text-sm">
                      <div className="text-right">
                        <p className="text-gray-400 text-xs mb-1">Before</p>
                        <p className="font-mono font-medium text-white">{adjustment.quantityBefore}</p>
                      </div>

                      <div className="text-center">
                        <p className="text-gray-400 text-xs mb-1">Change</p>
                        <p className={`font-mono font-bold ${
                          adjustment.quantityChange > 0 ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {adjustment.quantityChange > 0 && '+'}{adjustment.quantityChange}
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="text-gray-400 text-xs mb-1">After</p>
                        <p className="font-mono font-medium text-white">{adjustment.quantityAfter}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer with Pagination */}
        <div className="border-t border-gray-800 p-4">
          {totalPages > 1 ? (
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-400">
                Page {page} of {totalPages}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(page - 1)}
                  disabled={page === 1 || loading}
                  className="px-4 py-2 bg-[#101010] border border-gray-700 rounded-lg text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-800 transition-colors"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage(page + 1)}
                  disabled={page === totalPages || loading}
                  className="px-4 py-2 bg-[#101010] border border-gray-700 rounded-lg text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-800 transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={onClose}
              className="w-full px-6 py-2 bg-[#101010] border border-gray-700 text-gray-300 rounded-lg hover:border-gray-600 transition-colors"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
