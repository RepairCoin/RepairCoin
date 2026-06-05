// frontend/src/components/shop/modals/StockAdjustmentModal.tsx
import React, { useState } from 'react';
import { X, Plus, Minus, Loader2, Package, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { inventoryApi } from '@/services/api/inventory';
import { NumberInput } from '@/components/ui/NumberInput';
import type { InventoryItemWithDetails, AdjustmentType } from '@/types/inventory';

interface StockAdjustmentModalProps {
  item: InventoryItemWithDetails;
  onClose: () => void;
  onSuccess: () => void;
}

const ADJUSTMENT_TYPES: { value: AdjustmentType; label: string; icon: React.ReactNode; color: string }[] = [
  { value: 'manual', label: 'Manual Adjustment', icon: <Package className="w-4 h-4" />, color: 'blue' },
  { value: 'purchase', label: 'Purchase/Restock', icon: <TrendingUp className="w-4 h-4" />, color: 'green' },
  { value: 'sale', label: 'Sale', icon: <TrendingDown className="w-4 h-4" />, color: 'purple' },
  { value: 'return', label: 'Customer Return', icon: <Plus className="w-4 h-4" />, color: 'cyan' },
  { value: 'damage', label: 'Damage/Loss', icon: <AlertTriangle className="w-4 h-4" />, color: 'orange' },
  { value: 'loss', label: 'Theft/Loss', icon: <Minus className="w-4 h-4" />, color: 'red' },
  { value: 'recount', label: 'Inventory Recount', icon: <Package className="w-4 h-4" />, color: 'gray' },
  { value: 'transfer', label: 'Transfer', icon: <Package className="w-4 h-4" />, color: 'indigo' },
];

export const StockAdjustmentModal: React.FC<StockAdjustmentModalProps> = ({ item, onClose, onSuccess }) => {
  const [adjustmentType, setAdjustmentType] = useState<AdjustmentType>('manual');
  const [quantityChange, setQuantityChange] = useState<number>(0);
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const newStockLevel = item.stockQuantity + quantityChange;
  const isDecrease = quantityChange < 0;
  const isIncrease = quantityChange > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (quantityChange === 0) {
      toast.error('Quantity change cannot be zero');
      return;
    }

    if (newStockLevel < 0) {
      toast.error('Stock level cannot be negative');
      return;
    }

    if (!reason.trim()) {
      toast.error('Please provide a reason for this adjustment');
      return;
    }

    setLoading(true);

    try {
      await inventoryApi.adjustStock(item.id, {
        adjustmentType,
        quantityChange,
        reason: reason.trim(),
        notes: notes.trim() || undefined,
      });

      toast.success(`Stock adjusted successfully: ${isIncrease ? '+' : ''}${quantityChange} units`);
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error adjusting stock:', error);
      toast.error(error.response?.data?.error || 'Failed to adjust stock');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickAdjust = (amount: number) => {
    setQuantityChange((prev) => prev + amount);
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-[#1A1A1A] rounded-lg w-full max-w-2xl border border-gray-800 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#FFCC00]/20 flex items-center justify-center">
              <Package className="w-5 h-5 text-[#FFCC00]" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Adjust Stock</h2>
              <p className="text-sm text-gray-400">{item.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
            disabled={loading}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1">
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Current Stock Display */}
          <div className="bg-[#101010] border border-gray-700 rounded-lg p-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-sm text-gray-400 mb-1">Current Stock</p>
                <p className="text-2xl font-bold text-white">{item.stockQuantity}</p>
              </div>
              <div>
                <p className="text-sm text-gray-400 mb-1">Adjustment</p>
                <p className={`text-2xl font-bold ${
                  isIncrease ? 'text-green-400' : isDecrease ? 'text-red-400' : 'text-gray-400'
                }`}>
                  {isIncrease && '+'}{quantityChange}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-400 mb-1">New Stock</p>
                <p className={`text-2xl font-bold ${
                  newStockLevel < 0 ? 'text-red-400' :
                  newStockLevel <= item.lowStockThreshold ? 'text-yellow-400' :
                  'text-green-400'
                }`}>
                  {newStockLevel}
                </p>
              </div>
            </div>
            {newStockLevel < 0 && (
              <div className="mt-3 flex items-center gap-2 text-red-400 text-sm">
                <AlertTriangle className="w-4 h-4" />
                <span>Warning: Stock level cannot be negative</span>
              </div>
            )}
            {newStockLevel > 0 && newStockLevel <= item.lowStockThreshold && (
              <div className="mt-3 flex items-center gap-2 text-yellow-400 text-sm">
                <AlertTriangle className="w-4 h-4" />
                <span>Warning: New stock level is below threshold ({item.lowStockThreshold})</span>
              </div>
            )}
          </div>

          {/* Adjustment Type */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">
              Adjustment Type <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {ADJUSTMENT_TYPES.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setAdjustmentType(type.value)}
                  className={`p-3 rounded-lg border transition-all ${
                    adjustmentType === type.value
                      ? 'border-[#FFCC00] bg-[#FFCC00]/10 text-[#FFCC00]'
                      : 'border-gray-700 bg-[#101010] text-gray-400 hover:border-gray-600'
                  }`}
                  disabled={loading}
                >
                  <div className="flex flex-col items-center gap-2">
                    {type.icon}
                    <span className="text-xs text-center">{type.label}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Quantity Change */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Quantity Change <span className="text-red-500">*</span>
            </label>
            <div className="flex items-center gap-2">
              {/* Quick buttons */}
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => handleQuickAdjust(-10)}
                  className="px-3 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors text-sm"
                  disabled={loading}
                >
                  -10
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickAdjust(-1)}
                  className="px-3 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors text-sm"
                  disabled={loading}
                >
                  -1
                </button>
              </div>

              {/* Input */}
              <NumberInput
                integer
                value={quantityChange}
                onValueChange={setQuantityChange}
                className="flex-1 min-w-0 px-4 py-2 bg-[#101010] border border-gray-700 rounded-lg text-white text-center font-bold focus:outline-none focus:border-[#FFCC00] transition-colors"
                placeholder="0"
                disabled={loading}
              />

              {/* Quick buttons */}
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => handleQuickAdjust(+1)}
                  className="px-3 py-2 bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30 transition-colors text-sm"
                  disabled={loading}
                >
                  +1
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickAdjust(+10)}
                  className="px-3 py-2 bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30 transition-colors text-sm"
                  disabled={loading}
                >
                  +10
                </button>
              </div>
            </div>
          </div>

          {/* Reason */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Reason <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Received new shipment, Damaged during inspection"
              className="w-full px-4 py-2 bg-[#101010] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#FFCC00] transition-colors"
              required
              disabled={loading}
            />
          </div>

          {/* Notes (Optional) */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Additional Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any additional details about this adjustment..."
              rows={3}
              className="w-full px-4 py-2 bg-[#101010] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#FFCC00] transition-colors resize-none"
              disabled={loading}
            />
          </div>

          </div>

          {/* Footer */}
          <div className="shrink-0 flex items-center justify-end gap-3 p-6 border-t border-gray-800">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 border border-gray-700 text-gray-300 rounded-lg hover:border-gray-600 transition-colors"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || quantityChange === 0 || newStockLevel < 0}
              className="px-6 py-2 bg-[#FFCC00] text-black font-medium rounded-lg hover:bg-[#FFD700] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Adjusting...
                </>
              ) : (
                <>
                  <Package className="w-4 h-4" />
                  Adjust Stock
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
