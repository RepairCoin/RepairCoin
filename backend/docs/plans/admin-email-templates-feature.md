# Admin Email Templates Feature - Implementation Plan

**Date Created:** 2026-04-20
**Status:** Planning
**Priority:** Medium
**Estimated Time:** 6-8 hours

---

## Overview

Implement a complete email template management system in the Admin Settings, allowing admins to customize email notifications sent throughout the platform.

---

## Current State

**Frontend:** `/frontend/src/components/admin/tabs/AdminSettingsTab.tsx`
- Email Templates tab shows "Coming Soon" placeholder (lines 124-165)
- Lists 5 planned template types
- No actual functionality implemented

**Backend:** No email template endpoints exist yet

---

## Requirements

### Email Template Types to Support

1. **Welcome Emails**
   - Customer welcome email
   - Shop welcome email (post-approval)

2. **Booking/Appointment Emails**
   - Booking confirmation
   - Booking reminder (24h before)
   - Booking cancellation
   - Booking rescheduled

3. **Transaction Emails**
   - RCN reward received
   - RCN redemption receipt
   - Shop RCN purchase receipt

4. **Shop Management Emails**
   - Shop application received
   - Shop application approved
   - Shop application rejected
   - Shop subscription expiring (7d, 3d, 1d)
   - Shop subscription expired

5. **Support/Admin Emails**
   - Password reset request
   - Account suspended notification
   - Account unsuspended notification
   - Support ticket response

### Template Features Required

- **Subject line** customization
- **Body content** with rich text/HTML support
- **Variable placeholders** (e.g., `{{customerName}}`, `{{shopName}}`, `{{amount}}`)
- **Preview functionality** with sample data
- **Template versioning** (optional: track changes)
- **Default templates** (system fallback)
- **Enable/disable** individual templates
- **Language support** (future: multi-language templates)

---

## Database Schema

### New Table: `email_templates`

```sql
CREATE TABLE email_templates (
  id SERIAL PRIMARY KEY,
  template_key VARCHAR(100) UNIQUE NOT NULL,  -- e.g., 'customer_welcome', 'shop_approved'
  template_name VARCHAR(255) NOT NULL,         -- Display name
  category VARCHAR(50) NOT NULL,               -- 'welcome', 'booking', 'transaction', 'shop', 'support'
  subject VARCHAR(255) NOT NULL,
  body_html TEXT NOT NULL,                     -- HTML version
  body_text TEXT,                              -- Plain text fallback
  variables JSONB,                             -- Available variables: ['customerName', 'amount', etc.]
  enabled BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,            -- System default template
  version INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by VARCHAR(255),                     -- Admin wallet address
  modified_by VARCHAR(255),                    -- Last modifier
  last_sent_at TIMESTAMP                       -- Last time this template was used
);

-- Index for fast lookups
CREATE INDEX idx_email_templates_key ON email_templates(template_key);
CREATE INDEX idx_email_templates_category ON email_templates(category);
```

### New Table: `email_template_history` (Optional)

```sql
CREATE TABLE email_template_history (
  id SERIAL PRIMARY KEY,
  template_id INTEGER REFERENCES email_templates(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  subject VARCHAR(255),
  body_html TEXT,
  body_text TEXT,
  modified_by VARCHAR(255),
  modified_at TIMESTAMP DEFAULT NOW()
);
```

---

## Backend Implementation

### File: `backend/src/domains/admin/routes/emailTemplates.ts`

**Endpoints to Create:**

```typescript
GET    /admin/settings/email-templates              // Get all templates
GET    /admin/settings/email-templates/:key         // Get specific template
POST   /admin/settings/email-templates              // Create new template
PUT    /admin/settings/email-templates/:key         // Update template
DELETE /admin/settings/email-templates/:key         // Delete custom template (restore default)
POST   /admin/settings/email-templates/:key/preview // Preview with sample data
POST   /admin/settings/email-templates/:key/test    // Send test email
PUT    /admin/settings/email-templates/:key/toggle  // Enable/disable template
```

### Migration File

**File:** `backend/migrations/105_create_email_templates.sql`

```sql
-- See database schema above
-- Include default templates INSERT statements
```

### Default Templates

Create default templates for all types during migration:

