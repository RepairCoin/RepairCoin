"use client";

import { useState } from "react";
import { inventoryApi } from "@/services/api/inventory";
import type { PurchaseOrder, ReceiveItemsData } from "@/types/inventory";
import { toast } from "react-hot-toast";
import { X, Package, CheckCircle, AlertCircle } from "lucide-react";

interface ReceiveItemsModalProps {
  shopId: string;
  purchaseOrder: PurchaseOrder;
  onClose: () => void;
  onSuccess: () => void;
}

interface ItemReceiveData {
  itemId: string;
  itemName: string;
  itemSku?: string;
  quantityOrdered: number;
  quantityReceived: number;
  quantityToReceive: number;
}

export function ReceiveItemsModal({
  shopId,
  purchaseOrder,
  onClose,
  onSuccess,
}: ReceiveItemsModalProps) {
  const [loading, setLoading] = useState(false);
  const [itemsData, setItemsData] = useState<ItemReceiveData[]>(
    purchaseOrder.items
      .filter((item) => item.quantityReceived < item.quantityOrdered)
      .map((item) => ({
        itemId: item.id,
        itemName: item.itemName,
        itemSku: item.itemSku,
        quantityOrdered: item.quantityOrdered,
        quantityReceived: item.quantityReceived,
        quantityToReceive: item.quantityOrdered - item.quantityReceived,
      }))
  );

  const updateQuantity = (itemId: string, quantity: number) => {
    setItemsData((prev) =>
      prev.map((item) =>
        item.itemId === itemId
          ? {
              ...item,
              quantityToReceive: Math.max(
                0,
                Math.min(quantity, item.quantityOrdered - item.quantityReceived)
              ),
            }
          : item
      )
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const itemsToReceive = itemsData.filter((item) => item.quantityToReceive > 0);

    if (itemsToReceive.length === 0) {
      toast.error("Please specify quantities to receive");
      return;
    }

    try {
      setLoading(true);
      const data: ReceiveItemsData = {
        items: itemsToReceive.map((item) => ({
          itemId: item.itemId,
          quantityReceived: item.quantityToReceive,
        })),
      };

      await inventoryApi.receiveItems(shopId, purchaseOrder.id, data);
      onSuccess();
    } catch (error) {
      console.error("Error receiving items:", error);
      toast.error("Failed to receive items");
    } finally {
      setLoading(false);
    }
  };

  const getTotalToReceive = () => {
    return itemsData.reduce((sum, item) => sum + item.quantityToReceive, 0);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Receive Items</h2>
            <p className="text-sm text-gray-600 mt-1">PO: {purchaseOrder.poNumber}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Info Banner */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">Receiving Items</p>
              <p>
                Enter the quantity received for each item. Stock will be automatically updated when you
                confirm.
              </p>
            </div>
          </div>

          {/* Items List */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
              <Package className="w-4 h-4" />
              Items to Receive ({itemsData.length})
            </label>

            <div className="space-y-3">
              {itemsData.map((item) => (
                <div
                  key={item.itemId}
                  className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">{item.itemName}</h4>
                      {item.itemSku && (
                        <p className="text-xs text-gray-500 mt-0.5">SKU: {item.itemSku}</p>
                      )}
                      <div className="flex gap-4 mt-2 text-sm">
                        <span className="text-gray-600">
                          Ordered: <span className="font-medium text-gray-900">{item.quantityOrdered}</span>
                        </span>
                        <span className="text-gray-600">
                          Already Received:{" "}
                          <span className="font-medium text-gray-900">{item.quantityReceived}</span>
                        </span>
                        <span className="text-gray-600">
                          Remaining:{" "}
                          <span className="font-medium text-orange-600">
                            {item.quantityOrdered - item.quantityReceived}
                          </span>
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <label className="text-sm font-medium text-gray-700">Receive:</label>
                      <input
                        type="number"
                        min="0"
                        max={item.quantityOrdered - item.quantityReceived}
                        value={item.quantityToReceive}
                        onChange={(e) => updateQuantity(item.itemId, parseInt(e.target.value) || 0)}
                        className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FFCC00] focus:border-transparent text-center font-medium"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          updateQuantity(item.itemId, item.quantityOrdered - item.quantityReceived)
                        }
                        className="text-sm text-[#FFCC00] hover:text-[#FFD700] font-medium whitespace-nowrap"
                      >
                        All
                      </button>
                    </div>
                  </div>

                  {item.quantityToReceive > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-200 flex items-center gap-2 text-sm">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <span className="text-green-700 font-medium">
                        Will receive {item.quantityToReceive} {item.quantityToReceive === 1 ? "unit" : "units"}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Summary */}
          {getTotalToReceive() > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span className="font-medium text-green-900">Total Units to Receive:</span>
                </div>
                <span className="text-2xl font-bold text-green-900">{getTotalToReceive()}</span>
              </div>
              <p className="text-sm text-green-700 mt-2">
                Inventory stock will be automatically updated for these items
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || getTotalToReceive() === 0}
              className="flex-1 px-4 py-2 bg-[#FFCC00] text-black rounded-lg hover:bg-[#FFD700] transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Processing..." : `Receive ${getTotalToReceive()} Items`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
