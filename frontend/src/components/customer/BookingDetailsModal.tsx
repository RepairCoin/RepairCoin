"use client";

import React, { useState } from "react";
import {
  X,
  Download,
  Printer,
  Calendar,
  Clock,
  MapPin,
  Phone,
  Mail,
  Store,
  DollarSign,
  ShoppingBag,
  CheckCircle,
  Package,
  Loader2,
} from "lucide-react";
import { ServiceOrderWithDetails } from "@/services/api/services";
import { formatBookingId } from "@/utils/formatters";

interface BookingDetailsModalProps {
  order: ServiceOrderWithDetails;
  isOpen: boolean;
  onClose: () => void;
}

export const BookingDetailsModal: React.FC<BookingDetailsModalProps> = ({
  order,
  isOpen,
  onClose,
}) => {
  const [isDownloading, setIsDownloading] = useState(false);

  if (!isOpen) return null;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "2-digit",
      year: "numeric",
    });
  };

  const formatTime = (dateString: string | null) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const getStatusInfo = (status: string) => {
    switch (status) {
      case "pending":
        return {
          color: "text-yellow-400",
          bgColor: "bg-yellow-500/10",
          borderColor: "border-yellow-500/30",
          label: "⏳ Pending Approval",
        };
      case "paid":
        return {
          color: "text-blue-400",
          bgColor: "bg-blue-500/10",
          borderColor: "border-blue-500/30",
          label: "💳 Payment Confirmed",
        };
      case "approved":
        return {
          color: "text-green-400",
          bgColor: "bg-green-500/10",
          borderColor: "border-green-500/30",
          label: "✅ Approved",
        };
      case "scheduled":
        return {
          color: "text-purple-400",
          bgColor: "bg-purple-500/10",
          borderColor: "border-purple-500/30",
          label: "📅 Scheduled",
        };
      case "completed":
        return {
          color: "text-green-400",
          bgColor: "bg-green-500/10",
          borderColor: "border-green-500/30",
          label: "✅ Completed",
        };
      case "cancelled":
        return {
          color: "text-gray-400",
          bgColor: "bg-gray-500/10",
          borderColor: "border-gray-500/30",
          label: "❌ Cancelled",
        };
      default:
        return {
          color: "text-gray-400",
          bgColor: "bg-gray-500/10",
          borderColor: "border-gray-500/30",
          label: status,
        };
    }
  };

  // Shared receipt HTML generator for both print and download
  const getReceiptHTML = () => `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Receipt - ${formatBookingId(order.orderId)}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: Arial, sans-serif;
          padding: 15px;
          max-width: 800px;
          margin: 0 auto;
          color: #333;
          background: #fff;
          font-size: 13px;
        }
        .header {
          text-align: center;
          border-bottom: 2px solid #333;
          padding-bottom: 10px;
          margin-bottom: 12px;
        }
        .header h1 { font-size: 20px; margin-bottom: 3px; }
        .header .booking-id { color: #666; font-size: 12px; margin-top: 3px; }
        .status {
          display: inline-block;
          padding: 5px 12px;
          background: #e8f5e9;
          border-radius: 15px;
          margin: 6px 0;
          font-weight: bold;
          color: #2e7d32;
          font-size: 12px;
        }
        .section {
          margin-bottom: 10px;
          padding: 10px;
          border: 1px solid #ddd;
          border-radius: 6px;
        }
        .section-title {
          font-size: 14px;
          font-weight: bold;
          margin-bottom: 6px;
          color: #333;
          border-bottom: 1px solid #eee;
          padding-bottom: 5px;
        }
        .row {
          display: flex;
          justify-content: space-between;
          padding: 3px 0;
        }
        .row.total {
          border-top: 2px solid #333;
          margin-top: 6px;
          padding-top: 6px;
          font-weight: bold;
          font-size: 15px;
        }
        .label { color: #666; }
        .value { font-weight: 500; }
        .highlight {
          background: #fff8e1;
          padding: 8px;
          border-radius: 6px;
          margin-top: 6px;
          border: 1px solid #ffc107;
        }
        .highlight .value { color: #f57c00; font-weight: bold; }
        .footer {
          text-align: center;
          margin-top: 12px;
          padding: 10px 0 15px 0;
          border-top: 1px solid #ddd;
          color: #666;
          font-size: 11px;
        }
        @media print {
          body { padding: 10px; }
          .section { break-inside: avoid; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>RepairCoin Receipt</h1>
        <div class="booking-id">Booking ID: ${formatBookingId(order.orderId)}</div>
        <div class="status">${statusInfo.label}</div>
      </div>

      <div class="section">
        <div class="section-title">Service Details</div>
        <div class="row">
          <span class="label">Service</span>
          <span class="value">${order.serviceName}</span>
        </div>
        <div class="row">
          <span class="label">Shop</span>
          <span class="value">${order.shopName}</span>
        </div>
        ${order.shopAddress ? `
        <div class="row">
          <span class="label">Address</span>
          <span class="value">${order.shopAddress}${order.shopCity ? `, ${order.shopCity}` : ''}</span>
        </div>
        ` : ''}
      </div>

      ${order.bookingTimeSlot ? `
      <div class="section">
        <div class="section-title">Appointment</div>
        <div class="row">
          <span class="label">Date</span>
          <span class="value">${formatDate(order.bookingTimeSlot)}</span>
        </div>
        <div class="row">
          <span class="label">Time</span>
          <span class="value">${formatTime(order.bookingTimeSlot)}</span>
        </div>
      </div>
      ` : ''}

      <div class="section">
        <div class="section-title">Payment Summary</div>
        <div class="row">
          <span class="label">Subtotal</span>
          <span class="value">$${order.totalAmount.toFixed(2)}</span>
        </div>
        ${order.rcnRedeemed > 0 ? `
        <div class="row">
          <span class="label">RCN Redeemed</span>
          <span class="value">${order.rcnRedeemed.toFixed(2)} RCN</span>
        </div>
        <div class="row">
          <span class="label">RCN Discount</span>
          <span class="value" style="color: #2e7d32;">-$${order.rcnDiscountUsd?.toFixed(2) || '0.00'}</span>
        </div>
        ` : ''}
        <div class="row total">
          <span>Total Paid</span>
          <span>$${order.finalAmountUsd?.toFixed(2) || order.totalAmount.toFixed(2)}</span>
        </div>
        ${order.rcnEarned > 0 && order.status === 'completed' ? `
        <div class="highlight">
          <div class="row">
            <span class="label">RCN Earned</span>
            <span class="value">+${order.rcnEarned.toFixed(2)} RCN</span>
          </div>
        </div>
        ` : ''}
      </div>

      <div class="section">
        <div class="section-title">Booking Information</div>
        <div class="row">
          <span class="label">Booking Date</span>
          <span class="value">${formatDate(order.createdAt)}</span>
        </div>
        <div class="row">
          <span class="label">Order ID</span>
          <span class="value" style="font-family: monospace; font-size: 9px;">${order.orderId}</span>
        </div>
      </div>

      <div class="footer">
        <p>Thank you for using RepairCoin!</p>
        <p style="font-size: 10px;">www.repaircoin.com</p>
      </div>
    </body>
    </html>
  `;

  const handlePrint = () => {
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) {
      alert('Please allow popups to print the receipt');
      return;
    }

    printWindow.document.write(getReceiptHTML());
    printWindow.document.close();

    printWindow.onload = () => {
      printWindow.print();
      printWindow.onafterprint = () => printWindow.close();
    };
  };

  const handleDownload = async () => {
    setIsDownloading(true);

    try {
      // Dynamic import of jsPDF
      const jsPDFModule = await import('jspdf');
      const { jsPDF } = jsPDFModule;

      if (!jsPDF) {
        console.error('jsPDF failed to load');
        alert('Failed to load PDF library. Please try again.');
        return;
      }

      const doc = new jsPDF({ unit: 'mm', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();
      let y = 15;

      // Helper functions
      const addText = (text: string, x: number, yPos: number, options: { fontSize?: number; fontStyle?: string; color?: number[]; align?: 'left' | 'center' | 'right'; maxWidth?: number } = {}) => {
        const fontSize = options.fontSize || 10;
        doc.setFontSize(fontSize);
        doc.setFont('helvetica', (options.fontStyle || 'normal') as 'normal' | 'bold' | 'italic' | 'bolditalic');
        if (options.color && options.color.length >= 3) {
          doc.setTextColor(options.color[0], options.color[1], options.color[2]);
        } else {
          doc.setTextColor(51, 51, 51);
        }

        // Calculate actual x position based on alignment
        let actualX = x;
        if (options.align === 'center') {
          const textWidth = doc.getTextWidth(text);
          actualX = x - (textWidth / 2);
        } else if (options.align === 'right') {
          const textWidth = doc.getTextWidth(text);
          actualX = x - textWidth;
        }

        if (options.maxWidth) {
          doc.text(text, actualX, yPos, { maxWidth: options.maxWidth });
        } else {
          doc.text(text, actualX, yPos);
        }
      };

      const addSection = (title: string) => {
        y += 4;
        doc.setDrawColor(221, 221, 221);
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(15, y, pageWidth - 30, 8, 1, 1, 'S');
        addText(title, 18, y + 5.5, { fontSize: 11, fontStyle: 'bold' });
        y += 12;
      };

      const addRow = (label: string, value: string, valueColor?: number[]) => {
        addText(label, 18, y, { fontSize: 9, color: [102, 102, 102] });
        addText(value, pageWidth - 18, y, { fontSize: 9, fontStyle: 'bold', align: 'right', color: valueColor });
        y += 5;
      };

      // Header
      addText('RepairCoin Receipt', pageWidth / 2, y, { fontSize: 18, fontStyle: 'bold', align: 'center' });
      y += 6;
      addText(`Booking ID: ${formatBookingId(order.orderId)}`, pageWidth / 2, y, { fontSize: 9, color: [102, 102, 102], align: 'center' });
      y += 6;

      // Status badge
      const statusText = statusInfo.label.replace(/[^\w\s]/g, '').trim();
      doc.setFillColor(232, 245, 233);
      doc.roundedRect(pageWidth / 2 - 15, y - 3, 30, 7, 2, 2, 'F');
      addText(statusText, pageWidth / 2, y + 1.5, { fontSize: 8, fontStyle: 'bold', color: [46, 125, 50], align: 'center' });
      y += 10;

      // Divider
      doc.setDrawColor(51, 51, 51);
      doc.line(15, y, pageWidth - 15, y);
      y += 6;

      // Service Details
      addSection('Service Details');
      addRow('Service', order.serviceName);
      addRow('Shop', order.shopName);
      if (order.shopAddress) {
        const addr = `${order.shopAddress}${order.shopCity ? `, ${order.shopCity}` : ''}`;
        addRow('Address', addr.length > 50 ? addr.substring(0, 50) + '...' : addr);
      }

      // Appointment (if exists)
      if (order.bookingTimeSlot) {
        addSection('Appointment');
        addRow('Date', formatDate(order.bookingTimeSlot));
        addRow('Time', formatTime(order.bookingTimeSlot) || 'N/A');
      }

      // Payment Summary
      addSection('Payment Summary');
      addRow('Subtotal', `$${order.totalAmount.toFixed(2)}`);
      if (order.rcnRedeemed > 0) {
        addRow('RCN Redeemed', `${order.rcnRedeemed.toFixed(2)} RCN`, [255, 152, 0]);
        addRow('RCN Discount', `-$${order.rcnDiscountUsd?.toFixed(2) || '0.00'}`, [46, 125, 50]);
      }
      y += 2;
      doc.setDrawColor(51, 51, 51);
      doc.line(18, y, pageWidth - 18, y);
      y += 5;
      addText('Total Paid', 18, y, { fontSize: 11, fontStyle: 'bold' });
      addText(`$${order.finalAmountUsd?.toFixed(2) || order.totalAmount.toFixed(2)}`, pageWidth - 18, y, { fontSize: 11, fontStyle: 'bold', align: 'right', color: [46, 125, 50] });
      y += 7;

      // RCN Earned (if completed)
      if (order.rcnEarned > 0 && order.status === 'completed') {
        doc.setFillColor(255, 248, 225);
        doc.setDrawColor(255, 193, 7);
        doc.roundedRect(18, y, pageWidth - 36, 10, 2, 2, 'FD');
        addText('RCN Earned', 22, y + 6, { fontSize: 10, fontStyle: 'bold', color: [245, 124, 0] });
        addText(`+${order.rcnEarned.toFixed(2)} RCN`, pageWidth - 22, y + 6, { fontSize: 10, fontStyle: 'bold', align: 'right', color: [245, 124, 0] });
        y += 14;
      }

      // Booking Information
      addSection('Booking Information');
      addRow('Booking Date', formatDate(order.createdAt));
      addText(`Order ID: ${order.orderId}`, 18, y, { fontSize: 7, color: [102, 102, 102] });
      y += 10;

      // Footer
      doc.setDrawColor(221, 221, 221);
      doc.line(15, y, pageWidth - 15, y);
      y += 6;
      addText('Thank you for using RepairCoin!', pageWidth / 2, y, { fontSize: 9, color: [102, 102, 102], align: 'center' });
      y += 4;
      addText('www.repaircoin.com', pageWidth / 2, y, { fontSize: 8, color: [102, 102, 102], align: 'center' });

      // Save
      doc.save(`receipt-${formatBookingId(order.orderId)}.pdf`);
    } catch (error) {
      console.error('PDF generation error:', error);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  };

  // Get effective status (auto-approved shows as scheduled)
  const effectiveStatus = (order.status === "paid" && order.shopApproved) ? "scheduled" : order.status;
  const statusInfo = getStatusInfo(effectiveStatus);

  // Order timeline based on status
  // With auto-approval: status="paid" + shopApproved=true means approved & scheduled
  const getTimeline = () => {
    const isAutoApproved = order.status === "paid" && order.shopApproved === true;
    const isApproved = isAutoApproved || order.status === "approved" || order.status === "scheduled" || order.status === "completed";
    const isScheduled = isAutoApproved || order.status === "scheduled" || order.status === "completed";

    const timeline = [
      {
        label: "Booking Created",
        date: order.createdAt,
        completed: true,
        icon: <ShoppingBag className="w-5 h-5" />,
      },
      {
        label: "Payment Confirmed",
        date: order.status !== "pending" ? order.createdAt : null,
        completed: order.status !== "pending" && order.status !== "cancelled",
        icon: <DollarSign className="w-5 h-5" />,
      },
      {
        label: "Approved by Shop",
        date: isApproved ? (order.approvedAt || order.createdAt) : null,
        completed: isApproved,
        icon: <CheckCircle className="w-5 h-5" />,
      },
      {
        label: "Service Scheduled",
        date: isScheduled ? order.bookingTimeSlot : null,
        completed: isScheduled,
        icon: <Calendar className="w-5 h-5" />,
      },
      {
        label: "Service Completed",
        date: order.completedAt || null,
        completed: order.status === "completed",
        icon: <Package className="w-5 h-5" />,
      },
    ];

    return timeline.filter((item) => order.status !== "cancelled" || item.completed);
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-[#1A1A1A] rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-gray-800 shadow-2xl">
          {/* Header */}
          <div className="sticky top-0 bg-[#1A1A1A] border-b border-gray-800 px-6 py-5 flex items-center justify-between z-10">
            <div>
              <h2 className="text-2xl font-bold text-white">Booking Details</h2>
              <p className="text-sm text-gray-400 mt-1">
                Booking ID: <span className="font-mono text-gray-300">{formatBookingId(order.orderId)}</span>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleDownload}
                disabled={isDownloading}
                className={`p-2 rounded-lg transition-colors ${
                  isDownloading
                    ? "text-[#FFCC00] cursor-wait"
                    : "hover:bg-gray-800 text-gray-400 hover:text-white"
                }`}
                title={isDownloading ? "Generating PDF..." : "Download Receipt"}
              >
                {isDownloading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Download className="w-5 h-5" />
                )}
              </button>
              <button
                onClick={handlePrint}
                className="p-2 hover:bg-gray-800 rounded-lg transition-colors text-gray-400 hover:text-white"
                title="Print Receipt"
              >
                <Printer className="w-5 h-5" />
              </button>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-800 rounded-lg transition-colors text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Status Badge */}
            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full font-bold border ${statusInfo.bgColor} ${statusInfo.borderColor} ${statusInfo.color}`}>
              {statusInfo.label}
            </div>

            {/* Service Details */}
            <div className="bg-[#0D0D0D] border border-gray-800 rounded-xl p-6">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-[#FFCC00]" />
                Service Details
              </h3>
              <div className="flex gap-4">
                {/* Service Image */}
                {order.serviceImageUrl ? (
                  <div className="w-32 h-32 rounded-xl overflow-hidden bg-gray-800 flex-shrink-0">
                    <img
                      src={order.serviceImageUrl}
                      alt={order.serviceName}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="w-32 h-32 rounded-xl bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center flex-shrink-0">
                    <ShoppingBag className="w-12 h-12 text-gray-600" />
                  </div>
                )}
                {/* Service Info */}
                <div className="flex-1">
                  <h4 className="text-xl font-bold text-white mb-2">{order.serviceName}</h4>
                  {order.serviceDescription && (
                    <p className="text-sm text-gray-400 mb-3">{order.serviceDescription}</p>
                  )}
                  <div className="text-2xl font-bold text-green-400">
                    ${order.totalAmount.toFixed(2)}
                  </div>
                </div>
              </div>
            </div>

            {/* Shop Information */}
            <div className="bg-[#0D0D0D] border border-gray-800 rounded-xl p-6">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Store className="w-5 h-5 text-[#FFCC00]" />
                Shop Information
              </h3>
              <div className="space-y-3">
                <div>
                  <div className="text-sm text-gray-400 mb-1">Shop Name</div>
                  <div className="text-white font-semibold">{order.shopName}</div>
                </div>
                {order.shopAddress && (
                  <div>
                    <div className="text-sm text-gray-400 mb-1 flex items-center gap-1">
                      <MapPin className="w-4 h-4" />
                      Address
                    </div>
                    <div className="text-white">
                      {order.shopAddress}
                      {order.shopCity && `, ${order.shopCity}`}
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  {order.shopPhone && (
                    <div>
                      <div className="text-sm text-gray-400 mb-1 flex items-center gap-1">
                        <Phone className="w-4 h-4" />
                        Phone
                      </div>
                      <div className="text-white">{order.shopPhone}</div>
                    </div>
                  )}
                  {order.shopEmail && (
                    <div>
                      <div className="text-sm text-gray-400 mb-1 flex items-center gap-1">
                        <Mail className="w-4 h-4" />
                        Email
                      </div>
                      <div className="text-white">{order.shopEmail}</div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Appointment Details */}
            {order.bookingTimeSlot && (
              <div className="bg-[#0D0D0D] border border-gray-800 rounded-xl p-6">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-[#FFCC00]" />
                  Appointment Details
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-gray-400 mb-1 flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      Date
                    </div>
                    <div className="text-white font-semibold">
                      {formatDate(order.bookingTimeSlot)}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-400 mb-1 flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      Time
                    </div>
                    <div className="text-white font-semibold">
                      {formatTime(order.bookingTimeSlot)}
                    </div>
                  </div>
                </div>
                {order.notes && (
                  <div className="mt-4">
                    <div className="text-sm text-gray-400 mb-1">Notes</div>
                    <div className="text-white bg-gray-800/50 rounded-lg p-3">
                      {order.notes}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Payment Breakdown */}
            <div className="bg-[#0D0D0D] border border-gray-800 rounded-xl p-6">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-[#FFCC00]" />
                Payment Breakdown
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Subtotal</span>
                  <span className="text-white font-semibold">
                    ${order.totalAmount.toFixed(2)}
                  </span>
                </div>
                {order.rcnRedeemed > 0 && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400 flex items-center gap-2">
                        <span className="text-xl">🪙</span>
                        RCN Redeemed
                      </span>
                      <span className="text-[#FFCC00] font-semibold">
                        {order.rcnRedeemed.toFixed(2)} RCN
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">RCN Discount</span>
                      <span className="text-green-400 font-semibold">
                        -${order.rcnDiscountUsd?.toFixed(2) || "0.00"}
                      </span>
                    </div>
                  </>
                )}
                <div className="border-t border-gray-700 pt-3 mt-3">
                  <div className="flex items-center justify-between">
                    <span className="text-white font-bold text-lg">Final Amount</span>
                    <span className="text-green-400 font-bold text-xl">
                      ${order.finalAmountUsd?.toFixed(2) || order.totalAmount.toFixed(2)}
                    </span>
                  </div>
                </div>
                {order.rcnEarned > 0 && order.status === "completed" && (
                  <div className="bg-gradient-to-r from-[#FFCC00]/20 to-[#FFD700]/10 border border-[#FFCC00]/30 rounded-lg p-4 mt-4">
                    <div className="flex items-center justify-between">
                      <span className="text-[#FFCC00] font-semibold flex items-center gap-2">
                        <span className="text-2xl">🪙</span>
                        RCN Earned
                      </span>
                      <span className="text-[#FFCC00] font-bold text-xl">
                        +{order.rcnEarned.toFixed(2)} RCN
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      RepairCoin rewards added to your balance
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Order Timeline */}
            <div className="bg-[#0D0D0D] border border-gray-800 rounded-xl p-6">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-[#FFCC00]" />
                Order Timeline
              </h3>
              <div className="space-y-4">
                {getTimeline().map((item, index) => (
                  <div key={index} className="flex items-start gap-4">
                    {/* Icon */}
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                        item.completed
                          ? "bg-green-500/20 text-green-400"
                          : "bg-gray-700 text-gray-500"
                      }`}
                    >
                      {item.icon}
                    </div>
                    {/* Content */}
                    <div className="flex-1">
                      <div
                        className={`font-semibold ${
                          item.completed ? "text-white" : "text-gray-500"
                        }`}
                      >
                        {item.label}
                      </div>
                      {item.date && (
                        <div className="text-sm text-gray-400 mt-1">
                          {formatDate(item.date)}
                          {item.date && formatTime(item.date) && ` at ${formatTime(item.date)}`}
                        </div>
                      )}
                      {!item.completed && !item.date && (
                        <div className="text-sm text-gray-500 mt-1">Pending</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Booking Info */}
            <div className="bg-[#0D0D0D] border border-gray-800 rounded-xl p-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-gray-400 mb-1">Booking ID</div>
                  <div className="text-white font-mono">{formatBookingId(order.orderId)}</div>
                </div>
                <div>
                  <div className="text-gray-400 mb-1">Booking Date</div>
                  <div className="text-white">{formatDate(order.createdAt)}</div>
                </div>
                {order.stripePaymentIntentId && (
                  <div className="col-span-2">
                    <div className="text-gray-400 mb-1">Payment ID</div>
                    <div className="text-white font-mono text-xs break-all">
                      {order.stripePaymentIntentId}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 bg-[#1A1A1A] border-t border-gray-800 px-6 py-4">
            <button
              onClick={onClose}
              className="w-full bg-[#FFCC00] text-black font-bold py-3 rounded-lg hover:bg-[#FFD700] transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