```typescript
const DEFAULT_TEMPLATES = [
  {
    template_key: 'customer_welcome',
    template_name: 'Customer Welcome Email',
    category: 'welcome',
    subject: 'Welcome to {{platformName}}! 🎉',
    body_html: `
      <h1>Welcome {{customerName}}!</h1>
      <p>Thank you for joining {{platformName}}. Start earning RCN tokens today!</p>
      <p>Your wallet: {{walletAddress}}</p>
    `,
    variables: ['customerName', 'platformName', 'walletAddress'],
    is_default: true
  },
  // ... more defaults
];
```

---

## Frontend Implementation

### 1. Types/Interfaces

**File:** `frontend/src/services/api/admin.ts` (add to existing)

```typescript
export interface EmailTemplate {
  id: number;
  templateKey: string;
  templateName: string;
  category: 'welcome' | 'booking' | 'transaction' | 'shop' | 'support';
  subject: string;
  bodyHtml: string;
  bodyText?: string;
  variables: string[];  // Available placeholders
  enabled: boolean;
  isDefault: boolean;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  modifiedBy?: string;
  lastSentAt?: Date;
}

export interface EmailTemplatePreview {
  subject: string;
  bodyHtml: string;
  sampleData: Record<string, string>;
}

// API Functions
export const getEmailTemplates = async (category?: string): Promise<EmailTemplate[]> => { ... }
export const getEmailTemplate = async (key: string): Promise<EmailTemplate | null> => { ... }
export const updateEmailTemplate = async (key: string, data: Partial<EmailTemplate>): Promise<{ success: boolean; message?: string }> => { ... }
export const previewEmailTemplate = async (key: string, sampleData?: Record<string, string>): Promise<EmailTemplatePreview | null> => { ... }
export const sendTestEmail = async (key: string, recipientEmail: string): Promise<{ success: boolean; message?: string }> => { ... }
export const toggleEmailTemplate = async (key: string, enabled: boolean): Promise<{ success: boolean }> => { ... }
export const resetToDefault = async (key: string): Promise<{ success: boolean }> => { ... }
```

### 2. Main Component

**File:** `frontend/src/components/admin/tabs/EmailTemplatesContent.tsx` (NEW)

**UI Structure:**

```
┌─────────────────────────────────────────────────────────┐
│  Email Templates                            [+ New]      │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  ┌─ Category Tabs ──────────────────────────────────┐   │
│  │  All  Welcome  Booking  Transaction  Shop  Support│   │
│  └───────────────────────────────────────────────────┘   │
│                                                           │
│  ┌─ Template List ──────────────────────────────────┐   │
│  │                                                    │   │
│  │  [🎉] Customer Welcome Email         [●] [Edit]  │   │
│  │      Last modified: 2 days ago                    │   │
│  │      Variables: customerName, platformName        │   │
│  │                                                    │   │
│  │  [📧] Shop Welcome Email              [●] [Edit]  │   │
│  │      Last modified: 1 week ago                    │   │
│  │      Variables: shopName, approvalDate            │   │
│  │                                                    │   │
│  │  [📅] Booking Confirmation            [○] [Edit]  │   │
│  │      Last modified: Never                         │   │
│  │      Variables: serviceName, bookingDate          │   │
│  │                                                    │   │
│  └────────────────────────────────────────────────────┘   │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

**Key Features:**
- Category filtering tabs
- List view with template cards
- Enable/disable toggle
- Edit button per template
- Search/filter functionality

### 3. Template Editor Modal/Page

**File:** `frontend/src/components/admin/tabs/EmailTemplateEditor.tsx` (NEW)

**UI Structure:**

```
┌─────────────────────────────────────────────────────────┐
│  Edit Template: Customer Welcome Email      [X Close]   │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  Template Name: [Customer Welcome Email            ]     │
│                                                           │
│  Subject Line:  [Welcome to {{platformName}}! 🎉   ]     │
│                                                           │
│  Available Variables:                                    │
│  {{customerName}} {{platformName}} {{walletAddress}}     │
│                                                           │
│  ┌─ Body Editor ────────────────────────────────────┐   │
│  │ [B] [I] [U] [Link] [Image]              [Code]   │   │
│  │ ──────────────────────────────────────────────────│   │
│  │                                                    │   │
│  │  <h1>Welcome {{customerName}}!</h1>               │   │
│  │  <p>Thank you for joining {{platformName}}...</p> │   │
│  │                                                    │   │
│  │                                                    │   │
│  └────────────────────────────────────────────────────┘   │
│                                                           │
│  ┌─ Preview ─────────────────────────────────────────┐   │
│  │  Subject: Welcome to RepairCoin! 🎉               │   │
│  │  ───────────────────────────────────────────────  │   │
│  │  Welcome John Doe!                                │   │
│  │  Thank you for joining RepairCoin...              │   │
│  └────────────────────────────────────────────────────┘   │
│                                                           │
│  [Reset to Default]      [Send Test] [Cancel] [Save]     │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

