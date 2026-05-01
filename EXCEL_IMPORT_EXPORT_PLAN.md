# Excel Import/Export Implementation Plan
**RepairCoin - Service Inventory & Customer Management**

## 🎉 Progress Update - April 27, 2026

### ✅ COMPLETED: Frontend Implementation (Phase 1)

**Status**: Frontend for Service Import/Export is 100% complete and ready for backend integration.

**What Was Delivered**:
- ✅ 5 new frontend files created (~1,000 lines of code)
- ✅ TypeScript types and interfaces
- ✅ API service layer with fetch-based file handling
- ✅ ServiceExportModal component (237 lines)
- ✅ ServiceImportModal component (546 lines)
- ✅ ServicesTab integration with Import/Export buttons
- ✅ Full UI/UX implementation matching RepairCoin design system
- ✅ Drag & drop file upload
- ✅ Template download functionality
- ✅ Validation results display
- ✅ Error/warning handling
- ✅ Toast notifications
- ✅ Permission gating (subscription/RCG checks)

**Time Invested**: ~4 hours

---

### ⏳ PENDING: Backend Implementation (Phase 1)

**Status**: Backend APIs and services need to be implemented.

**What Needs to Be Built**:
- ⏳ 4 new backend files (~850 lines of code)
- ⏳ Excel parser utility (parseServiceExcel, validateServiceRow, sanitizeServiceData)
- ⏳ Excel generator utility (generateServiceTemplate, generateServiceExport)
- ⏳ ImportExportService business logic (4-layer validation, import modes)
- ⏳ ImportExportController with 4 API endpoints
- ⏳ Database migration for import_jobs table
- ⏳ Multer file upload middleware configuration
- ⏳ Rate limiting middleware (5 imports/hour)
- ⏳ Unit tests for parser/generator utilities
- ⏳ Integration tests for API endpoints
- ⏳ Error handling and logging

**Dependencies to Install**:
```bash
npm install xlsx csv-parser multer express-rate-limit
npm install --save-dev @types/multer @types/xlsx
```

**Time Estimate**: 17-26 hours (3-4 days)

**Detailed Breakdown**: See [BACKEND_IMPLEMENTATION_TODO.md](./BACKEND_IMPLEMENTATION_TODO.md)

---

### 📊 Overall Progress Summary

| Component | Status | Time Spent | Time Remaining | Progress |
|-----------|--------|------------|----------------|----------|
| Frontend | ✅ Complete | 4 hours | 0 hours | 100% |
| Backend | ⏳ Pending | 0 hours | 17-26 hours | 0% |
| Testing | ⏳ Pending | 0 hours | 4-8 hours | 0% |
| Documentation | ✅ Complete | 1 hour | 0 hours | 100% |
| **Total** | **17% Done** | **5 hours** | **21-34 hours** | **17%** |

**Next Steps**: Backend API implementation (Phase 1 Backend)

---

## Overview
This document outlines the implementation plan for Excel/CSV import and export functionality to enable shops to easily migrate their data from other POS systems to RepairCoin.

### Priority Order
1. **Phase 1**: Service/Inventory Import & Export (HIGH PRIORITY)
   - ✅ **Frontend**: COMPLETED
   - ⏳ **Backend**: PENDING
2. **Phase 2**: Customer Import & Export
3. **Phase 3**: User/Login Management (if needed)

---

## Phase 1: Service/Inventory Import & Export

### 1.1 Data Schema

#### Excel Column Headers (Service Template)
```
Service Name* | Description | Price (USD)* | Duration (Minutes) | Category* | Image URL | Tags | Active Status
```

**Required Fields**: Service Name, Price (USD), Category
**Optional Fields**: Description, Duration (Minutes), Image URL, Tags, Active Status

#### Field Specifications
| Field | Type | Validation Rules | Example |
|-------|------|------------------|---------|
| Service Name | Text | Max 100 chars, Required | "Oil Change - Full Synthetic" |
| Description | Text | Max 5000 chars, Optional, HTML stripped | "Complete oil change service with filter replacement" |
| Price (USD) | Number | > 0, Required, Max 2 decimals | 89.99 |
| Duration (Minutes) | Number | > 0, Optional | 45 |
| Category | Text | Required, Predefined list | "oil_change", "brake_repair", "tire_rotation" |
| Image URL | Text | Valid URL format, Optional, Max 500 chars | "https://example.com/service.jpg" |
| Tags | Text | Comma-separated, Max 5 tags, Max 20 chars each | "synthetic, premium, eco-friendly" |
| Active Status | Boolean | TRUE/FALSE or 1/0, Default: TRUE | TRUE |

