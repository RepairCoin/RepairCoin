# Contact Management & Mass Communication System

## Overview

This feature allows shops to import external contacts (email, phone, full name) and send mass email/SMS campaigns to promote app downloads and drive customer acquisition.

**Status**: Backend Complete ✅ | Frontend Pending ⏳

---

## Database Schema

### Migration: `124_create_contact_imports.sql`

#### 1. `contact_imports` Table
Stores imported contacts for mass communication.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `shop_id` | TEXT | Reference to shops table |
| `full_name` | TEXT | Contact's full name (required) |
| `email` | TEXT | Email address (optional) |
| `phone` | TEXT | Phone number (optional) |
| `status` | TEXT | active, unsubscribed, bounced, invalid |
| `source` | TEXT | manual, csv, api |
| `tags` | TEXT[] | Array of tags for segmentation |
| `notes` | TEXT | Optional notes |
| `email_sent_count` | INTEGER | Total emails sent to this contact |
| `sms_sent_count` | INTEGER | Total SMS sent to this contact |
| `last_email_sent_at` | TIMESTAMP | Last email send time |
| `last_sms_sent_at` | TIMESTAMP | Last SMS send time |
| `created_at` | TIMESTAMP | Record creation time |
| `updated_at` | TIMESTAMP | Last update time |

**Constraints**:
- At least one contact method (email OR phone) required
- Unique email per shop (if status != 'invalid')
- Unique phone per shop (if status != 'invalid')

#### 2. `communication_campaigns` Table
Tracks mass email/SMS campaigns.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `shop_id` | TEXT | Reference to shops table |
| `campaign_name` | TEXT | Campaign name |
| `campaign_type` | TEXT | email, sms, both |
| `subject` | TEXT | Email subject line |
| `message_template` | TEXT | Message content |
| `target_status` | TEXT[] | Target contact statuses |
| `target_tags` | TEXT[] | Target tags (null = all) |
| `total_recipients` | INTEGER | Total recipients |
| `sent_count` | INTEGER | Successfully sent count |
| `failed_count` | INTEGER | Failed sends count |
| `status` | TEXT | draft, scheduled, sending, completed, failed |
| `scheduled_at` | TIMESTAMP | When to send |
| `started_at` | TIMESTAMP | When sending started |
| `completed_at` | TIMESTAMP | When sending completed |
| `created_by` | TEXT | Wallet address of creator |
| `created_at` | TIMESTAMP | Record creation time |
| `updated_at` | TIMESTAMP | Last update time |

#### 3. `campaign_recipients` Table
Tracks individual message sends.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `campaign_id` | UUID | Reference to campaigns table |
| `contact_id` | UUID | Reference to contacts table |
| `delivery_type` | TEXT | email or sms |
| `status` | TEXT | pending, sent, failed, bounced, delivered |
| `error_message` | TEXT | Error details if failed |
| `sent_at` | TIMESTAMP | When sent |
| `delivered_at` | TIMESTAMP | When delivered |
| `created_at` | TIMESTAMP | Record creation time |

**Constraint**:
- Unique per campaign/contact/delivery_type (prevent duplicate sends)

---

## Backend API

### Repository: `ContactRepository.ts`

Located: `/backend/src/repositories/ContactRepository.ts`

#### Key Methods:

**Contact Management**:
- `createContact(data)` - Add single contact
- `bulkCreateContacts(contacts[])` - Import multiple contacts (CSV)
- `getContacts(shopId, options)` - List with pagination, search, filters
- `getContactById(contactId)` - Get single contact
- `updateContact(contactId, data)` - Update contact info
- `deleteContact(contactId)` - Remove contact
- `getContactStats(shopId)` - Get statistics

**Campaign Management**:
- `createCampaign(data)` - Create new campaign
- `getCampaigns(shopId)` - List shop campaigns
- `getCampaignById(campaignId)` - Get campaign details
- `updateCampaignStatus(campaignId, status)` - Update campaign status
- `incrementContactCounter(contactId, type)` - Track sends

