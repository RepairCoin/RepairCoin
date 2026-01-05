# BUG-002: Description field does not preserve line breaks and HTML tags not sanitized

**Type:** Bug
**Severity:** Medium
**Priority:** P2
**Component:** Frontend - Shop Services
**Labels:** bug, frontend, validation, security, xss

---

## Description

The Service Description field has two issues:
1. **Line breaks not preserved** - Multiline text entered in the textarea displays as a single line in Live Preview and Service cards
2. **HTML tags not sanitized** - Raw HTML tags (e.g., `<p>`, `<script>`) are displayed as plain text instead of being properly escaped or stripped, creating potential XSS vulnerability

---

## Steps to Reproduce

### Issue 1: Line Breaks Not Preserved
1. Login as a shop owner with active subscription
2. Navigate to Shop Dashboard → Services tab
3. Click "Create New Service" button
4. Enter Service Name: "Test"
5. In the "Short Description" textarea, enter multiline text:
   ```
   line 1
   line 2
   line 3
   ```
6. Observe the Live Preview section
7. Save the service and view it in Service Marketplace

### Issue 2: HTML Tags Not Sanitized
1. Follow steps 1-4 above
2. In the "Short Description" textarea, enter text with HTML:
   ```
   <p>line 3</p> Service ✓ Repair iPhone® Repair™ & More!
   ```
3. Observe the Live Preview section
4. Save the service and view it in Service Marketplace

---

## Expected Result

### For Line Breaks:
- Line breaks entered in textarea should be preserved in display
- Text should show as:
  ```
  line 1
  line 2
  line 3
  ```

### For HTML Tags:
- HTML tags should be either:
  - **Option A (Recommended):** Stripped/removed entirely → displays as "line 3 Service ✓ Repair..."
  - **Option B:** Escaped and hidden from display → user sees clean text
- Raw HTML should NEVER be displayed to end users
- Script tags and other dangerous HTML must be sanitized to prevent XSS attacks

---

## Actual Result

### For Line Breaks:
- All text displays on a single line: `line 1 line 2 line 3`
- Newline characters are ignored or converted to spaces
- Live Preview and Service cards both show single-line text

### For HTML Tags:
- Raw HTML tags displayed as plain text: `line 1 line 2 <p>line 3</p> Service...`
- Tags are not stripped, escaped, or rendered
- Potential security risk if script tags are entered

---

## Screenshots

**Screenshot 1 - Create Modal (Description Input):**
- File: sc1.png
- Shows textarea with multiline input and HTML tags
- Live Preview displays everything on single line with raw HTML visible

**Screenshot 2 - Service Marketplace Card:**
- File: sc2.png
- Shows service card with description: `line 1 line 2 <p>line 3</p> Service ✓ Repair iPhone® Repair™ & More!`
- Line breaks not preserved, HTML tags visible as text

---

## Acceptance Criteria

- [ ] Line breaks (Enter key) in description are preserved in display
- [ ] Textarea shows multiline text correctly
- [ ] Live Preview renders line breaks properly
- [ ] Service cards render line breaks (or truncate appropriately)
- [ ] HTML tags are stripped or escaped before display
- [ ] `<script>` and other dangerous tags are completely removed
- [ ] XSS attack vectors are blocked
- [ ] Backend sanitizes HTML on input

---

## Technical Notes

**Files to modify:**
- `frontend/src/components/shop/CreateServiceModal.tsx` - Sanitize input, preserve line breaks
- `frontend/src/components/shop/ServiceCard.tsx` - Render with `white-space: pre-line` or convert `\n` to `<br>`
- `backend/src/domains/shop/services/ServiceManagementService.ts` - Server-side HTML sanitization

**Recommended Solutions:**

### Line Breaks - CSS Solution:
```css
.service-description {
  white-space: pre-line; /* Preserves line breaks */
}
```

### Line Breaks - React Solution:
```tsx
{description.split('\n').map((line, i) => (
  <span key={i}>{line}<br/></span>
))}
```

### HTML Sanitization - Use DOMPurify:
```tsx
import DOMPurify from 'dompurify';

const sanitizedDescription = DOMPurify.sanitize(description, {
  ALLOWED_TAGS: [], // Strip all HTML
  ALLOWED_ATTR: []
});
```

### Backend Sanitization:
```typescript
// Strip all HTML tags server-side
const sanitizedDescription = description.replace(/<[^>]*>/g, '');
```

---

## Security Considerations

This bug has security implications:

| Risk | Severity | Example |
|------|----------|---------|
| XSS Attack | High | `<script>alert('hacked')</script>` |
| HTML Injection | Medium | `<img src=x onerror=alert(1)>` |
| Phishing | Medium | `<a href="malicious.com">Click here</a>` |

**Recommendation:** Implement both client-side and server-side sanitization to prevent XSS attacks.
