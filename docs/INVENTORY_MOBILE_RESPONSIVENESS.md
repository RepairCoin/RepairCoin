# Inventory v2.0 - Mobile Responsiveness Guide

**Version**: 1.0
**Date**: May 14, 2026
**Purpose**: Testing checklist and fix recommendations for mobile devices

---

## 📱 Testing Matrix

### Devices to Test

| Device Category | Viewport | Device Examples | Priority |
|-----------------|----------|-----------------|----------|
| Small Mobile | 320px - 374px | iPhone SE, Galaxy S8 | High |
| Standard Mobile | 375px - 413px | iPhone 12, Pixel 5 | Critical |
| Large Mobile | 414px - 767px | iPhone 14 Pro Max, Galaxy S21+ | High |
| Tablet Portrait | 768px - 1023px | iPad, Galaxy Tab | Medium |
| Tablet Landscape | 1024px+ | iPad Pro, Surface | Low |

---

## ✅ Component Testing Checklist

### 1. Inventory List Table

#### 🔴 Critical Issues (Must Fix)

**Issue 1.1**: Table overflows horizontally on mobile
- **Viewport**: <768px
- **Current**: Table forces horizontal scroll
- **Impact**: Poor UX, users miss action buttons

**Fix**:
```tsx
// Option A: Card View for Mobile
{isMobile ? (
  <div className="space-y-4">
    {items.map(item => (
      <InventoryItemCard key={item.id} item={item} />
    ))}
  </div>
) : (
  <InventoryTable items={items} />
)}
```

**Fix**:
```tsx
// Option B: Horizontal Scroll with Sticky First Column
<div className="overflow-x-auto">
  <table className="min-w-full">
    <thead className="sticky left-0 bg-gray-900 z-10">
      {/* columns */}
    </thead>
  </table>
</div>
```

**Recommendation**: Use card view for <768px

---

**Issue 1.2**: Action buttons too small to tap
- **Viewport**: All mobile
- **Current**: Buttons ~32px touch target
- **Impact**: Hard to tap, accessibility issue

**Fix**:
```tsx
// Increase minimum touch target to 44x44px
<button className="min-h-[44px] min-w-[44px] p-3 touch-manipulation">
  <TrashIcon className="w-5 h-5" />
</button>
```

**Fix**:
```css
/* Add to global styles */
@media (max-width: 768px) {
  .btn-action {
    min-height: 44px;
    min-width: 44px;
    padding: 12px;
  }
}
```

---

**Issue 1.3**: Bulk select checkboxes tiny
- **Viewport**: <768px
- **Current**: 16px checkboxes
- **Impact**: Impossible to tap accurately

**Fix**:
```tsx
<input
  type="checkbox"
  className="w-6 h-6 md:w-4 md:h-4" // Larger on mobile
/>
```

---

#### 🟡 Medium Priority

**Issue 1.4**: Search bar too narrow
- **Fix**: Make full-width on mobile
```tsx
<input className="w-full md:w-64 md:max-w-md" />
```

**Issue 1.5**: Filter buttons wrap awkwardly
- **Fix**: Horizontal scroll or dropdown
```tsx
<div className="flex overflow-x-auto gap-2 pb-2 scrollbar-hide">
  {filters.map(f => <FilterButton key={f} />)}
</div>
```

---

### 2. Analytics Dashboard

#### 🔴 Critical Issues

**Issue 2.1**: Charts don't scale to screen width
- **Viewport**: All mobile
- **Current**: Fixed width causes overflow

**Fix**:
```tsx
import { ResponsiveContainer } from 'recharts';

<ResponsiveContainer width="100%" height={300}>
  <BarChart data={data}>
    {/* chart contents */}
  </BarChart>
</ResponsiveContainer>
```