---

## API Endpoints

**Base Path**: `/api/marketing`

### Contact Endpoints

#### Get Contacts
```http
GET /api/marketing/shops/:shopId/contacts
Authorization: Bearer <token>
Role: shop

Query Parameters:
- page: number (default: 1)
- limit: number (default: 50)
- status: 'active' | 'unsubscribed' | 'bounced' | 'invalid'
- search: string (searches name, email, phone)

Response:
{
  "success": true,
  "data": {
    "contacts": [...],
    "total": 123
  }
}
```

#### Add Contact
```http
POST /api/marketing/shops/:shopId/contacts
Authorization: Bearer <token>
Role: shop

Body:
{
  "fullName": "John Doe",
  "email": "john@example.com",
  "phone": "+1234567890",
  "tags": ["vip", "new_lead"],
  "notes": "Met at trade show"
}

Response:
{
  "success": true,
  "data": { ...contact }
}
```

#### Bulk Import (CSV)
```http
POST /api/marketing/shops/:shopId/contacts/import
Authorization: Bearer <token>
Role: shop

Body:
{
  "contacts": [
    {
      "fullName": "Jane Smith",
      "email": "jane@example.com",
      "phone": "+9876543210",
      "tags": ["newsletter"]
    },
    ...
  ]
}

Response:
{
  "success": true,
  "data": {
    "created": 45,
    "failed": 2,
    "errors": [
      { "row": 3, "error": "Email already exists" },
      { "row": 7, "error": "Missing contact method" }
    ]
  }
}
```

#### Get Statistics
```http
GET /api/marketing/shops/:shopId/contacts/stats
Authorization: Bearer <token>
Role: shop

Response:
{
  "success": true,
  "data": {
    "total": 150,
    "active": 120,
    "unsubscribed": 15,
    "bounced": 10,
    "invalid": 5,
    "withEmail": 140,
    "withPhone": 130,
    "totalEmailsSent": 350,
    "totalSmsSent": 200
  }
}
```

#### Update Contact
```http
PUT /api/marketing/contacts/:contactId
Authorization: Bearer <token>
Role: shop

Body:
{
  "fullName": "John Doe Jr.",
  "status": "unsubscribed",
  "tags": ["vip"],
  "notes": "Updated contact info"
}

Response:
{
  "success": true,
  "data": { ...updated contact }
}
```

#### Delete Contact
```http
DELETE /api/marketing/contacts/:contactId
Authorization: Bearer <token>
Role: shop

Response:
{
  "success": true,
  "message": "Contact deleted successfully"
}
```

---

## Frontend Implementation (TODO)

### 1. Add Navigation Item

**Location**: Shop sidebar navigation component

Add new tab/menu item:
```tsx
{
  icon: <Mail className="w-5 h-5" />,
  label: "Marketing",
  value: "marketing",
  href: "/shop?tab=marketing"
}
```

### 2. Create Marketing Tab Component

**File**: `frontend/src/components/shop/tabs/MarketingTab.tsx`

**Features**:
- Statistics cards (total contacts, active, emails sent, SMS sent)
- Contact list table with search/filter
- "Import CSV" button
- "Add Contact" button
- Edit/Delete actions per row

**Example Structure**:
```tsx
export function MarketingTab({ shopId }: { shopId: string }) {
  const [contacts, setContacts] = useState([]);
  const [stats, setStats] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Fetch contacts
  // Fetch stats
  // Handle CSV import
  // Handle add/edit/delete

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard title="Total Contacts" value={stats?.total} />
        <StatCard title="Active" value={stats?.active} />
        <StatCard title="Emails Sent" value={stats?.totalEmailsSent} />
        <StatCard title="SMS Sent" value={stats?.totalSmsSent} />
      </div>

      {/* Actions Bar */}
      <div className="flex justify-between">
        <SearchInput value={searchTerm} onChange={setSearchTerm} />
        <div className="flex gap-2">
          <Button onClick={openImportModal}>Import CSV</Button>
          <Button onClick={openAddModal}>Add Contact</Button>
        </div>
      </div>

      {/* Contacts Table */}
      <ContactsTable contacts={contacts} onEdit={handleEdit} onDelete={handleDelete} />
    </div>
  );
}
```

