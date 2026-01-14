# Task: Receipt Print & Download Enhancement

## Overview
Enhanced the booking receipt functionality with proper print layout and professional PDF download.

## Problems Solved

### 1. Print Receipt Generating 24 Pages
**Issue:** Clicking print button caused `window.print()` to print the entire page including sidebar, modal backdrop, and all page content - resulting in 24 pages.

**Root Cause:** Using `window.print()` on the main window printed everything, not just the receipt content.

**Solution:** Open a new browser window with dedicated receipt-only HTML content.

### 2. Download Receipt Was Plain Text
**Issue:** Download button generated a `.txt` file instead of a professional PDF.

**Solution:** Implemented jsPDF for programmatic PDF generation matching the print layout.

### 3. Loading State During PDF Generation
**Issue:** No visual feedback during PDF generation process.

**Solution:** Added loading spinner on download button with disabled state.

---

## Implementation

### File Modified
`frontend/src/components/customer/BookingDetailsModal.tsx`

### Dependencies
```bash
# jsPDF is already installed via html2pdf.js dependency
npm list jspdf
# jspdf@4.0.0
```

---

## Code Snippets

### 1. Shared Receipt HTML Template (for Print)

```typescript
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
```

### 2. Print Handler (New Window Approach)

```typescript
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
```

### 3. PDF Download Handler (jsPDF Direct Drawing)

```typescript
const [isDownloading, setIsDownloading] = useState(false);

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
    const addText = (
      text: string,
      x: number,
      yPos: number,
      options: {
        fontSize?: number;
        fontStyle?: string;
        color?: number[];
        align?: 'left' | 'center' | 'right';
        maxWidth?: number;
      } = {}
    ) => {
      const fontSize = options.fontSize || 10;
      doc.setFontSize(fontSize);
      doc.setFont('helvetica', (options.fontStyle || 'normal') as 'normal' | 'bold');
      if (options.color && options.color.length >= 3) {
        doc.setTextColor(options.color[0], options.color[1], options.color[2]);
      } else {
        doc.setTextColor(51, 51, 51);
      }

      // Calculate actual x position based on alignment
      let actualX = x;
      if (options.align === 'center') {
        const textWidth = doc.getTextWidth(text);
        actualX = x - textWidth / 2;
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
      addText(value, pageWidth - 18, y, {
        fontSize: 9,
        fontStyle: 'bold',
        align: 'right',
        color: valueColor,
      });
      y += 5;
    };

    // Header
    addText('RepairCoin Receipt', pageWidth / 2, y, {
      fontSize: 18,
      fontStyle: 'bold',
      align: 'center',
    });
    y += 6;
    addText(`Booking ID: ${formatBookingId(order.orderId)}`, pageWidth / 2, y, {
      fontSize: 9,
      color: [102, 102, 102],
      align: 'center',
    });
    y += 6;

    // Status badge
    const statusText = statusInfo.label.replace(/[^\w\s]/g, '').trim();
    doc.setFillColor(232, 245, 233);
    doc.roundedRect(pageWidth / 2 - 15, y - 3, 30, 7, 2, 2, 'F');
    addText(statusText, pageWidth / 2, y + 1.5, {
      fontSize: 8,
      fontStyle: 'bold',
      color: [46, 125, 50],
      align: 'center',
    });
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
    addText(`$${order.finalAmountUsd?.toFixed(2) || order.totalAmount.toFixed(2)}`, pageWidth - 18, y, {
      fontSize: 11,
      fontStyle: 'bold',
      align: 'right',
      color: [46, 125, 50],
    });
    y += 7;

    // RCN Earned (if completed)
    if (order.rcnEarned > 0 && order.status === 'completed') {
      doc.setFillColor(255, 248, 225);
      doc.setDrawColor(255, 193, 7);
      doc.roundedRect(18, y, pageWidth - 36, 10, 2, 2, 'FD');
      addText('RCN Earned', 22, y + 6, {
        fontSize: 10,
        fontStyle: 'bold',
        color: [245, 124, 0],
      });
      addText(`+${order.rcnEarned.toFixed(2)} RCN`, pageWidth - 22, y + 6, {
        fontSize: 10,
        fontStyle: 'bold',
        align: 'right',
        color: [245, 124, 0],
      });
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
    addText('Thank you for using RepairCoin!', pageWidth / 2, y, {
      fontSize: 9,
      color: [102, 102, 102],
      align: 'center',
    });
    y += 4;
    addText('www.repaircoin.com', pageWidth / 2, y, {
      fontSize: 8,
      color: [102, 102, 102],
      align: 'center',
    });

    // Save
    doc.save(`receipt-${formatBookingId(order.orderId)}.pdf`);
  } catch (error) {
    console.error('PDF generation error:', error);
    alert('Failed to generate PDF. Please try again.');
  } finally {
    setIsDownloading(false);
  }
};
```

### 4. Download Button with Loading State

```typescript
import { Loader2, Download } from "lucide-react";

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
```

---

## Why jsPDF Direct Drawing (Not html2pdf.js)

We tried several approaches with html2pdf.js before settling on jsPDF:

| Approach | Issue |
|----------|-------|
| `html2pdf` with hidden container (`left: -9999px`) | White background visible behind modal during loading |
| `html2pdf` with hidden iframe (`width: 0; height: 0`) | PDF lost all styling - rendered unstyled |
| `html2pdf` with off-screen iframe | Still had styling issues |
| `html2pdf` with overlay covering container | Receipt still visible through semi-transparent overlay |
| **jsPDF direct drawing** | Works perfectly - no DOM elements needed |

**jsPDF direct drawing** generates the PDF programmatically without needing any visible DOM elements, avoiding all visibility/capture issues.

---

## Key Learnings

1. **Print in new window** - For clean receipts, open a new window with only receipt HTML instead of using `@media print` CSS on the main page

2. **jsPDF text alignment** - Don't rely on jsPDF's built-in `align` option in v4. Calculate position manually using `doc.getTextWidth(text)`

3. **Color arrays** - Use explicit array indexing `color[0], color[1], color[2]` instead of spread operator `...color` for reliability

4. **Dynamic imports** - Use `await import('jspdf')` for code splitting - only load the library when needed

5. **Loading states** - Always show loading feedback for operations that may take time

---

## Receipt Sections

Both print and PDF include these sections:
- Header with logo and booking ID
- Status badge (Pending/Paid/Scheduled/Completed/Cancelled)
- Service Details (name, shop, address)
- Appointment (date, time) - if scheduled
- Payment Summary (subtotal, RCN redeemed, discount, total)
- RCN Earned highlight - if completed
- Booking Information (booking date, order ID)
- Footer with thank you message

---

## Status
**Completed** - January 2026