**Complete Example**:
```tsx
// InventoryAnalyticsTab.tsx

// Overview Chart - Top Items
<div className="bg-gray-800 p-4 rounded-lg">
  <h3 className="text-lg font-semibold mb-4">Top 10 Items by Value</h3>
  <ResponsiveContainer width="100%" height={300}>
    <BarChart
      data={overviewData.topItems}
      margin={{ top: 5, right: 5, left: 5, bottom: 60 }} // Adjust for mobile
    >
      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
      <XAxis
        dataKey="name"
        angle={-45}
        textAnchor="end"
        height={80}
        tick={{ fontSize: 10 }} // Smaller font on mobile
      />
      <YAxis tick={{ fontSize: 10 }} />
      <Tooltip
        contentStyle={{
          backgroundColor: '#1F2937',
          border: '1px solid #374151',
          borderRadius: '8px',
          fontSize: '12px'
        }}
      />
      <Bar dataKey="value" fill="#FFCC00" />
    </BarChart>
  </ResponsiveContainer>
</div>
```

---

**Issue 2.2**: Pie chart legend cut off
- **Viewport**: <414px
- **Current**: Legend overlaps chart

**Fix**:
```tsx
<PieChart>
  <Pie>
    <Label /* ... */ />
  </Pie>
  <Legend
    layout="horizontal" // Stack horizontally on mobile
    verticalAlign="bottom"
    align="center"
    wrapperStyle={{ fontSize: '10px' }}
  />
</PieChart>
```

---

**Issue 2.3**: Tooltips go off screen
- **Viewport**: Edge of screen
- **Current**: Tooltip cut off on right/left

**Fix**:
```tsx
<Tooltip
  position={{ x: 'auto', y: 'auto' }}
  allowEscapeViewBox={{ x: true, y: true }}
  contentStyle={{
    maxWidth: '200px',
    wordWrap: 'break-word'
  }}
/>
```

---

#### 🟡 Medium Priority

**Issue 2.4**: Statistics cards stack poorly
- **Fix**: Single column on mobile
```tsx
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
  <StatCard />
  <StatCard />
  <StatCard />
  <StatCard />
</div>
```

**Issue 2.5**: Period selector buttons crowded
- **Fix**: Dropdown on mobile
```tsx
{isMobile ? (
  <select className="..." onChange={handlePeriodChange}>
    <option value={7}>7 Days</option>
    <option value={30}>30 Days</option>
    {/* ... */}
  </select>
) : (
  <div className="flex gap-2">
    <PeriodButton value={7} />
    <PeriodButton value={30} />
    {/* ... */}
  </div>
)}
```

---

### 3. Purchase Order Modals

#### 🔴 Critical Issues

**Issue 3.1**: Create PO Modal too tall for screen
- **Viewport**: <667px height (iPhone SE)
- **Current**: Modal content cut off, can't reach submit

**Fix**:
```tsx
<div className="fixed inset-0 flex items-center justify-center p-4">
  <div className="bg-gray-900 rounded-lg max-h-[90vh] w-full max-w-2xl flex flex-col">
    {/* Header - Fixed */}
    <div className="p-6 border-b border-gray-700">
      <h2>Create Purchase Order</h2>
    </div>

    {/* Content - Scrollable */}
    <div className="overflow-y-auto flex-1 p-6">
      {/* Form fields */}
    </div>

    {/* Footer - Fixed */}
    <div className="p-6 border-t border-gray-700 flex gap-2">
      <button>Cancel</button>
      <button>Create PO</button>
    </div>
  </div>
</div>
```

---

**Issue 3.2**: Item list in PO modal not scrollable
- **Viewport**: All mobile
- **Current**: Items overflow, can't see all

**Fix**:
```tsx
<div className="max-h-60 overflow-y-auto border border-gray-700 rounded">
  {items.map(item => (
    <POItemRow key={item.id} item={item} />
  ))}
</div>
```

---

**Issue 3.3**: Date picker doesn't work on mobile
- **Viewport**: iOS/Android
- **Current**: Desktop date picker, hard to use

**Fix**: Use native date input on mobile
```tsx
<input
  type="date"
  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded"
  // Native date picker on mobile browsers
/>
```

---

**Issue 3.4**: Receive Items Modal quantity inputs too small
- **Viewport**: <768px
- **Current**: 40px height, hard to tap

