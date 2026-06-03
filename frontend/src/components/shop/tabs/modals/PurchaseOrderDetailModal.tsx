"use client";

import { useState } from "react";
import { inventoryApi } from "@/services/api/inventory";
import type { PurchaseOrder, PurchaseOrderStatus, InventoryVendor } from "@/types/inventory";
import { X, Package, Calendar, Truck, FileText, DollarSign, CheckCircle, Clock, Download, Send, Ban, Pencil, PackageCheck } from "lucide-react";
import { jsPDF } from "jspdf";
import { toast } from "react-hot-toast";
import { ReceiveItemsModal } from "./ReceiveItemsModal";

interface PurchaseOrderDetailModalProps {
  purchaseOrder: PurchaseOrder;
  vendors: InventoryVendor[];
  onClose: (changed?: boolean) => void;
}

const toDateInput = (value?: string) => (value ? new Date(value).toISOString().slice(0, 10) : "");

export function PurchaseOrderDetailModal({
  purchaseOrder,
  vendors,
  onClose,
}: PurchaseOrderDetailModalProps) {
  const [po, setPo] = useState<PurchaseOrder>(purchaseOrder);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [changed, setChanged] = useState(false);
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [form, setForm] = useState({
    vendorId: purchaseOrder.vendorId || "",
    expectedDeliveryDate: toDateInput(purchaseOrder.expectedDeliveryDate),
    trackingNumber: purchaseOrder.trackingNumber || "",
    notes: purchaseOrder.notes || "",
  });

  const isLocked = po.status === "received" || po.status === "cancelled";
  const canCancel = po.status === "draft" || po.status === "sent" || po.status === "confirmed";
  const canReceive = po.status === "confirmed" || po.status === "partially_received";
  const advance =
    po.status === "draft"
      ? { to: "sent" as PurchaseOrderStatus, label: "Mark as Sent", successMessage: "Purchase order marked as sent" }
      : po.status === "sent"
      ? { to: "confirmed" as PurchaseOrderStatus, label: "Mark as Confirmed", successMessage: "Purchase order confirmed" }
      : null;

  const busy = saving || updatingStatus;

  const statusRank: Record<PurchaseOrderStatus, number> = {
    draft: 0,
    sent: 1,
    confirmed: 2,
    partially_received: 3,
    received: 4,
    cancelled: 0,
  };

  const timelineSteps =
    po.status === "cancelled"
      ? [
          { label: "Created", icon: FileText, date: po.createdAt, reached: true, danger: false },
          { label: "Cancelled", icon: Ban, date: po.updatedAt, reached: true, danger: true },
        ]
      : [
          { label: "Created", icon: FileText, date: po.createdAt, reached: true, danger: false },
          { label: "Sent", icon: Send, date: undefined, reached: statusRank[po.status] >= 1, danger: false },
          { label: "Confirmed", icon: CheckCircle, date: undefined, reached: statusRank[po.status] >= 2, danger: false },
          {
            label: po.status === "partially_received" ? "Partially Received" : "Received",
            icon: Package,
            date: po.updatedAt,
            reached: statusRank[po.status] >= 3,
            danger: false,
          },
        ];

  const lastReachedIndex = timelineSteps.reduce((acc, step, i) => (step.reached ? i : acc), 0);

  const applyUpdate = (updated: PurchaseOrder) => {
    setPo(updated);
    setForm({
      vendorId: updated.vendorId || "",
      expectedDeliveryDate: toDateInput(updated.expectedDeliveryDate),
      trackingNumber: updated.trackingNumber || "",
      notes: updated.notes || "",
    });
    setChanged(true);
  };

  const handleAdvanceStatus = async () => {
    if (!advance) return;
    try {
      setUpdatingStatus(true);
      const updated = await inventoryApi.updatePurchaseOrder(po.shopId, po.id, { status: advance.to });
      applyUpdate(updated);
      toast.success(advance.successMessage);
    } catch (error) {
      console.error("Error updating purchase order status:", error);
      toast.error("Failed to update purchase order");
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleReceiveSuccess = async () => {
    setShowReceiveModal(false);
    try {
      const fresh = await inventoryApi.getPurchaseOrder(po.shopId, po.id);
      applyUpdate(fresh);
    } catch (error) {
      console.error("Error refreshing purchase order:", error);
      setChanged(true);
    }
    toast.success("Items received successfully");
  };

  const handleCancelOrder = async () => {
    if (!confirm(`Are you sure you want to cancel PO ${po.poNumber}?`)) return;
    try {
      setUpdatingStatus(true);
      const updated = await inventoryApi.cancelPurchaseOrder(po.shopId, po.id);
      applyUpdate(updated);
      toast.success("Purchase order cancelled");
    } catch (error) {
      console.error("Error cancelling purchase order:", error);
      toast.error("Failed to cancel purchase order");
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleSave = async () => {
    const selectedVendor = vendors.find((v) => v.id === form.vendorId);
    if (!selectedVendor) {
      toast.error("Please select a vendor");
      return;
    }
    try {
      setSaving(true);
      const updated = await inventoryApi.updatePurchaseOrder(po.shopId, po.id, {
        vendorId: selectedVendor.id,
        vendorName: selectedVendor.name,
        expectedDeliveryDate: form.expectedDeliveryDate || undefined,
        trackingNumber: form.trackingNumber || undefined,
        notes: form.notes || undefined,
      });
      applyUpdate(updated);
      setIsEditing(false);
      toast.success("Purchase order updated");
    } catch (error) {
      console.error("Error updating purchase order:", error);
      toast.error("Failed to update purchase order");
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setForm({
      vendorId: po.vendorId || "",
      expectedDeliveryDate: toDateInput(po.expectedDeliveryDate),
      trackingNumber: po.trackingNumber || "",
      notes: po.notes || "",
    });
    setIsEditing(false);
  };

  const getStatusBadge = () => {
    const styles: Record<string, { bg: string; text: string }> = {
      draft: { bg: "bg-gray-800", text: "text-gray-300" },
      sent: { bg: "bg-blue-900/50", text: "text-blue-400" },
      confirmed: { bg: "bg-purple-900/50", text: "text-purple-400" },
      partially_received: { bg: "bg-orange-900/50", text: "text-orange-400" },
      received: { bg: "bg-green-900/50", text: "text-green-400" },
      cancelled: { bg: "bg-red-900/50", text: "text-red-400" },
    };

    const style = styles[po.status];

    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${style.bg} ${style.text}`}>
        {po.status.replace("_", " ").toUpperCase()}
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
      doc.text(po.poNumber, pageWidth / 2, yPos, { align: "center" });

      // Status
      yPos += 10;
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Status: ${po.status.replace("_", " ").toUpperCase()}`, pageWidth / 2, yPos, { align: "center" });

      // Vendor and Dates Section
      yPos += 15;
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("Vendor Information", 15, yPos);

      yPos += 8;
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Vendor: ${po.vendorName || "N/A"}`, 15, yPos);

      yPos += 6;
      doc.text(`Order Date: ${po.orderDate ? new Date(po.orderDate).toLocaleDateString() : new Date(po.createdAt).toLocaleDateString()}`, 15, yPos);

      yPos += 6;
      doc.text(`Expected Delivery: ${po.expectedDeliveryDate ? new Date(po.expectedDeliveryDate).toLocaleDateString() : "Not set"}`, 15, yPos);

      if (po.receivedDate) {
        yPos += 6;
        doc.text(`Received Date: ${new Date(po.receivedDate).toLocaleDateString()}`, 15, yPos);
      }

      if (po.trackingNumber) {
        yPos += 6;
        doc.text(`Tracking Number: ${po.trackingNumber}`, 15, yPos);
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
      for (const item of po.items) {
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
      doc.text(`$${Number(po.subtotal || 0).toFixed(2)}`, 185, yPos);

      if (Number(po.tax || 0) > 0) {
        yPos += 6;
        doc.text("Tax:", 140, yPos);
        doc.text(`$${Number(po.tax || 0).toFixed(2)}`, 185, yPos);
      }

      if (Number(po.shipping || 0) > 0) {
        yPos += 6;
        doc.text("Shipping:", 140, yPos);
        doc.text(`$${Number(po.shipping || 0).toFixed(2)}`, 185, yPos);
      }

      yPos += 8;
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("Total:", 140, yPos);
      doc.text(`$${Number(po.total || 0).toFixed(2)}`, 185, yPos);

      // Notes Section
      if (po.notes) {
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

        const splitNotes = doc.splitTextToSize(po.notes, pageWidth - 30);
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
      doc.save(`${po.poNumber}.pdf`);
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

  const inputClass =
    "w-full h-10 px-3 py-2 bg-[#0a0a0a] border border-gray-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-[#FFCC00] focus:border-transparent";

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-[#1a1a1a] rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-gray-800">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-800 sticky top-0 bg-[#1a1a1a]">
          <div>
            <h2 className="text-xl font-bold text-white">{po.poNumber}</h2>
            <p className="text-sm text-gray-400 mt-1">Purchase Order Details</p>
          </div>
          <div className="flex items-center gap-2">
            {!isLocked && !isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-2 px-3 py-2 bg-[#252525] text-gray-200 rounded-lg hover:bg-[#303030] transition-colors text-sm font-medium"
              >
                <Pencil className="w-4 h-4" />
                Edit
              </button>
            )}
            <button
              onClick={() => onClose(changed)}
              className="p-2 hover:bg-[#252525] rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>
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
              {isEditing ? (
                <select
                  value={form.vendorId}
                  onChange={(e) => setForm({ ...form, vendorId: e.target.value })}
                  className={inputClass}
                >
                  <option value="" disabled>Select a vendor</option>
                  {vendors.map((vendor) => (
                    <option key={vendor.id} value={vendor.id}>
                      {vendor.name}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-base font-medium text-white">{po.vendorName || "N/A"}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Order Date
              </label>
              <p className="text-base text-gray-300">
                {po.orderDate
                  ? new Date(po.orderDate).toLocaleDateString()
                  : new Date(po.createdAt).toLocaleDateString()}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2 flex items-center gap-2">
                <Truck className="w-4 h-4" />
                Expected Delivery
              </label>
              {isEditing ? (
                <input
                  type="date"
                  value={form.expectedDeliveryDate}
                  onChange={(e) => setForm({ ...form, expectedDeliveryDate: e.target.value })}
                  className={inputClass}
                />
              ) : (
                <p className="text-base text-gray-300">
                  {po.expectedDeliveryDate
                    ? new Date(po.expectedDeliveryDate).toLocaleDateString()
                    : "Not set"}
                </p>
              )}
            </div>

            {po.receivedDate && (
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  Received Date
                </label>
                <p className="text-base text-gray-300">
                  {new Date(po.receivedDate).toLocaleDateString()}
                </p>
              </div>
            )}

            {(isEditing || po.trackingNumber) && (
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2 flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  Tracking Number
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    value={form.trackingNumber}
                    onChange={(e) => setForm({ ...form, trackingNumber: e.target.value })}
                    placeholder="Tracking number"
                    className={inputClass}
                  />
                ) : (
                  <p className="text-base text-white font-mono">{po.trackingNumber}</p>
                )}
              </div>
            )}
          </div>

          {/* Notes */}
          {(isEditing || po.notes) && (
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Notes
              </label>
              {isEditing ? (
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={3}
                  placeholder="Optional notes"
                  className="w-full px-3 py-2 bg-[#0a0a0a] border border-gray-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-[#FFCC00] focus:border-transparent resize-none"
                />
              ) : (
                <div className="bg-[#0a0a0a] p-4 rounded-lg border border-gray-800">
                  <p className="text-sm text-gray-300">{po.notes}</p>
                </div>
              )}
            </div>
          )}

          {/* Items */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
              <Package className="w-4 h-4" />
              Order Items ({po.items.length})
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
                  {po.items.map((item) => (
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
              <span className="text-white font-medium">${Number(po.subtotal || 0).toFixed(2)}</span>
            </div>
            {Number(po.tax || 0) > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Tax:</span>
                <span className="text-white font-medium">${Number(po.tax || 0).toFixed(2)}</span>
              </div>
            )}
            {Number(po.shipping || 0) > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Shipping:</span>
                <span className="text-white font-medium">${Number(po.shipping || 0).toFixed(2)}</span>
              </div>
            )}
            <div className="pt-2 border-t border-gray-800 flex justify-between text-base">
              <span className="text-gray-300 font-semibold flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Total:
              </span>
              <span className="text-[#FFCC00] font-bold text-lg">
                ${Number(po.total || 0).toFixed(2)}
              </span>
            </div>
          </div>

          {/* Timeline */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Timeline
            </label>
            <div>
              {timelineSteps.map((step, i) => {
                const isLast = i === timelineSteps.length - 1;
                const displayDate = step.date ?? (i === lastReachedIndex ? po.updatedAt : undefined);
                const StepIcon = step.icon;
                return (
                  <div key={step.label} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center border shrink-0 ${
                          step.reached
                            ? step.danger
                              ? "bg-red-900/30 border-red-700"
                              : "bg-green-900/30 border-green-700"
                            : "bg-[#0a0a0a] border-gray-700"
                        }`}
                      >
                        <StepIcon
                          className={`w-4 h-4 ${
                            step.danger ? "text-red-400" : step.reached ? "text-green-400" : "text-gray-600"
                          }`}
                        />
                      </div>
                      {!isLast && <div className="w-px flex-1 bg-gray-800 my-1"></div>}
                    </div>
                    <div className={`flex-1 pt-1 ${isLast ? "" : "pb-6"}`}>
                      <p className={`text-sm font-medium ${step.reached ? "text-white" : "text-gray-500"}`}>
                        {step.label}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5 min-h-[1rem]">
                        {step.reached && displayDate ? new Date(displayDate).toLocaleString() : ""}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap justify-end gap-3 pt-4 border-t border-gray-800">
            {isEditing ? (
              <>
                <button
                  onClick={handleCancelEdit}
                  disabled={busy}
                  className="px-6 py-2 bg-[#252525] text-gray-300 rounded-lg hover:bg-[#303030] transition-colors font-medium disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={busy}
                  className="px-6 py-2 bg-[#FFCC00] text-black rounded-lg hover:bg-[#FFD700] transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </>
            ) : (
              <>
                {canCancel && (
                  <button
                    onClick={handleCancelOrder}
                    disabled={busy}
                    className="px-6 py-2 bg-red-900/40 text-red-400 rounded-lg hover:bg-red-900/60 transition-colors font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Ban className="w-4 h-4" />
                    Cancel Order
                  </button>
                )}
                <button
                  onClick={handleDownloadPDF}
                  disabled={isGeneratingPDF}
                  className="px-6 py-2 bg-[#252525] text-gray-200 rounded-lg hover:bg-[#303030] transition-colors font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Download className="w-4 h-4" />
                  {isGeneratingPDF ? "Generating..." : "Download PDF"}
                </button>
                {advance && (
                  <button
                    onClick={handleAdvanceStatus}
                    disabled={busy}
                    className="px-6 py-2 bg-[#FFCC00] text-black rounded-lg hover:bg-[#FFD700] transition-colors font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Send className="w-4 h-4" />
                    {updatingStatus ? "Updating..." : advance.label}
                  </button>
                )}
                {canReceive && (
                  <button
                    onClick={() => setShowReceiveModal(true)}
                    disabled={busy}
                    className="px-6 py-2 bg-[#FFCC00] text-black rounded-lg hover:bg-[#FFD700] transition-colors font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <PackageCheck className="w-4 h-4" />
                    Receive Items
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {showReceiveModal && (
        <ReceiveItemsModal
          shopId={po.shopId}
          purchaseOrder={po}
          onClose={() => setShowReceiveModal(false)}
          onSuccess={handleReceiveSuccess}
        />
      )}
    </div>
  );
}