**Key Features:**
- Rich text editor (consider: TinyMCE, Quill, or simple textarea)
- Variable insertion buttons
- Live preview with sample data
- Test email functionality
- Reset to default option
- Validation (ensure all used variables are available)

### 4. Components to Create

```
frontend/src/components/admin/
├── tabs/
│   ├── EmailTemplatesContent.tsx        (Main list view)
│   └── EmailTemplateEditor.tsx          (Editor modal/page)
├── email-templates/
│   ├── TemplateCard.tsx                 (Individual template card)
│   ├── TemplatePreview.tsx              (Preview component)
│   ├── VariableInserter.tsx             (Variable picker)
│   └── CategoryFilter.tsx               (Category tabs)
```

---

## Implementation Steps

### Phase 1: Backend Foundation (2-3 hours)

1. ✅ Create database migration `105_create_email_templates.sql`
2. ✅ Insert default templates for all categories
3. ✅ Create `/domains/admin/routes/emailTemplates.ts`
4. ✅ Implement all CRUD endpoints
5. ✅ Add preview & test email functionality
6. ✅ Mount routes in `admin.ts`: `router.use('/settings/email-templates', emailTemplateRoutes)`
7. ✅ Test all endpoints with Postman/curl

### Phase 2: Frontend API Integration (1 hour)

1. ✅ Add TypeScript interfaces to `frontend/src/services/api/admin.ts`
2. ✅ Implement API functions (getEmailTemplates, updateEmailTemplate, etc.)
3. ✅ Test API calls independently

### Phase 3: Frontend UI - List View (1.5 hours)

1. ✅ Create `EmailTemplatesContent.tsx`
2. ✅ Implement category filtering
3. ✅ Display template list with cards
4. ✅ Add enable/disable toggle
5. ✅ Add search/filter functionality
6. ✅ Style with existing design system

### Phase 4: Frontend UI - Editor (2-2.5 hours)

1. ✅ Create `EmailTemplateEditor.tsx`
2. ✅ Implement form fields (name, subject, body)
3. ✅ Add variable insertion functionality
4. ✅ Implement rich text editor or textarea
5. ✅ Add live preview
6. ✅ Implement save/cancel/reset actions
7. ✅ Add test email sender

### Phase 5: Integration & Testing (1 hour)

1. ✅ Replace "Coming Soon" content in `AdminSettingsTab.tsx`
2. ✅ Test full workflow: view → edit → save → preview
3. ✅ Test enable/disable functionality
4. ✅ Test reset to default
5. ✅ Verify all email templates load correctly
6. ✅ Bug fixes and polish

---

## Template Variable System

### Standard Variables (Available in All Templates)

```typescript
const GLOBAL_VARIABLES = {
  platformName: 'RepairCoin',
  platformUrl: 'https://repaircoin.ai',
  supportEmail: 'support@repaircoin.ai',
  currentYear: new Date().getFullYear(),
  currentDate: new Date().toLocaleDateString(),
};
```

### Category-Specific Variables

```typescript
const CATEGORY_VARIABLES = {
  customer: ['customerName', 'customerEmail', 'walletAddress', 'tierLevel', 'rcnBalance'],
  shop: ['shopName', 'shopEmail', 'shopAddress', 'shopPhone', 'subscriptionStatus'],
  booking: ['serviceName', 'bookingDate', 'bookingTime', 'totalAmount', 'depositAmount'],
  transaction: ['transactionId', 'amount', 'transactionType', 'transactionDate'],
};
```

---

## Email Service Integration

### Existing Email Service