**Fix**:
```tsx
<input
  type="number"
  className="w-20 h-12 text-center text-lg md:h-10 md:text-base"
  // Larger on mobile for easier input
/>
```

---

#### 🟡 Medium Priority

**Issue 3.5**: Vendor dropdown cut off in modal
- **Fix**: Use portal or increase modal z-index
```tsx
<Select
  menuPortalTarget={document.body}
  styles={{
    menuPortal: base => ({ ...base, zIndex: 9999 })
  }}
/>
```

---

### 4. Service Inventory Picker Modal

#### 🔴 Critical Issues

**Issue 4.1**: Two-column layout cramped on mobile
- **Viewport**: <768px
- **Current**: Left (available) and right (selected) panels squeezed

**Fix**: Stack vertically on mobile
```tsx
<div className="flex flex-col lg:flex-row gap-4">
  {/* Available Items */}
  <div className="lg:w-1/2">
    <h3>Available Items</h3>
    {/* Search */}
    {/* Item List */}
  </div>

  {/* Selected Items */}
  <div className="lg:w-1/2">
    <h3>Selected Items ({selected.length})</h3>
    {/* Selected List */}
  </div>
</div>
```

**Alternative**: Tabbed interface
```tsx
<Tabs defaultValue="available">
  <TabsList>
    <TabsTrigger value="available">Available ({items.length})</TabsTrigger>
    <TabsTrigger value="selected">Selected ({selected.length})</TabsTrigger>
  </TabsList>
  <TabsContent value="available">
    {/* Available items */}
  </TabsContent>
  <TabsContent value="selected">
    {/* Selected items */}
  </TabsContent>
</Tabs>
```

---

**Issue 4.2**: Quantity required input difficult to adjust
- **Viewport**: All mobile
- **Current**: Small number input

**Fix**: Plus/minus buttons
```tsx
<div className="flex items-center gap-2">
  <button
    onClick={() => setQty(Math.max(1, qty - 1))}
    className="w-10 h-10 bg-gray-700 rounded flex items-center justify-center"
  >
    <MinusIcon className="w-4 h-4" />
  </button>

  <input
    type="number"
    value={qty}
    className="w-16 h-10 text-center"
    min={1}
  />

  <button
    onClick={() => setQty(qty + 1)}
    className="w-10 h-10 bg-gray-700 rounded flex items-center justify-center"
  >
    <PlusIcon className="w-4 h-4" />
  </button>
</div>
```

---

### 5. Low Stock Alerts Tab

#### 🟡 Medium Priority Issues

**Issue 5.1**: Settings form fields cramped
- **Fix**: Stack vertically on mobile
```tsx
<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
  <div>
    <label>Enable Alerts</label>
    <Toggle />
  </div>
  <div>
    <label>Email</label>
    <input />
  </div>
  {/* ... */}
</div>
```

**Issue 5.2**: Low stock items table horizontal scroll
- **Fix**: Card view on mobile (same as inventory list)

---

## 🎨 UI Component Recommendations

### Mobile-Optimized Card Component

For inventory lists on mobile:

