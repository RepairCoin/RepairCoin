# BUG-001: Service Name field accepts unlimited characters causing UI overflow

**Type:** Bug
**Severity:** Medium
**Priority:** P2
**Component:** Frontend - Shop Services
**Labels:** bug, frontend, validation, ui-overflow

---

## Description

The Service Name input field in the "Create New Service" modal has no character limit validation. Users can enter unlimited characters, causing text overflow in the Live Preview and Service Marketplace cards.

---

## Steps to Reproduce

1. Login as a shop owner with active subscription
2. Navigate to Shop Dashboard → Services tab
3. Click "Create New Service" button
4. In the "Service Name" field, enter a very long text (e.g., 100+ characters):
   ```
   iPhone® Repair™ & More! Service ✓ Repair sdfsdfsdfsdfsdfsdfsdfsdfsdfsdfsdfsdfsdfsdfsdfsdf
   ```
5. Observe the Live Preview section on the right side of the modal
6. Select category "Repairs" and enter price $1.00
7. Click "Create Service" to save
8. View the newly created service in the Service Marketplace listing

---

## Expected Result

- Service Name field should have a maximum character limit (recommended: 100 characters)
- Character counter should display below input (e.g., "45/100 characters")
- Input should prevent typing beyond the limit
- Long names should be truncated with ellipsis (...) in card displays
- Card layouts should remain consistent regardless of name length

---

## Actual Result

- Service Name field accepts unlimited characters
- No character counter is displayed
- Live Preview shows overflowing text extending beyond card boundary
- Service Marketplace card shows overflowing text that breaks the card layout
- Text is not truncated or wrapped properly
- Inconsistent card layouts when services have long names

---

## Screenshots

**Screenshot 1 - Create Modal (Live Preview Overflow):**
- File: sc1.png
- Shows long service name overflowing in Live Preview card

**Screenshot 2 - Service Marketplace (Card Overflow):**
- File: sc2.png
- Shows service card with text extending beyond boundaries

---

## Acceptance Criteria

- [ ] Service Name input has maxLength={100} attribute
- [ ] Character counter displays "X/100 characters" below input
- [ ] Form prevents typing beyond 100 characters
- [ ] Backend returns 400 error if name exceeds 100 characters
- [ ] Live Preview truncates long names with ellipsis
- [ ] Service Marketplace cards truncate long names with ellipsis
- [ ] Existing long-named services display correctly (truncated)

---

## Technical Notes

**Files to modify:**
- `frontend/src/components/shop/CreateServiceModal.tsx` - Add maxLength and counter
- `frontend/src/components/shop/ServiceCard.tsx` - Add CSS truncation
- `backend/src/domains/shop/services/ServiceManagementService.ts` - Add server validation