Check if email service already exists:
- Look for `EmailService.ts` or similar
- Check environment variables: `SMTP_HOST`, `SENDGRID_API_KEY`, etc.

### Template Rendering Function

**File:** `backend/src/services/EmailTemplateService.ts` (NEW)

```typescript
export class EmailTemplateService {
  async renderTemplate(
    templateKey: string,
    variables: Record<string, any>
  ): Promise<{ subject: string; html: string; text: string }> {
    // 1. Load template from database
    // 2. Replace {{variables}} with actual values
    // 3. Return rendered subject + body
  }

  async sendEmail(
    templateKey: string,
    recipientEmail: string,
    variables: Record<string, any>
  ): Promise<boolean> {
    // 1. Render template
    // 2. Send via existing email service
  }
}
```

---

## UI/UX Considerations

### Design Patterns
- Use existing admin settings design (consistent with System Configuration)
- Color scheme: Same as current admin panel (#FFCC00, #1a1a1a, etc.)
- Icons: Lucide React icons (Mail, Edit, Eye, Send, etc.)

### Validation Rules
- Subject line: 10-200 characters
- Body: 50-10000 characters
- Variables: Must match available variables for template category
- Test email: Valid email format required

### User Feedback
- Toast notifications for save/update/test actions
- Confirmation dialog for reset to default
- Loading states for preview and test email
- Error messages for validation failures

---

## Testing Checklist

### Backend Tests
- [ ] GET all templates returns correct data
- [ ] GET single template by key works
- [ ] POST creates new template
- [ ] PUT updates existing template
- [ ] DELETE resets to default
- [ ] Preview endpoint returns rendered HTML
- [ ] Test email sends successfully
- [ ] Toggle enable/disable works

### Frontend Tests
- [ ] Template list loads and displays correctly
- [ ] Category filtering works
- [ ] Search/filter functionality works
- [ ] Enable/disable toggle updates
- [ ] Edit button opens editor
- [ ] Editor form fields work
- [ ] Variable insertion works
- [ ] Preview updates in real-time
- [ ] Save persists changes
- [ ] Reset to default works
- [ ] Test email sends
- [ ] Error handling displays correctly

---

## Future Enhancements (Not in Scope)

1. **Multi-language support** - Templates in multiple languages
2. **Conditional content** - Show/hide blocks based on conditions
3. **Template themes** - Pre-designed template themes
4. **A/B testing** - Test multiple template versions
5. **Analytics** - Open rates, click rates for emails
6. **Drag-and-drop editor** - Visual email builder
7. **Template marketplace** - Share/download templates
8. **Scheduled sends** - Queue emails for later

---

## Dependencies

### Backend
- Existing: `express`, `pg`, `dotenv`
- New (if needed): `nodemailer` or `@sendgrid/mail` for email sending
- New (if needed): `handlebars` or `mustache` for template rendering

### Frontend
- Existing: `react`, `axios`, `lucide-react`, `react-hot-toast`
- New (optional): `react-quill` or `@tinymce/tinymce-react` for rich text editing
- Alternative: Use simple `<textarea>` with HTML support

---

## Notes

- **Security:** Sanitize HTML input to prevent XSS attacks
- **Performance:** Cache rendered templates for frequently used emails
- **Backup:** Keep default templates in code/migration, not just database
- **Documentation:** Add JSDoc comments for all API functions
- **Accessibility:** Ensure editor is keyboard navigable

---

## Questions to Resolve Before Implementation

1. Does an email service already exist? Which provider (SendGrid, SMTP, etc.)?
2. Should we use a rich text editor or plain HTML textarea?
3. Do we need template versioning/history from day one?
4. Should admins be able to create entirely new template types, or only edit existing ones?
5. Do we need multi-language support in v1?

---

## Success Criteria

✅ Admins can view all email templates grouped by category
✅ Admins can edit subject lines and body content
✅ Variable placeholders can be inserted and are highlighted
✅ Preview shows rendered email with sample data
✅ Test emails can be sent to verify templates
✅ Templates can be enabled/disabled individually
✅ Templates can be reset to system defaults
✅ Changes are persisted to database
✅ UI is consistent with existing admin settings design

---

**Ready for implementation:** YES
**Blockers:** None identified
**Priority:** Implement after current system settings fix is deployed