```tsx
// components/shop/inventory/InventoryItemCard.tsx

interface InventoryItemCardProps {
  item: InventoryItem;
  onEdit: (item: InventoryItem) => void;
  onDelete: (id: string) => void;
  onAdjustStock: (item: InventoryItem) => void;
}

export const InventoryItemCard: React.FC<InventoryItemCardProps> = ({
  item,
  onEdit,
  onDelete,
  onAdjustStock
}) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'bg-green-500/10 text-green-400 border-green-500/30';
      case 'low_stock': return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30';
      case 'out_of_stock': return 'bg-red-500/10 text-red-400 border-red-500/30';
      default: return 'bg-gray-500/10 text-gray-400 border-gray-500/30';
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
      {/* Header Row */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h3 className="font-semibold text-white text-lg">{item.name}</h3>
          <p className="text-sm text-gray-400">SKU: {item.sku || 'N/A'}</p>
        </div>

        {/* Status Badge */}
        <div className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(item.status)}`}>
          {item.status.replace('_', ' ').toUpperCase()}
        </div>
      </div>

      {/* Image (if exists) */}
      {item.images && item.images.length > 0 && (
        <div className="mb-3">
          <img
            src={item.images[0]}
            alt={item.name}
            className="w-full h-32 object-cover rounded"
          />
        </div>
      )}

      {/* Details Grid */}
      <div className="grid grid-cols-2 gap-3 mb-3 text-sm">
        <div>
          <p className="text-gray-400">Stock</p>
          <p className="text-white font-semibold text-lg">{item.stock_quantity}</p>
        </div>
        <div>
          <p className="text-gray-400">Threshold</p>
          <p className="text-white font-semibold text-lg">{item.low_stock_threshold}</p>
        </div>
        <div>
          <p className="text-gray-400">Price</p>
          <p className="text-white font-semibold">${item.price.toFixed(2)}</p>
        </div>
        <div>
          <p className="text-gray-400">Cost</p>
          <p className="text-white font-semibold">${item.cost?.toFixed(2) || 'N/A'}</p>
        </div>
      </div>

      {/* Category & Vendor */}
      <div className="flex gap-2 mb-3">
        {item.category && (
          <span className="px-2 py-1 bg-gray-700 text-gray-300 text-xs rounded">
            {item.category}
          </span>
        )}
        {item.vendor_name && (
          <span className="px-2 py-1 bg-gray-700 text-gray-300 text-xs rounded">
            {item.vendor_name}
          </span>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2">
        <button
          onClick={() => onAdjustStock(item)}
          className="flex-1 bg-blue-600 text-white py-2 rounded font-medium hover:bg-blue-700 transition"
        >
          Adjust Stock
        </button>
        <button
          onClick={() => onEdit(item)}
          className="w-12 bg-gray-700 text-white py-2 rounded hover:bg-gray-600 transition"
        >
          <PencilIcon className="w-5 h-5 mx-auto" />
        </button>
        <button
          onClick={() => onDelete(item.id)}
          className="w-12 bg-red-600 text-white py-2 rounded hover:bg-red-700 transition"
        >
          <TrashIcon className="w-5 h-5 mx-auto" />
        </button>
      </div>
    </div>
  );
};
```

### Responsive Hook

Utility hook for mobile detection:

```tsx
// hooks/useMediaQuery.ts

import { useState, useEffect } from 'react';

export const useMediaQuery = (query: string): boolean => {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);

    if (media.matches !== matches) {
      setMatches(media.matches);
    }

    const listener = () => setMatches(media.matches);
    media.addEventListener('change', listener);

    return () => media.removeEventListener('change', listener);
  }, [matches, query]);

  return matches;
};

// Usage
export const useIsMobile = () => useMediaQuery('(max-width: 768px)');
export const useIsTablet = () => useMediaQuery('(min-width: 768px) and (max-width: 1023px)');
export const useIsDesktop = () => useMediaQuery('(min-width: 1024px)');
```

Usage in component:
```tsx
import { useIsMobile } from '@/hooks/useMediaQuery';

const InventoryTab = () => {
  const isMobile = useIsMobile();

  return (
    <div>
      {isMobile ? (
        <MobileInventoryView />
      ) : (
        <DesktopInventoryTable />
      )}
    </div>
  );
};
```

---

## 🧪 Testing Procedure

### 1. Chrome DevTools Responsive Mode

```bash
1. Open Chrome DevTools (F12)
2. Click "Toggle Device Toolbar" (Ctrl+Shift+M)
3. Test each preset:
   - iPhone SE (375x667)
   - iPhone 12 Pro (390x844)
   - iPad (768x1024)
4. Test both portrait and landscape
5. Test touch events (click "Touch" in toolbar)
```

### 2. Real Device Testing

**Priority Devices**:
1. iPhone 12/13 (most common)
2. Samsung Galaxy S21
3. iPad (for tablet testing)

**Test Flow**:
1. Navigate to each inventory screen
2. Perform key actions:
   - Add item
   - Adjust stock
   - Create PO
   - View analytics
   - Link inventory to service
3. Screenshot any issues
4. Note device model and OS version

### 3. Automated Testing

Add viewport tests:

```typescript
// cypress/e2e/inventory-mobile.cy.ts