#### Service Categories (Predefined)
```javascript
[
  "oil_change",
  "brake_repair",
  "tire_rotation",
  "engine_diagnostic",
  "battery_service",
  "transmission_service",
  "ac_repair",
  "wheel_alignment",
  "exhaust_repair",
  "inspection",
  "detailing",
  "windshield_repair",
  "suspension_repair",
  "other"
]
```

### 1.2 Backend Implementation

#### Required NPM Packages
```bash
npm install xlsx csv-parser multer @types/multer
```

#### New Files to Create

**1. `backend/src/utils/excelParser.ts`**
```typescript
// Utility functions for parsing and validating Excel/CSV files
- parseServiceExcel(buffer: Buffer): Promise<ParsedService[]>
- validateServiceRow(row: any, rowIndex: number): ValidationResult
- sanitizeServiceData(data: any): CleanServiceData
```

**2. `backend/src/utils/excelGenerator.ts`**
```typescript
// Utility functions for generating Excel files
- generateServiceTemplate(): Buffer
- generateServiceExport(services: ShopService[]): Buffer
- formatServiceForExport(service: ShopService): ExportRow
```

**3. `backend/src/domains/ServiceDomain/controllers/ImportExportController.ts`**
```typescript
// Handles import/export HTTP requests
- exportServices(req, res): GET /api/services/export
- downloadTemplate(req, res): GET /api/services/template
- importServices(req, res): POST /api/services/import
- getImportStatus(req, res): GET /api/services/import/:jobId
```

**4. `backend/src/domains/ServiceDomain/services/ImportExportService.ts`**
```typescript
// Business logic for import/export operations
- exportShopServices(shopId: string): Promise<Buffer>
- importShopServices(shopId: string, file: Buffer): Promise<ImportResult>
- validateImportData(data: ParsedService[]): Promise<ValidationReport>
- processImportBatch(services: ParsedService[], shopId: string): Promise<BatchResult>
```

#### API Endpoints

**Export Endpoints**
```
GET /api/services/export
- Auth: Required (Shop role)
- Query Params:
  - format: "xlsx" | "csv" (default: "xlsx")
  - activeOnly: boolean (default: false)
  - category: string (optional filter)
- Response: File download
- File Name: "services_export_YYYY-MM-DD.xlsx"
```

**Template Download**
```
GET /api/services/template
- Auth: Required (Shop role)
- Query Params:
  - format: "xlsx" | "csv" (default: "xlsx")
- Response: File download with sample data
- File Name: "service_import_template.xlsx"
```

**Import Endpoint**
```
POST /api/services/import
- Auth: Required (Shop role)
- Content-Type: multipart/form-data
- Body:
  - file: Excel/CSV file (max 10MB)
  - mode: "replace" | "merge" | "add" (default: "add")
    - replace: Delete all existing services and import new ones
    - merge: Update existing services by name, add new ones
    - add: Only add new services, skip duplicates
  - dryRun: boolean (default: false) - Validate only, don't import
- Response:
  {
    success: boolean,
    jobId: string,
    summary: {
      totalRows: number,
      validRows: number,
      invalidRows: number,
      imported: number,
      updated: number,
      skipped: number
    },
    errors: Array<{
      row: number,
      field: string,
      message: string,
      value: any
    }>,
    warnings: Array<{
      row: number,
      message: string
    }>
  }
```

**Import Status Check**
```
GET /api/services/import/:jobId
- Auth: Required (Shop role)
- Response: Same as import endpoint response
```

### 1.3 Validation Rules

#### Pre-Import Validation
1. **File Validation**
   - File format: .xlsx, .xls, .csv
   - Max file size: 10MB
   - Max rows: 1000 services per import
   - Required headers present

2. **Data Validation (Per Row)**
   - Service Name: Not empty, max 100 chars
   - Price: Positive number, max 2 decimals
   - Category: Must be in predefined list
   - Duration: If provided, must be positive integer
   - Image URL: If provided, must be valid URL format
   - Tags: Max 5 tags, each max 20 chars
   - Active Status: Must be boolean-like (true/false/1/0/yes/no)

3. **Business Validation**
   - Shop must have active subscription OR 10K+ RCG tokens
   - Shop must be verified and active
   - Duplicate service names within import file (warn, not error)
   - Total services after import doesn't exceed shop limit (if any)