### 3. Create Import CSV Modal

**File**: `frontend/src/components/shop/tabs/modals/ImportContactsModal.tsx`

**Features**:
- CSV file upload
- Parse CSV (columns: Full Name, Email, Phone, Tags)
- Preview parsed data
- Show validation errors
- Submit to `/api/marketing/shops/:shopId/contacts/import`

**CSV Format Example**:
```csv
Full Name,Email,Phone,Tags
John Doe,john@example.com,+1234567890,"vip,newsletter"
Jane Smith,jane@example.com,+9876543210,newsletter
```

### 4. Create Add/Edit Contact Modal

**File**: `frontend/src/components/shop/tabs/modals/ContactModal.tsx`

**Fields**:
- Full Name (required)
- Email (optional, but one contact method required)
- Phone (optional, but one contact method required)
- Tags (multi-select or comma-separated)
- Notes (textarea)
- Status (dropdown: active, unsubscribed, bounced, invalid)

### 5. Create Mass Communication Modal (Future)

**File**: `frontend/src/components/shop/tabs/modals/SendCampaignModal.tsx`

**Features**:
- Campaign name
- Type: Email, SMS, or Both
- Target audience filters (status, tags)
- Message template
- Subject line (for email)
- Preview
- Send now or schedule

---

## API Service Layer

**File**: `frontend/src/services/marketingApi.ts`

```typescript
import axios from 'axios';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export const marketingApi = {
  // Contacts
  getContacts: (shopId: string, params?: { page?: number; limit?: number; status?: string; search?: string }) =>
    axios.get(`${API_BASE}/api/marketing/shops/${shopId}/contacts`, { params }),

  addContact: (shopId: string, data: { fullName: string; email?: string; phone?: string; tags?: string[]; notes?: string }) =>
    axios.post(`${API_BASE}/api/marketing/shops/${shopId}/contacts`, data),

  importContacts: (shopId: string, contacts: Array<{ fullName: string; email?: string; phone?: string; tags?: string[] }>) =>
    axios.post(`${API_BASE}/api/marketing/shops/${shopId}/contacts/import`, { contacts }),

  getContactStats: (shopId: string) =>
    axios.get(`${API_BASE}/api/marketing/shops/${shopId}/contacts/stats`),

  updateContact: (contactId: string, data: any) =>
    axios.put(`${API_BASE}/api/marketing/contacts/${contactId}`, data),

  deleteContact: (contactId: string) =>
    axios.delete(`${API_BASE}/api/marketing/contacts/${contactId}`),
};
```

---

## Email/SMS Integration (Future)

### Email Service Options:

**Option 1: SendGrid**
```bash
npm install @sendgrid/mail
```

**Option 2: AWS SES**
```bash
npm install @aws-sdk/client-ses
```

**Implementation**:
- Create `EmailService.ts` in `backend/src/services/`
- Add SendGrid/SES API keys to `.env`
- Create email templates (welcome, app download link, promotions)
- Handle bounces, unsubscribes, delivery tracking

### SMS Service Options:

**Option 1: Twilio**
```bash
npm install twilio
```

**Option 2: AWS SNS**
```bash
npm install @aws-sdk/client-sns
```

**Implementation**:
- Create `SmsService.ts` in `backend/src/services/`
- Add Twilio/SNS credentials to `.env`
- Create SMS templates (short app download messages)
- Handle opt-outs, delivery tracking

---

## Use Cases

### 1. Shop Owner Imports Leads
1. Shop owner exports customer database from POS system as CSV
2. Opens Marketing tab, clicks "Import CSV"
3. Uploads CSV file with names, emails, phone numbers
4. System validates and imports contacts (shows errors for duplicates)
5. Contacts now available for mass campaigns