describe('Inventory Mobile Responsiveness', () => {
  const viewports = [
    { name: 'iPhone SE', width: 375, height: 667 },
    { name: 'iPhone 12', width: 390, height: 844 },
    { name: 'iPad', width: 768, height: 1024 }
  ];

  viewports.forEach(viewport => {
    describe(`${viewport.name} (${viewport.width}x${viewport.height})`, () => {
      beforeEach(() => {
        cy.viewport(viewport.width, viewport.height);
        cy.visit('/shop?tab=inventory');
      });

      it('should display inventory list', () => {
        cy.get('[data-testid="inventory-list"]').should('be.visible');
        cy.get('[data-testid="inventory-item"]').should('have.length.at.least', 1);
      });

      it('should open add item modal', () => {
        cy.get('[data-testid="add-item-button"]').click();
        cy.get('[data-testid="add-item-modal"]').should('be.visible');
      });

      it('action buttons should be tappable', () => {
        cy.get('[data-testid="inventory-item"]').first()
          .find('[data-testid="action-button"]')
          .should('have.css', 'min-height', '44px');
      });
    });
  });
});
```

---

## 📋 Priority Fix List

### Immediate (Before Launch)

1. ✅ **Analytics Charts**: Add ResponsiveContainer to all charts
2. ✅ **PO Modal Height**: Add max-height and scrollable content
3. ✅ **Touch Targets**: Increase buttons to 44px minimum
4. ✅ **Table Overflow**: Implement card view for mobile inventory list

### High Priority (Week 1)

5. ⏳ **Service Picker**: Stack columns vertically on mobile
6. ⏳ **Bulk Select**: Larger checkboxes on mobile
7. ⏳ **Date Pickers**: Use native inputs on mobile
8. ⏳ **Quantity Inputs**: Add plus/minus buttons

### Medium Priority (Month 1)

9. ⏸️ **Filter Buttons**: Convert to dropdown on mobile
10. ⏸️ **Period Selectors**: Use select dropdown on mobile
11. ⏸️ **Tooltips**: Prevent offscreen positioning
12. ⏸️ **Chart Legends**: Stack vertically on mobile

---

## 🎯 Success Criteria

### Mobile Experience Goals

- ✅ All features usable without horizontal scroll
- ✅ All touch targets ≥44x44px
- ✅ Forms easily fillable on mobile keyboard
- ✅ Charts readable and interactive
- ✅ Modals fit screen height (no content cut off)
- ✅ Text readable without zooming
- ✅ Actions accessible without complex gestures

### Performance Goals

- Page load <3s on 4G
- Charts render <2s
- Smooth scrolling (60fps)
- No janky animations

---

## 📊 Testing Report Template

```markdown
# Mobile Testing Report - [Date]

## Device
- Model: iPhone 12 Pro
- OS: iOS 17.2
- Browser: Safari
- Screen: 390x844px

## Tested Screens
- [x] Inventory List
- [x] Add/Edit Item Modal
- [x] Stock Adjustment Modal
- [x] Purchase Orders
- [x] Analytics Dashboard
- [x] Low Stock Alerts
- [x] Service Inventory Picker

## Issues Found

### Critical
1. **Analytics charts overflow**
   - Screen: Analytics Dashboard
   - Severity: High
   - Screenshot: [attach]
   - Fix: Add ResponsiveContainer

### Medium
1. **Filter buttons wrap awkwardly**
   - Screen: Inventory List
   - Severity: Medium
   - Fix: Horizontal scroll or dropdown

### Low
1. **Tooltips go offscreen**
   - Screen: Charts
   - Severity: Low
   - Fix: Adjust tooltip positioning

## Overall Score
- Usability: 7/10
- Performance: 8/10
- Visual: 8/10
- Accessibility: 6/10

## Recommendations
1. Implement card view for inventory list
2. Increase touch target sizes
3. Add plus/minus for quantity inputs
```

---

**Document Version**: 1.0
**Last Updated**: May 14, 2026
**Next Review**: After mobile fixes deployed