#### Error Handling Strategy
- **Stop on Critical Error**: Invalid file format, unauthorized shop
- **Collect All Errors**: Invalid data in rows
- **Return Detailed Report**: Row number, field, error message, invalid value
- **Partial Import Option**: Import valid rows, report invalid rows

### 1.4 Frontend Implementation ✅ COMPLETED

**Status**: All frontend components implemented and integrated.

**Files Created**:
1. ✅ `frontend/src/types/import.ts` (73 lines) - TypeScript type definitions
2. ✅ `frontend/src/services/api/serviceImportExport.ts` (143 lines) - API service layer
3. ✅ `frontend/src/components/shop/modals/ServiceExportModal.tsx` (237 lines)
4. ✅ `frontend/src/components/shop/modals/ServiceImportModal.tsx` (546 lines)
5. ✅ `frontend/src/components/shop/tabs/ServicesTab.tsx` (Updated - added Import/Export buttons)

**Total Code**: ~1,000 lines of TypeScript/React

#### UI/UX Design

**Location**: Shop Dashboard > Services Tab > Actions Menu

**New UI Components**:

1. **Import/Export Dropdown Button**
```
Actions ▼
├── Import Services
├── Export Services
├── Download Template
└── [existing actions...]
```

2. **Import Modal** (`frontend/src/components/shop/ServiceImportModal.tsx`)
```
Components:
- File upload dropzone (drag & drop support)
- Import mode selector (Add/Merge/Replace)
- Dry run checkbox
- Progress indicator
- Validation results table
- Error/warning display
```

3. **Export Options Modal** (`frontend/src/components/shop/ServiceExportModal.tsx`)
```
Options:
- File format (Excel/CSV)
- Include inactive services checkbox
- Category filter dropdown
- Export button
```

#### User Flow

**Export Flow**:
1. User clicks "Export Services" in Actions menu
2. Modal opens with export options
3. User selects format and filters
4. User clicks "Export"
5. File downloads automatically
6. Success toast notification

**Import Flow**:
1. User clicks "Import Services" in Actions menu
2. Modal opens with file upload area
3. User drags/drops or selects file
4. User selects import mode (Add/Merge/Replace)
5. User checks "Dry Run" to validate first (recommended)
6. User clicks "Import"
7. Progress indicator shows upload and validation
8. Results displayed:
   - Success: Show summary with counts
   - Errors: Show table with row numbers and error messages
   - Warnings: Show list of warnings (e.g., duplicate names)
9. If dry run successful, user clicks "Confirm Import"
10. Actual import executes
11. Success toast notification with summary

**Template Download Flow**:
1. User clicks "Download Template"
2. Modal shows sample data preview
3. User selects format (Excel/CSV)
4. Template downloads with sample rows
5. User fills out template in Excel/Google Sheets
6. User uploads via Import flow

#### Frontend API Services

**New file**: `frontend/src/services/api/serviceImportExport.ts`

```typescript
export const serviceImportExportAPI = {
  exportServices: (params: ExportParams) => Promise<Blob>,
  downloadTemplate: (format: 'xlsx' | 'csv') => Promise<Blob>,
  importServices: (file: File, options: ImportOptions) => Promise<ImportResult>,
  getImportStatus: (jobId: string) => Promise<ImportResult>
}
```

### 1.5 Error Messages & User Feedback

#### Validation Error Messages
```javascript
{
  "MISSING_REQUIRED_FIELD": "Required field '{field}' is missing in row {row}",
  "INVALID_PRICE": "Price must be a positive number in row {row}",
  "INVALID_CATEGORY": "Category '{value}' is not valid in row {row}. Must be one of: {validCategories}",
  "SERVICE_NAME_TOO_LONG": "Service name exceeds 100 characters in row {row}",
  "TOO_MANY_TAGS": "Maximum 5 tags allowed in row {row}",
  "INVALID_URL": "Image URL is not valid in row {row}",
  "DUPLICATE_SERVICE_NAME": "Service name '{name}' appears multiple times in import file",
  "INVALID_FILE_FORMAT": "File must be .xlsx, .xls, or .csv format",
  "FILE_TOO_LARGE": "File size exceeds 10MB limit",
  "TOO_MANY_ROWS": "Import limited to 1000 services per file",
  "SHOP_NOT_QUALIFIED": "Active subscription or 10K+ RCG tokens required to import services"
}
```