### 2. Send App Download Campaign
1. Shop owner clicks "Send Campaign"
2. Selects "Email + SMS"
3. Writes message: "Download our new mobile app! Get 10% off your first repair: [link]"
4. Targets "active" contacts with "vip" tag
5. Schedules for tomorrow 10 AM
6. System sends to 500 contacts
7. Tracks opens, clicks, app downloads

### 3. Manual Contact Addition
1. Shop owner meets potential customer at event
2. Opens Marketing tab, clicks "Add Contact"
3. Enters: John Doe, john@example.com, +1234567890
4. Tags: "trade-show-2026", "vip"
5. Notes: "Interested in iPhone screen repairs"
6. Contact saved for future campaigns

---

## Security & Best Practices

### Data Protection:
- ✅ Shop ownership verification on all endpoints
- ✅ Unique constraints prevent duplicate contacts
- ✅ Email/phone validation before insert
- ✅ Status tracking (bounced, invalid, unsubscribed)

### GDPR/Privacy Compliance:
- [ ] Add unsubscribe links to all emails
- [ ] Honor unsubscribe requests immediately
- [ ] Provide data export for contacts
- [ ] Provide data deletion on request
- [ ] Log all campaign sends for audit

### Rate Limiting:
- [ ] Limit bulk imports (e.g., 1000 contacts per day)
- [ ] Limit campaign sends (e.g., 10,000 emails/day)
- [ ] Throttle API calls to email/SMS providers

### Anti-Spam:
- [ ] Require double opt-in for email campaigns
- [ ] Include sender info in all messages
- [ ] Maintain reputation with email providers
- [ ] Handle bounces and complaints

---

## Testing

### Backend API Tests:
```bash
cd backend
npm run test

# Test contact creation
# Test bulk import with errors
# Test duplicate prevention
# Test search/filter
# Test statistics
```

### Frontend Manual Tests:
1. Add single contact with only email
2. Add single contact with only phone
3. Try adding without both email/phone (should fail)
4. Import CSV with 100 contacts
5. Import CSV with duplicates (check error handling)
6. Search contacts by name
7. Filter by status
8. Edit contact information
9. Delete contact
10. View statistics

---

## Performance Considerations

### Database:
- Indexed: `shop_id`, `status`, `email`, `phone`, `created_at`
- Unique constraints on email/phone per shop
- Pagination on all list endpoints (default 50 per page)

### Bulk Operations:
- CSV import processes one by one (could optimize with batch inserts)
- Error tracking per row for import failures
- Recommended max: 1000 contacts per import

### Campaign Sends:
- Queue-based processing for large campaigns
- Rate limiting to respect provider limits
- Batch sending (e.g., 100 emails at a time)

---

## Future Enhancements

1. **Email Templates**: Pre-built templates for app downloads, promotions
2. **A/B Testing**: Test different subject lines, messages
3. **Analytics Dashboard**: Open rates, click rates, conversion tracking
4. **Automated Campaigns**: Trigger campaigns based on events
5. **Segmentation**: Advanced filters (location, spending, activity)
6. **CRM Integration**: Sync with external CRM systems
7. **WhatsApp Integration**: Send via WhatsApp Business API
8. **Push Notifications**: In-app push for existing users

---

## Migration Rollback

If needed, rollback migration 124:

```sql
DROP TABLE IF EXISTS campaign_recipients;
DROP TABLE IF EXISTS communication_campaigns;
DROP TABLE IF EXISTS contact_imports;
DROP FUNCTION IF EXISTS update_contact_imports_updated_at();
```

---

## Support

For questions or issues:
1. Check API logs: `backend/logs/`
2. Check database: Query `contact_imports` table
3. Review error responses from API endpoints
4. Contact: backend@repaircoin.com

---

**Last Updated**: May 21, 2026
**Version**: 1.0
**Status**: Backend Complete, Frontend Pending
