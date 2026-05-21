"use client";

import type { PurchaseOrder } from "@/types/inventory";
import { X, Package, Calendar, Truck, FileText, DollarSign, CheckCircle, Clock } from "lucide-react";

interface PurchaseOrderDetailModalProps {
  purchaseOrder: PurchaseOrder;
  onClose: () => void;
  onRefresh: () => void;
}

export function PurchaseOrderDetailModal({
  purchaseOrder,
  onClose,
}: PurchaseOrderDetailModalProps) {
  const getStatusBadge = () => {
    const styles: Record<string, { bg: string; text: string }> = {
      draft: { bg: "bg-gray-800", text: "text-gray-300" },
      sent: { bg: "bg-blue-900/50", text: "text-blue-400" },
      confirmed: { bg: "bg-purple-900/50", text: "text-purple-400" },
      partially_received: { bg: "bg-orange-900/50", text: "text-orange-400" },
      received: { bg: "bg-green-900/50", text: "text-green-400" },
      cancelled: { bg: "bg-red-900/50", text: "text-red-400" },
    };

    const style = styles[purchaseOrder.status];

    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${style.bg} ${style.text}`}>
        {purchaseOrder.status.replace("_", " ").toUpperCase()}
      </span>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-[#1a1a1a] rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-gray-800">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-800 sticky top-0 bg-[#1a1a1a]">
          <div>
            <h2 className="text-xl font-bold text-white">{purchaseOrder.poNumber}</h2>
            <p className="text-sm text-gray-400 mt-1">Purchase Order Details</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[#252525] rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Status and Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Status</label>
              {getStatusBadge()}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Vendor</label>
              <p className="text-base font-medium text-white">{purchaseOrder.vendorName || "N/A"}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Order Date
              </label>
              <p className="text-base text-gray-300">
                {purchaseOrder.orderDate
                  ? new Date(purchaseOrder.orderDate).toLocaleDateString()
                  : new Date(purchaseOrder.createdAt).toLocaleDateString()}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2 flex items-center gap-2">
                <Truck className="w-4 h-4" />
                Expected Delivery
              </label>
              <p className="text-base text-gray-300">
                {purchaseOrder.expectedDeliveryDate
                  ? new Date(purchaseOrder.expectedDeliveryDate).toLocaleDateString()
                  : "Not set"}
              </p>
            </div>

            {purchaseOrder.receivedDate && (
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  Received Date
                </label>
                <p className="text-base text-gray-300">
                  {new Date(purchaseOrder.receivedDate).toLocaleDateString()}
                </p>
              </div>
            )}

            {purchaseOrder.trackingNumber && (
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2 flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  Tracking Number
                </label>
                <p className="text-base text-white font-mono">{purchaseOrder.trackingNumber}</p>
              </div>
            )}
          </div>

          {/* Notes */}
          {purchaseOrder.notes && (
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Notes
              </label>
              <div className="bg-[#0a0a0a] p-4 rounded-lg border border-gray-800">
                <p className="text-sm text-gray-300">{purchaseOrder.notes}</p>
              </div>
            </div>
          )}

          {/* Items */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
              <Package className="w-4 h-4" />
              Order Items ({purchaseOrder.items.length})
            </label>

            <div className="border border-gray-800 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-[#0a0a0a]">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                      Item
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase">
                      Ordered
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase">
                      Received
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">
                      Unit Cost
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {purchaseOrder.items.map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-white">{item.itemName}</div>
                        {item.itemSku && (
                          <div className="text-xs text-gray-500">SKU: {item.itemSku}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-sm text-gray-300">{item.quantityOrdered}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`text-sm font-medium ${
                            item.quantityReceived === item.quantityOrdered
                              ? "text-green-400"
                              : item.quantityReceived > 0
                              ? "text-orange-400"
                              : "text-gray-500"
                          }`}
                        >
                          {item.quantityReceived}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm text-gray-300">${parseFloat(item.unitCost as any).toFixed(2)}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm font-medium text-white">
                          ${parseFloat(item.lineTotal as any).toFixed(2)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Totals */}
          <div className="bg-[#0a0a0a] p-4 rounded-lg space-y-2 border border-gray-800">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Subtotal:</span>
              <span className="text-white font-medium">${parseFloat(purchaseOrder.subtotal as any).toFixed(2)}</span>
            </div>
            {parseFloat(purchaseOrder.tax as any) > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Tax:</span>
                <span className="text-white font-medium">${parseFloat(purchaseOrder.tax as any).toFixed(2)}</span>
              </div>
            )}
            {parseFloat(purchaseOrder.shipping as any) > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Shipping:</span>
                <span className="text-white font-medium">${parseFloat(purchaseOrder.shipping as any).toFixed(2)}</span>
              </div>
            )}
            <div className="pt-2 border-t border-gray-800 flex justify-between text-base">
              <span className="text-gray-300 font-semibold flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Total:
              </span>
              <span className="text-[#FFCC00] font-bold text-lg">
                ${parseFloat(purchaseOrder.total as any).toFixed(2)}
              </span>
            </div>
          </div>

          {/* Timeline */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Timeline
            </label>
            <div className="space-y-3">
              <div className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 rounded-full bg-green-900/30 flex items-center justify-center border border-green-700">
                    <CheckCircle className="w-4 h-4 text-green-400" />
                  </div>
                  <div className="w-0.5 h-full bg-gray-800 mt-1"></div>
                </div>
                <div className="flex-1 pb-3">
                  <p className="text-sm font-medium text-white">Created</p>
                  <p className="text-xs text-gray-500">
                    {new Date(purchaseOrder.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>

              {purchaseOrder.receivedDate && (
                <div className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="w-8 h-8 rounded-full bg-green-900/30 flex items-center justify-center border border-green-700">
                      <CheckCircle className="w-4 h-4 text-green-400" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white">Received</p>
                    <p className="text-xs text-gray-500">
                      {new Date(purchaseOrder.receivedDate).toLocaleString()}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Close Button */}
          <div className="flex justify-end pt-4 border-t border-gray-800">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-[#252525] text-gray-300 rounded-lg hover:bg-[#303030] transition-colors font-medium"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