#### Success Messages
```javascript
{
  "EXPORT_SUCCESS": "Successfully exported {count} services",
  "IMPORT_SUCCESS": "Successfully imported {imported} services, updated {updated} services",
  "TEMPLATE_DOWNLOADED": "Template downloaded successfully",
  "VALIDATION_SUCCESS": "All {count} rows validated successfully. Ready to import."
}
```

### 1.6 Implementation Steps

#### Backend Steps (16-24 hours) ⏳ PENDING
1. ⏳ Install dependencies (xlsx, csv-parser, multer)
2. ⏳ Create `excelParser.ts` utility
3. ⏳ Create `excelGenerator.ts` utility
4. ⏳ Create `ImportExportService.ts` service
5. ⏳ Create `ImportExportController.ts` controller
6. ⏳ Add routes to ServiceDomain
7. ⏳ Create database migrations if needed
8. ⏳ Add Multer middleware for file uploads
9. ⏳ Implement validation logic
10. ⏳ Add error handling and logging
11. ⏳ Write unit tests for parsing logic
12. ⏳ Write integration tests for API endpoints
13. ⏳ Test with sample Excel files

**Backend Status**: NOT STARTED - Awaiting implementation

#### Frontend Steps (12-16 hours) ✅ COMPLETED
1. ✅ Create `ServiceImportModal.tsx` component (546 lines)
2. ✅ Create `ServiceExportModal.tsx` component (237 lines)
3. ✅ Add import/export buttons to Services page
4. ✅ Create `serviceImportExport.ts` API service (143 lines)
5. ✅ Create `import.ts` type definitions (73 lines)
6. ✅ Implement file upload with drag & drop
7. ✅ Add progress indicators (3 view states)
8. ✅ Implement results display (success/errors table)
9. ✅ Add toast notifications (success/error/info)
10. ✅ Style components with existing design system
11. ✅ Add loading states (spinners, disabled buttons)
12. ✅ Mobile responsiveness check

**Frontend Status**: COMPLETED on April 27, 2026

**Time Breakdown**:
- ✅ Frontend: 4 hours (COMPLETED)
- ⏳ Backend: 16-24 hours (PENDING)
- ⏳ Testing: 4-8 hours (PENDING)

**Total Estimated Time for Phase 1: 24-36 hours** (4 completed, 20-32 remaining)

---

## Phase 2: Customer Import & Export

### 2.1 Data Schema

#### Excel Column Headers (Customer Template)
```
Wallet Address* | Name | First Name | Last Name | Email | Phone | Tier | Lifetime Earnings | Active Status | Referral Code | Referred By
```

**Required Fields**: Wallet Address
**Optional Fields**: All others (but recommended for complete migration)

#### Field Specifications
| Field | Type | Validation Rules | Example |
|-------|------|------------------|---------|
| Wallet Address | Text | 42 chars, Starts with 0x, Required, Unique | "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1" |
| Name | Text | Max 255 chars, Optional | "John Doe" |
| First Name | Text | Max 255 chars, Optional | "John" |
| Last Name | Text | Max 255 chars, Optional | "Doe" |
| Email | Text | Valid email format, Optional, Max 255 chars | "john.doe@example.com" |
| Phone | Text | Max 20 chars, Optional | "+1-555-123-4567" |
| Tier | Text | BRONZE/SILVER/GOLD, Default: BRONZE | "SILVER" |
| Lifetime Earnings | Number | >= 0, Default: 0 | 150.00 |
| Active Status | Boolean | TRUE/FALSE or 1/0, Default: TRUE | TRUE |
| Referral Code | Text | Optional, Auto-generated if empty | "JOHN2024" |
| Referred By | Text | Valid referral code or wallet, Optional | "JANE2024" |

### 2.2 Backend Implementation

Similar structure to Phase 1, with these new files:

**New Files**:
- `backend/src/utils/customerExcelParser.ts`
- `backend/src/utils/customerExcelGenerator.ts`
- `backend/src/domains/customer/controllers/CustomerImportExportController.ts`
- `backend/src/domains/customer/services/CustomerImportExportService.ts`

**API Endpoints**:
```
GET /api/customers/export
GET /api/customers/template
POST /api/customers/import
GET /api/customers/import/:jobId
```

### 2.3 Validation Rules

1. **Wallet Address Validation**
   - Must be valid Ethereum address (0x + 40 hex chars)
   - Must be unique (no duplicates in system)
   - Case-insensitive comparison

