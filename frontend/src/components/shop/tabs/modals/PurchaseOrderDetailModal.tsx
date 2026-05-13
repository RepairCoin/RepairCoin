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
      draft: { bg: "bg-gray-100", text: "text-gray-700" },
      sent: { bg: "bg-blue-100", text: "text-blue-700" },
      confirmed: { bg: "bg-purple-100", text: "text-purple-700" },
      partially_received: { bg: "bg-orange-100", text: "text-orange-700" },
      received: { bg: "bg-green-100", text: "text-green-700" },
      cancelled: { bg: "bg-red-100", text: "text-red-700" },
    };

    const style = styles[purchaseOrder.status];

    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${style.bg} ${style.text}`}>
        {purchaseOrder.status.replace("_", " ").toUpperCase()}
      </span>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{purchaseOrder.poNumber}</h2>
            <p className="text-sm text-gray-600 mt-1">Purchase Order Details</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Status and Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-2">Status</label>
              {getStatusBadge()}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-500 mb-2">Vendor</label>
              <p className="text-base font-medium text-gray-900">{purchaseOrder.vendorName || "N/A"}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-500 mb-2 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Order Date
              </label>
              <p className="text-base text-gray-900">
                {purchaseOrder.orderDate
                  ? new Date(purchaseOrder.orderDate).toLocaleDateString()
                  : new Date(purchaseOrder.createdAt).toLocaleDateString()}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-500 mb-2 flex items-center gap-2">
                <Truck className="w-4 h-4" />
                Expected Delivery
              </label>
              <p className="text-base text-gray-900">
                {purchaseOrder.expectedDeliveryDate
                  ? new Date(purchaseOrder.expectedDeliveryDate).toLocaleDateString()
                  : "Not set"}
              </p>
            </div>

            {purchaseOrder.receivedDate && (
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-2 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  Received Date
                </label>
                <p className="text-base text-gray-900">
                  {new Date(purchaseOrder.receivedDate).toLocaleDateString()}
                </p>
              </div>
            )}

            {purchaseOrder.trackingNumber && (
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-2 flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  Tracking Number
                </label>
                <p className="text-base text-gray-900 font-mono">{purchaseOrder.trackingNumber}</p>
              </div>
            )}
          </div>

          {/* Notes */}
          {purchaseOrder.notes && (
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-2 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Notes
              </label>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-700">{purchaseOrder.notes}</p>
              </div>
            </div>
          )}

          {/* Items */}
          <div>
            <label className="block text-sm font-medium text-gray-500 mb-3 flex items-center gap-2">
              <Package className="w-4 h-4" />
              Order Items ({purchaseOrder.items.length})
            </label>

            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Item
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                      Ordered
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                      Received
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Unit Cost
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {purchaseOrder.items.map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-gray-900">{item.itemName}</div>
                        {item.itemSku && (
                          <div className="text-xs text-gray-500">SKU: {item.itemSku}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-sm text-gray-900">{item.quantityOrdered}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`text-sm font-medium ${
                            item.quantityReceived === item.quantityOrdered
                              ? "text-green-600"
                              : item.quantityReceived > 0
                              ? "text-orange-600"
                              : "text-gray-600"
                          }`}
                        >
                          {item.quantityReceived}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm text-gray-900">${item.unitCost.toFixed(2)}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm font-medium text-gray-900">
                          ${item.lineTotal.toFixed(2)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Totals */}
          <div className="bg-gray-50 p-4 rounded-lg space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Subtotal:</span>
              <span className="text-gray-900 font-medium">${purchaseOrder.subtotal.toFixed(2)}</span>
            </div>
            {purchaseOrder.tax > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Tax:</span>
                <span className="text-gray-900 font-medium">${purchaseOrder.tax.toFixed(2)}</span>
              </div>
            )}
            {purchaseOrder.shipping > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Shipping:</span>
                <span className="text-gray-900 font-medium">${purchaseOrder.shipping.toFixed(2)}</span>
              </div>
            )}
            <div className="pt-2 border-t border-gray-200 flex justify-between text-base">
              <span className="text-gray-700 font-semibold flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Total:
              </span>
              <span className="text-gray-900 font-bold text-lg">
                ${purchaseOrder.total.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Timeline */}
          <div>
            <label className="block text-sm font-medium text-gray-500 mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Timeline
            </label>
            <div className="space-y-3">
              <div className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                  </div>
                  <div className="w-0.5 h-full bg-gray-200 mt-1"></div>
                </div>
                <div className="flex-1 pb-3">
                  <p className="text-sm font-medium text-gray-900">Created</p>
                  <p className="text-xs text-gray-500">
                    {new Date(purchaseOrder.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>

              {purchaseOrder.receivedDate && (
                <div className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">Received</p>
                    <p className="text-xs text-gray-500">
                      {new Date(purchaseOrder.receivedDate).toLocaleString()}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Close Button */}
          <div className="flex justify-end pt-4 border-t border-gray-200">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
