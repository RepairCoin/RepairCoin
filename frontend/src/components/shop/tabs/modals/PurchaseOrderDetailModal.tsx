"use client";

import { useState } from "react";
import type { PurchaseOrder } from "@/types/inventory";
import { X, Package, Calendar, Truck, FileText, DollarSign, CheckCircle, Clock, Download } from "lucide-react";
import { jsPDF } from "jspdf";
import { toast } from "react-hot-toast";

interface PurchaseOrderDetailModalProps {
  purchaseOrder: PurchaseOrder;
  onClose: () => void;
  onRefresh: () => void;
}

export function PurchaseOrderDetailModal({
  purchaseOrder,
  onClose,
}: PurchaseOrderDetailModalProps) {
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

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

  const handleDownloadPDF = async () => {
    try {
      setIsGeneratingPDF(true);

      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      let yPos = 20;

      // Header
      doc.setFontSize(20);
      doc.setFont("helvetica", "bold");
      doc.text("Purchase Order", pageWidth / 2, yPos, { align: "center" });

      yPos += 15;
      doc.setFontSize(16);
      doc.text(purchaseOrder.poNumber, pageWidth / 2, yPos, { align: "center" });

      // Status
      yPos += 10;
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Status: ${purchaseOrder.status.replace("_", " ").toUpperCase()}`, pageWidth / 2, yPos, { align: "center" });

      // Vendor and Dates Section
      yPos += 15;
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("Vendor Information", 15, yPos);

      yPos += 8;
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Vendor: ${purchaseOrder.vendorName || "N/A"}`, 15, yPos);

      yPos += 6;
      doc.text(`Order Date: ${purchaseOrder.orderDate ? new Date(purchaseOrder.orderDate).toLocaleDateString() : new Date(purchaseOrder.createdAt).toLocaleDateString()}`, 15, yPos);

      yPos += 6;
      doc.text(`Expected Delivery: ${purchaseOrder.expectedDeliveryDate ? new Date(purchaseOrder.expectedDeliveryDate).toLocaleDateString() : "Not set"}`, 15, yPos);

      if (purchaseOrder.receivedDate) {
        yPos += 6;
        doc.text(`Received Date: ${new Date(purchaseOrder.receivedDate).toLocaleDateString()}`, 15, yPos);
      }

      if (purchaseOrder.trackingNumber) {
        yPos += 6;
        doc.text(`Tracking Number: ${purchaseOrder.trackingNumber}`, 15, yPos);
      }

      // Items Section
      yPos += 15;
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("Order Items", 15, yPos);

      yPos += 8;
      doc.setFontSize(9);

      // Table headers
      doc.text("Item", 15, yPos);
      doc.text("Ordered", 100, yPos);
      doc.text("Received", 130, yPos);
      doc.text("Unit Cost", 160, yPos);
      doc.text("Total", 185, yPos);

      yPos += 2;
      doc.line(15, yPos, pageWidth - 15, yPos); // Line under headers

      yPos += 5;
      doc.setFont("helvetica", "normal");

      // Items
      for (const item of purchaseOrder.items) {
        if (yPos > 270) {
          doc.addPage();
          yPos = 20;
        }

        doc.text(item.itemName.length > 30 ? item.itemName.substring(0, 27) + "..." : item.itemName, 15, yPos);
        doc.text(item.quantityOrdered.toString(), 100, yPos);
        doc.text(item.quantityReceived.toString(), 130, yPos);
        doc.text(`$${Number(item.unitCost || 0).toFixed(2)}`, 160, yPos);
        doc.text(`$${Number(item.lineTotal || 0).toFixed(2)}`, 185, yPos);

        if (item.itemSku) {
          yPos += 4;
          doc.setFontSize(8);
          doc.setTextColor(128, 128, 128);
          doc.text(`SKU: ${item.itemSku}`, 15, yPos);
          doc.setTextColor(0, 0, 0);
          doc.setFontSize(9);
        }

        yPos += 6;
      }

      // Totals Section
      yPos += 10;
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }

      doc.line(15, yPos, pageWidth - 15, yPos);
      yPos += 8;

      doc.setFontSize(10);
      doc.text("Subtotal:", 140, yPos);
      doc.text(`$${Number(purchaseOrder.subtotal || 0).toFixed(2)}`, 185, yPos);

      if (Number(purchaseOrder.tax || 0) > 0) {
        yPos += 6;
        doc.text("Tax:", 140, yPos);
        doc.text(`$${Number(purchaseOrder.tax || 0).toFixed(2)}`, 185, yPos);
      }

      if (Number(purchaseOrder.shipping || 0) > 0) {
        yPos += 6;
        doc.text("Shipping:", 140, yPos);
        doc.text(`$${Number(purchaseOrder.shipping || 0).toFixed(2)}`, 185, yPos);
      }

      yPos += 8;
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("Total:", 140, yPos);
      doc.text(`$${Number(purchaseOrder.total || 0).toFixed(2)}`, 185, yPos);

      // Notes Section
      if (purchaseOrder.notes) {
        yPos += 15;
        if (yPos > 250) {
          doc.addPage();
          yPos = 20;
        }

        doc.setFontSize(12);
        doc.text("Notes:", 15, yPos);

        yPos += 8;
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");

        const splitNotes = doc.splitTextToSize(purchaseOrder.notes, pageWidth - 30);
        doc.text(splitNotes, 15, yPos);
      }

      // Footer
      const pageCount = doc.getNumberOfPages();
      doc.setFontSize(8);
      doc.setTextColor(128, 128, 128);
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.text(
          `Generated: ${new Date().toLocaleString()} | Page ${i} of ${pageCount}`,
          pageWidth / 2,
          doc.internal.pageSize.getHeight() - 10,
          { align: "center" }
        );
      }

      // Save PDF
      doc.save(`${purchaseOrder.poNumber}.pdf`);
      toast.success("PDF downloaded successfully!");
    } catch (error: unknown) {
      console.error("PDF generation failed:", error);

      if (error && typeof error === "object" && "message" in error) {
        const err = error as { message: string };
        toast.error(`Failed to generate PDF: ${err.message}`);
      } else {
        toast.error("Failed to generate PDF. Please try again.");
      }
    } finally {
      setIsGeneratingPDF(false);
    }
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
                        <span className="text-sm text-gray-300">${Number(item.unitCost || 0).toFixed(2)}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm font-medium text-white">
                          ${Number(item.lineTotal || 0).toFixed(2)}
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
              <span className="text-white font-medium">${Number(purchaseOrder.subtotal || 0).toFixed(2)}</span>
            </div>
            {Number(purchaseOrder.tax || 0) > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Tax:</span>
                <span className="text-white font-medium">${Number(purchaseOrder.tax || 0).toFixed(2)}</span>
              </div>
            )}
            {Number(purchaseOrder.shipping || 0) > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Shipping:</span>
                <span className="text-white font-medium">${Number(purchaseOrder.shipping || 0).toFixed(2)}</span>
              </div>
            )}
            <div className="pt-2 border-t border-gray-800 flex justify-between text-base">
              <span className="text-gray-300 font-semibold flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Total:
              </span>
              <span className="text-[#FFCC00] font-bold text-lg">
                ${Number(purchaseOrder.total || 0).toFixed(2)}
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

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-800">
            <button
              onClick={handleDownloadPDF}
              disabled={isGeneratingPDF}
              className="px-6 py-2 bg-[#FFCC00] text-black rounded-lg hover:bg-[#FFD700] transition-colors font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="w-4 h-4" />
              {isGeneratingPDF ? "Generating..." : "Download PDF"}
            </button>
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