2. **Email Validation**
   - Must be valid email format if provided
   - Unique per customer (warn if duplicate)

3. **Tier Validation**
   - Must be BRONZE, SILVER, or GOLD
   - Case-insensitive

4. **Referral Validation**
   - Referral code must exist in system if provided
   - Cannot refer themselves

5. **Business Rules**
   - Shop can only import customers they have permission to manage
   - Admin can import all customers
   - Lifetime earnings cannot be negative

### 2.4 Frontend Implementation

**Location**: Admin Dashboard > Customers Tab > Actions Menu
(Similar UI pattern as Phase 1)

**Total Estimated Time for Phase 2: 24-32 hours**

---

## Phase 3: User/Login Management (Optional)

### 3.1 Scope Clarification Needed
- What user data needs to be imported?
- Is this for shop staff accounts?
- Or customer login credentials?
- Authentication method (wallet-based, email/password)?

**Recommendation**: Discuss with client before implementing. May not be needed if:
- Using wallet-based authentication (no passwords to migrate)
- Staff accounts managed separately
- Customer authentication tied to wallet addresses

**Total Estimated Time for Phase 3: TBD (pending scope)**

---

## Technical Considerations

### 1. File Size & Performance
- **Max file size**: 10MB per upload
- **Max rows**: 1000 per import (can be increased if needed)
- **Batch processing**: Process in chunks of 100 rows to avoid timeout
- **Background jobs**: For large imports, use job queue (optional enhancement)

### 2. Database Transactions
- Use transactions for import operations
- Rollback on critical errors
- Commit successful batches

### 3. Image Handling
- Image URLs in import should be validated but not downloaded
- Shops should upload images separately or provide valid CDN URLs
- Consider future enhancement: Bulk image upload

### 4. Data Mapping
- Map common POS system formats to RepairCoin schema
- Support flexible column naming (e.g., "Service Name" = "ServiceName" = "service_name")
- Provide mapping tool in future version

### 5. Security
- Validate file type server-side (not just extension)
- Limit file uploads to authenticated shop users
- Rate limit import operations (e.g., 5 imports per hour)
- Sanitize all input data (XSS prevention)
- Log all import/export operations for audit trail

### 6. Compatibility
- **Excel**: Support .xlsx and .xls formats
- **CSV**: Support UTF-8 encoding
- **Google Sheets**: Export as .xlsx or .csv first
- Test with common POS systems: Square, Clover, Shopify POS

---

## Sample Excel Templates

### Service Template Example
```
| Service Name           | Description                      | Price (USD) | Duration (Minutes) | Category       | Image URL                        | Tags                  | Active Status |
|------------------------|----------------------------------|-------------|-------------------|----------------|----------------------------------|-----------------------|---------------|
| Oil Change - Synthetic | Full synthetic oil change        | 89.99       | 45                | oil_change     | https://cdn.example.com/oil.jpg  | synthetic,premium     | TRUE          |
| Brake Pad Replacement  | Front brake pads replacement     | 149.99      | 60                | brake_repair   |                                  | brakes,safety         | TRUE          |
| Tire Rotation         | 4-tire rotation and balancing    | 29.99       | 30                | tire_rotation  |                                  | maintenance           | TRUE          |
```

### Customer Template Example
```
| Wallet Address                              | Name      | First Name | Last Name | Email              | Phone          | Tier   | Lifetime Earnings | Active Status | Referral Code | Referred By |
|---------------------------------------------|-----------|------------|-----------|--------------------|----------------|--------|-------------------|---------------|---------------|-------------|
| 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1  | John Doe  | John       | Doe       | john@example.com   | +1-555-0100   | SILVER | 250.00            | TRUE          | JOHN2024      |             |
| 0x8B3c5F7D2E1A9C4B6D8E0F2A5C7E9B1D3F5A7C9  | Jane Smith| Jane       | Smith     | jane@example.com   | +1-555-0200   | GOLD   | 500.00            | TRUE          | JANE2024      | JOHN2024    |
```

---

## Testing Strategy

### Unit Tests
- Test Excel parsing functions
- Test data validation functions
- Test export generation functions
- Test error handling

### Integration Tests
- Test full import flow with sample files
- Test export flow
- Test template download
- Test error scenarios (invalid data, large files)

### Manual Testing
- Import from Square export
- Import from CSV
- Import with validation errors
- Import with 1000 rows
- Export all services
- Export with filters
- Test on mobile devices
- Test with slow internet connection

### User Acceptance Testing
- Have shop owner test with their actual POS data
- Verify all data mapped correctly
- Verify images display properly
- Verify no data loss

---

## Rollout Plan

### Phase 1: Beta Testing (1 week)
1. Deploy to test environment
2. Select 2-3 beta shop users
3. Provide documentation and training
4. Collect feedback
5. Fix critical bugs

### Phase 2: Production Release (1 week)
1. Deploy to production
2. Announce feature to all shops
3. Provide video tutorial
4. Monitor error logs
5. Provide support for data migration

### Phase 3: Iteration (Ongoing)
1. Collect user feedback
2. Add requested features (e.g., auto-mapping, bulk image upload)
3. Support additional POS formats
4. Improve validation messages
5. Optimize performance

---

## Success Metrics

### Technical Metrics
- Import success rate > 95%
- Average import time < 30 seconds for 100 services
- Export time < 10 seconds for 1000 services
- File validation accuracy > 99%
- Zero data corruption incidents

### Business Metrics
- Number of shops using import feature
- Number of services migrated
- Number of customers migrated
- Time saved vs manual entry (estimated)
- User satisfaction rating (survey)

---

## Documentation Deliverables

### For Developers
1. API documentation (Swagger/OpenAPI)
2. Code comments and JSDoc
3. Architecture decision records
4. Testing documentation

### For Shop Owners
1. Video tutorial (5-10 minutes)
2. Written guide with screenshots
3. FAQ document
4. Sample templates with example data
5. Troubleshooting guide

### For Support Team
1. Common issues and solutions
2. Validation error code reference
3. Escalation procedures
4. Data recovery procedures

---

## Budget & Timeline

### Development Time Estimates
- **Phase 1 (Services)**: 28-40 hours = 3-5 days
- **Phase 2 (Customers)**: 24-32 hours = 3-4 days
- **Phase 3 (Users)**: TBD
- **Testing & QA**: 16-24 hours = 2-3 days
- **Documentation**: 8-12 hours = 1-2 days
- **Deployment**: 4-8 hours = 1 day

**Total Time**: 80-116 hours (10-15 days)

### Dependencies
- Shop owner must provide sample export from current POS
- Client approval on data schema and UI mockups
- Backend infrastructure (file storage, job queue if needed)

---

## Future Enhancements

1. **Scheduled Exports**
   - Auto-export services daily/weekly
   - Email export file to shop owner
   - Cloud backup integration

2. **Advanced Mapping**
   - Smart column detection
   - Custom field mapping UI
   - Save mapping presets per POS system

3. **Bulk Image Upload**
   - Upload images as ZIP file
   - Match by filename to service name
   - Automatic image optimization

4. **Import History**
   - View past imports
   - Download import files
   - Rollback imports

5. **Sync Integrations**
   - Two-way sync with Square, Clover
   - Real-time inventory updates
   - Webhook-based sync

6. **Multi-Shop Import**
   - Import services to multiple shops at once
   - Template for shop network chains

7. **Data Cleanup Tools**
   - Duplicate detection
   - Bulk editing
   - Data standardization

---

## Questions for Client

1. **Sample Data**: Can you provide a sample export from your current POS system (Square, based on screenshots)?

2. **Import Mode**: What should happen to existing services when importing?
   - Replace all existing services?
   - Merge/update by service name?
   - Only add new services?

3. **Image Handling**: How do shops currently manage service images?
   - Manual upload per service?
   - Stored in POS system?
   - External CDN?

4. **Customer Data**: Do you need to import customer transaction history too?
   - Just customer profiles?
   - Include past purchases/services?

5. **Priority**: Confirm priority order (Services > Customers > Users)?

6. **Timeline**: Target release date for this feature?

7. **Limits**: Any limits on:
   - Number of services per shop?
   - File size?
   - Import frequency?

---

## Next Steps

1. **Client Approval**: Review and approve this plan
2. **Provide Sample Data**: Share sample POS export file
3. **UI Mockups**: Create mockups for import/export modals (if needed)
4. **Kickoff Development**: Begin Phase 1 backend implementation
5. **Set Up Test Environment**: Prepare test shop accounts

---

## Contact & Support

For questions about this plan, contact:
- Developer: [Your name]
- Client: FixFlow.ai
- Project: RepairCoin

**Document Version**: 1.0
**Last Updated**: 2026-04-27
**Status**: Pending Client Approval
