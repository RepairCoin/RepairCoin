# Backend Implementation TODO
**Excel Import/Export Feature - Service Management**
**Status:** NOT STARTED
**Estimated Time:** 16-24 hours
**Priority:** HIGH

---

## ⏳ What Needs to Be Implemented

### 📦 Backend Files to Create (4 new files + 1 migration)

#### 1. Excel Parser Utility ⏳ REQUIRED
**File:** `backend/src/utils/excelParser.ts` (~200 lines)

**Functions to Implement:**
```typescript
// Main parsing function
export async function parseServiceExcel(
  buffer: Buffer,
  fileType: 'xlsx' | 'xls' | 'csv'
): Promise<ParsedService[]>

// Row validation
export function validateServiceRow(
  row: any,
  rowIndex: number,
  shopId: string
): ValidationResult

// Data sanitization
export function sanitizeServiceData(data: any): CleanServiceData

// Column name mapping (flexible aliases)
export function mapColumnHeaders(headers: string[]): ColumnMapping
```

**Key Requirements:**
- ✅ Parse .xlsx files using `xlsx` library
- ✅ Parse .xls files using `xlsx` library
- ✅ Parse .csv files using `csv-parser`
- ✅ Flexible column name matching (e.g., "Service Name" = "ServiceName" = "service_name")
- ✅ Return array of parsed objects with original row numbers
- ✅ Handle malformed files gracefully
- ✅ Strip HTML from text fields (XSS prevention)
- ✅ Validate data types (string, number, boolean, URL)

**Dependencies:**
```bash
npm install xlsx csv-parser
npm install --save-dev @types/xlsx
```

---

#### 2. Excel Generator Utility ⏳ REQUIRED
**File:** `backend/src/utils/excelGenerator.ts` (~200 lines)

**Functions to Implement:**
```typescript
// Generate blank template
export function generateServiceTemplate(
  format: 'xlsx' | 'csv',
  includeSamples: boolean = true
): Buffer

// Generate export file
export function generateServiceExport(
  services: ShopService[],
  format: 'xlsx' | 'csv',
  options: ExportOptions
): Buffer

// Format service for export
export function formatServiceForExport(
  service: ShopService
): ExportRow
```

**Key Requirements:**
- ✅ Generate Excel files with proper headers
- ✅ Include 3-5 sample data rows in template
- ✅ Color-code required vs optional columns (Excel only)
- ✅ Add data validation dropdowns for categories (Excel only)
- ✅ Add cell comments with field descriptions (Excel only)
- ✅ Format numbers with proper decimals
- ✅ Format booleans as TRUE/FALSE
- ✅ Convert arrays (tags) to comma-separated strings
- ✅ Handle null/undefined values gracefully

**Template Structure:**
```
Row 1: Column Headers (bold, frozen)
Row 2: Data type hints (String, Number, etc.)
Row 3-7: Sample data (if includeSamples=true)
```

---

#### 3. Import/Export Service Layer ⏳ REQUIRED
**File:** `backend/src/domains/ServiceDomain/services/ImportExportService.ts` (~400 lines)

**Functions to Implement:**
```typescript
// Export services
export async function exportShopServices(
  shopId: string,
  options: ExportOptions
): Promise<Buffer>

// Import services
export async function importShopServices(
  shopId: string,
  fileBuffer: Buffer,
  fileName: string,
  options: ImportOptions
): Promise<ImportResult>

// Validate import data
export async function validateImportData(
  services: ParsedService[],
  shopId: string
): Promise<ValidationReport>

// Process import batch
export async function processImportBatch(
  services: ValidatedService[],
  shopId: string,
  mode: ImportMode
): Promise<BatchResult>
```

**Key Requirements:**

**4-Layer Validation:**
1. **File-Level Validation:**
   - File format (MIME type + magic number)
   - File size (max 10MB)
   - File integrity (parseable)
   - Header row present
   - Required columns present
   - Row count (1-1000)

2. **Schema Validation:**
   - Column name matching
   - Data type validation
   - Required field presence
   - String length limits
   - Number range limits
   - Format validation (URLs, emails)

3. **Business Rule Validation:**
   - Shop qualification (subscription OR 10K+ RCG)
   - Shop active and verified
   - Category in predefined list
   - Price > 0 and < $10,000
   - Duration 1-1440 minutes
   - Tags: max 5, each max 20 chars
   - Duplicate detection within file

4. **Security Validation:**
   - XSS prevention (HTML stripping)
   - SQL injection prevention (parameterized queries)
   - URL validation (http/https only)
   - Rate limiting check
   - Magic number validation

**Import Logic:**
```typescript
// Import modes
switch (mode) {
  case 'add':
    // Only insert new services, skip duplicates
    break;
  case 'merge':
    // Update existing by name, insert new
    break;
  case 'replace':
    // Delete all existing, insert all new
    break;
}
```

**Transaction Handling:**
```typescript
const client = await pool.connect();
try {
  await client.query('BEGIN');

  // Import operations here

  await client.query('COMMIT');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
}
```

---

#### 4. Import/Export Controller ⏳ REQUIRED
**File:** `backend/src/domains/ServiceDomain/controllers/ImportExportController.ts` (~350 lines)

**Endpoints to Implement:**

**1. Export Services**
```typescript
export async function exportServices(
  req: Request,
  res: Response
): Promise<void>

Route: GET /api/services/export
Auth: Required (Shop role)
Query Params:
  - format: 'xlsx' | 'csv' (default: 'xlsx')
  - activeOnly: boolean (default: false)
  - category: string (optional)
  - includeMetadata: boolean (default: false)

Response:
  - Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
  - Content-Disposition: attachment; filename="services_export_YYYY-MM-DD.xlsx"
  - Headers:
    - X-Total-Services: number
    - X-Export-Timestamp: ISO 8601
    - X-Export-Version: "1.0"
  - Body: Binary file stream

Error Responses:
  - 401: Unauthorized
  - 403: Forbidden (not a shop user)
  - 404: Shop not found
  - 500: Export generation failed
```

**2. Download Template**
```typescript
export async function downloadTemplate(
  req: Request,
  res: Response
): Promise<void>

Route: GET /api/services/template
Auth: Required (Shop role)
Query Params:
  - format: 'xlsx' | 'csv' (default: 'xlsx')
  - includeSamples: boolean (default: true)

Response:
  - Same as export endpoint
  - Filename: "service_import_template.xlsx"

Performance:
  - Response time: < 1 second (pre-generated, cached)
  - File size: ~15KB xlsx, ~2KB csv
```

**3. Import Services**
```typescript
export async function importServices(
  req: Request,
  res: Response
): Promise<void>

Route: POST /api/services/import
Auth: Required (Shop role)
Content-Type: multipart/form-data

Middleware:
  - multer file upload middleware
  - rate limiting (5 imports/hour)

Form Fields:
  - file: File (required, max 10MB)
  - mode: 'add' | 'merge' | 'replace' (default: 'add')
  - dryRun: boolean (default: false)
  - onDuplicateName: 'skip' | 'update' | 'rename' | 'error' (default: 'skip')

Response (200 OK):
{
  "success": true,
  "jobId": "import_20260427_143022_abc123",
  "summary": {
    "totalRows": 150,
    "validRows": 145,
    "invalidRows": 5,
    "imported": 145,
    "updated": 0,
    "skipped": 0,
    "deleted": 0
  },
  "errors": [
    {
      "row": 12,
      "column": "Price (USD)",
      "value": "invalid",
      "message": "Price must be a valid number",
      "severity": "error",
      "code": "INVALID_PRICE"
    }
  ],
  "warnings": [],
  "metadata": {
    "uploadedAt": "2026-04-27T14:30:22Z",
    "uploadedBy": "0x742d35...",
    "shopId": "shop_abc123",
    "fileName": "services.xlsx",
    "fileSize": 45678,
    "processingTime": 3.2,
    "mode": "add",
    "dryRun": false
  }
}

Error Responses:
  - 400: Validation errors
  - 401: Unauthorized
  - 403: Shop not qualified
  - 413: File too large
  - 422: Invalid file format
  - 429: Rate limit exceeded
  - 500: Server error
```

**4. Get Import Status**
```typescript
export async function getImportStatus(
  req: Request,
  res: Response
): Promise<void>

Route: GET /api/services/import/:jobId
Auth: Required (Shop role)
Path Params:
  - jobId: string

Response (200 OK):
{
  "jobId": "import_20260427_143022_abc123",
  "status": "completed",
  "progress": 100,
  "result": { /* same as import response */ },
  "createdAt": "2026-04-27T14:30:22Z",
  "completedAt": "2026-04-27T14:30:55Z",
  "processingTime": 33.5
}

Error Responses:
  - 401: Unauthorized
  - 403: Not authorized to view this job
  - 404: Job not found or expired
  - 500: Server error
```

---

#### 5. Database Migration ⏳ REQUIRED
**File:** `backend/migrations/XXX_create_import_jobs_table.sql` (~40 lines)

**SQL to Create:**
```sql
CREATE TABLE import_jobs (
  job_id VARCHAR(100) PRIMARY KEY,
  shop_id VARCHAR(100) NOT NULL REFERENCES shops(shop_id),
  entity_type VARCHAR(20) NOT NULL CHECK (entity_type IN ('service', 'customer')),
  status VARCHAR(20) DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
  mode VARCHAR(20) NOT NULL CHECK (mode IN ('add', 'merge', 'replace')),
  dry_run BOOLEAN DEFAULT false,

  file_name VARCHAR(255) NOT NULL,
  file_size INTEGER NOT NULL,
  file_type VARCHAR(50) NOT NULL,

  total_rows INTEGER DEFAULT 0,
  valid_rows INTEGER DEFAULT 0,
  invalid_rows INTEGER DEFAULT 0,
  imported_count INTEGER DEFAULT 0,
  updated_count INTEGER DEFAULT 0,
  skipped_count INTEGER DEFAULT 0,
  deleted_count INTEGER DEFAULT 0,

  errors JSONB DEFAULT '[]',
  warnings JSONB DEFAULT '[]',
  metadata JSONB DEFAULT '{}',

  progress INTEGER DEFAULT 0,
  uploaded_by VARCHAR(42) NOT NULL,

  created_at TIMESTAMP DEFAULT NOW(),
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  processing_time NUMERIC(10, 2),

  expires_at TIMESTAMP DEFAULT (NOW() + INTERVAL '24 hours'),

  FOREIGN KEY (shop_id) REFERENCES shops(shop_id) ON DELETE CASCADE
);

CREATE INDEX idx_import_jobs_shop_id ON import_jobs(shop_id);
CREATE INDEX idx_import_jobs_status ON import_jobs(status);
CREATE INDEX idx_import_jobs_created_at ON import_jobs(created_at DESC);
CREATE INDEX idx_import_jobs_expires_at ON import_jobs(expires_at);
```

**Purpose:**
- Track import job status
- Store validation results
- Enable job status polling
- Automatic cleanup after 24 hours

---

### 🔧 Middleware & Configuration

#### 1. Multer Configuration ⏳ REQUIRED
**File:** `backend/src/middleware/fileUpload.ts` (~50 lines)

```typescript
import multer from 'multer';
import path from 'path';

const storage = multer.memoryStorage();

const fileFilter = (req: any, file: any, cb: any) => {
  const allowedMimes = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'application/vnd.ms-excel', // .xls
    'text/csv' // .csv
  ];

  const allowedExts = ['.xlsx', '.xls', '.csv'];
  const ext = path.extname(file.originalname).toLowerCase();

  if (allowedMimes.includes(file.mimetype) && allowedExts.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only .xlsx, .xls, and .csv allowed.'));
  }
};

export const uploadMiddleware = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 1,
    fields: 10,
    parts: 15
  },
  fileFilter: fileFilter
});
```

---

#### 2. Rate Limiting ⏳ REQUIRED
**File:** `backend/src/middleware/importRateLimit.ts` (~30 lines)

```typescript
import rateLimit from 'express-rate-limit';

export const importRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 requests per hour
  message: {
    success: false,
    error: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many import requests. Please try again in an hour.',
    resetAt: null // Set dynamically
  },
  keyGenerator: (req) => {
    return req.user.shopId; // Rate limit per shop
  },
  skip: (req) => {
    return req.user.role === 'admin'; // Admins bypass
  }
});
```

---

#### 3. Route Registration ⏳ REQUIRED
**File:** `backend/src/domains/ServiceDomain/routes.ts` (Update existing)

```typescript
import { uploadMiddleware } from '../../middleware/fileUpload';
import { importRateLimiter } from '../../middleware/importRateLimit';
import * as ImportExportController from './controllers/ImportExportController';

// Export routes
router.get('/export',
  auth,
  permissions.requireShop,
  ImportExportController.exportServices
);

router.get('/template',
  auth,
  permissions.requireShop,
  ImportExportController.downloadTemplate
);

// Import routes
router.post('/import',
  auth,
  permissions.requireShop,
  importRateLimiter,
  uploadMiddleware.single('file'),
  ImportExportController.importServices
);

router.get('/import/:jobId',
  auth,
  permissions.requireShop,
  ImportExportController.getImportStatus
);
```

---

### 📋 Service Categories Constant ⏳ REQUIRED

**Add to:** `backend/src/domains/ServiceDomain/constants.ts`

```typescript
export const SERVICE_CATEGORIES = [
  'repairs',
  'beauty_personal_care',
  'health_wellness',
  'fitness_gyms',
  'automotive_services',
  'home_cleaning_services',
  'pets_animal_care',
  'professional_services',
  'education_classes',
  'tech_it_services',
  'food_beverage',
  'other_local_services'
] as const;

export type ServiceCategory = typeof SERVICE_CATEGORIES[number];

export const CATEGORY_LABELS: Record<ServiceCategory, string> = {
  'repairs': 'Repairs',
  'beauty_personal_care': 'Beauty & Personal Care',
  'health_wellness': 'Health & Wellness',
  'fitness_gyms': 'Fitness & Gyms',
  'automotive_services': 'Automotive Services',
  'home_cleaning_services': 'Home & Cleaning Services',
  'pets_animal_care': 'Pets & Animal Care',
  'professional_services': 'Professional Services',
  'education_classes': 'Education & Classes',
  'tech_it_services': 'Tech & IT Services',
  'food_beverage': 'Food & Beverage',
  'other_local_services': 'Other Local Services'
};
```

---

### 🧪 Testing Requirements

#### 1. Unit Tests ⏳ REQUIRED
**File:** `backend/src/__tests__/excelParser.test.ts`

```typescript
describe('excelParser', () => {
  test('should parse valid XLSX file');
  test('should parse valid CSV file');
  test('should handle missing required fields');
  test('should validate price is positive');
  test('should validate category is valid');
  test('should strip HTML from text fields');
  test('should handle malformed files gracefully');
  test('should detect duplicate service names');
});
```

#### 2. Integration Tests ⏳ REQUIRED
**File:** `backend/src/__tests__/importExport.integration.test.ts`

```typescript
describe('Import/Export API', () => {
  test('POST /api/services/import - valid file');
  test('POST /api/services/import - invalid file format');
  test('POST /api/services/import - file too large');
  test('POST /api/services/import - validation errors');
  test('POST /api/services/import - dry run mode');
  test('POST /api/services/import - replace mode');
  test('GET /api/services/export - xlsx format');
  test('GET /api/services/export - csv format');
  test('GET /api/services/template - with samples');
  test('GET /api/services/import/:jobId - valid job');
});
```

---

### 📊 Error Code Definitions ⏳ REQUIRED

**File:** `backend/src/domains/ServiceDomain/errors.ts`

```typescript
export const IMPORT_ERROR_CODES = {
  // File-level errors
  INVALID_FILE_FORMAT: 'File must be .xlsx, .xls, or .csv format',
  FILE_TOO_LARGE: 'File size exceeds 10MB limit',
  TOO_MANY_ROWS: 'Import limited to 1000 services per file',
  MISSING_HEADERS: 'Required column headers not found',

  // Field validation errors
  MISSING_REQUIRED_FIELD: 'Required field {field} is missing in row {row}',
  INVALID_PRICE: 'Price must be a positive number in row {row}',
  INVALID_CATEGORY: 'Category {value} is not valid in row {row}',
  SERVICE_NAME_TOO_LONG: 'Service name exceeds 100 characters in row {row}',
  TOO_MANY_TAGS: 'Maximum 5 tags allowed in row {row}',
  INVALID_URL: 'Image URL is not valid in row {row}',
  INVALID_DURATION: 'Duration must be between 1-1440 minutes in row {row}',

  // Business rule errors
  DUPLICATE_SERVICE_NAME: 'Service name {name} appears multiple times',
  SHOP_NOT_QUALIFIED: 'Active subscription or 10K+ RCG tokens required',
  SHOP_NOT_ACTIVE: 'Shop must be active to import services',
  SHOP_NOT_VERIFIED: 'Shop must be verified to import services',

  // Rate limiting
  RATE_LIMIT_EXCEEDED: 'Too many import requests. Please try again later'
};
```

---

### 🔐 Security Checklist

#### File Upload Security ⏳ REQUIRED
- [ ] Magic number validation (file signature check)
- [ ] MIME type validation
- [ ] File extension validation
- [ ] File size limit (10MB)
- [ ] Row count limit (1000)
- [ ] Rate limiting (5/hour, 20/day)
- [ ] XSS prevention (HTML stripping)
- [ ] SQL injection prevention (parameterized queries)
- [ ] URL validation (http/https only)
- [ ] No path traversal in filenames

#### Data Validation ⏳ REQUIRED
- [ ] Required field validation
- [ ] Data type validation
- [ ] String length limits
- [ ] Number range limits
- [ ] Format validation (URLs, emails)
- [ ] Category whitelist validation
- [ ] Tag count and length limits
- [ ] Boolean normalization
- [ ] NULL handling

---

### ⚡ Performance Requirements

#### Response Times ⏳ REQUIRED
- Export (1000 services): < 10 seconds
- Template download: < 1 second (cached)
- Import validation (1000 rows): < 30 seconds
- Import execution (1000 rows): < 60 seconds

#### Memory Usage ⏳ REQUIRED
- File processing: < 100MB per request
- No memory leaks
- Proper buffer cleanup
- Connection pool management

#### Database Performance ⏳ REQUIRED
- Batch inserts (100 rows at a time)
- Transaction-based imports
- Proper indexing on import_jobs table
- Query optimization for exports

---

### 📝 Logging Requirements ⏳ REQUIRED

**Add structured logging:**
```typescript
// Import started
logger.info('Import started', {
  jobId,
  shopId,
  uploadedBy,
  fileName,
  fileSize,
  mode,
  dryRun
});

// Validation completed
logger.info('Import validation completed', {
  jobId,
  totalRows,
  validRows,
  invalidRows,
  processingTime
});

// Import completed
logger.info('Import completed successfully', {
  jobId,
  imported,
  updated,
  skipped,
  processingTime
});

// Import failed
logger.error('Import failed', {
  jobId,
  error: error.message,
  stack: error.stack,
  failedAt
});
```

---

## 🚀 Implementation Checklist

### Phase 1: Setup (2-3 hours)
- [ ] Install dependencies (xlsx, csv-parser, multer)
- [ ] Create database migration for import_jobs table
- [ ] Run migration on development database
- [ ] Create directory structure for new files
- [ ] Set up TypeScript types/interfaces

### Phase 2: Core Utilities (4-6 hours)
- [ ] Implement excelParser.ts
- [ ] Implement excelGenerator.ts
- [ ] Write unit tests for utilities
- [ ] Test with sample Excel/CSV files
- [ ] Handle edge cases (empty files, malformed data)

### Phase 3: Service Layer (4-6 hours)
- [ ] Implement ImportExportService.ts
- [ ] Implement 4-layer validation
- [ ] Implement import modes (add/merge/replace)
- [ ] Implement transaction handling
- [ ] Write unit tests for service layer

### Phase 4: Controller & Routes (3-4 hours)
- [ ] Implement ImportExportController.ts
- [ ] Create Multer middleware
- [ ] Create rate limiting middleware
- [ ] Register routes in ServiceDomain
- [ ] Test endpoints with Postman/Thunder Client

### Phase 5: Testing (3-5 hours)
- [ ] Write integration tests
- [ ] Test with frontend
- [ ] Test error scenarios
- [ ] Test large files (1000 rows)
- [ ] Test different file formats
- [ ] Test rate limiting
- [ ] Test permission checks

### Phase 6: Documentation & Cleanup (1-2 hours)
- [ ] Add API documentation (Swagger)
- [ ] Add inline code comments
- [ ] Update README
- [ ] Create sample Excel files for testing
- [ ] Code review
- [ ] Merge to main branch

---

## 💡 Implementation Tips

### 1. Start with Template Generation
```typescript
// Easiest to implement and test first
const template = generateServiceTemplate('xlsx', true);
// Download and verify in Excel
```

### 2. Test Parsing with Real Data
```typescript
// Use Square export as test data
const services = await parseServiceExcel(buffer, 'xlsx');
console.log(services); // Verify structure
```

### 3. Implement Dry Run First
```typescript
// Easier to debug validation without database changes
if (dryRun) {
  // Just validate, return results
  return validationReport;
}
```

### 4. Use Transactions for Safety
```typescript
// Always wrap imports in transactions
await client.query('BEGIN');
try {
  // Import logic
  await client.query('COMMIT');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
}
```

### 5. Log Everything
```typescript
// Helps with debugging in production
logger.info('Processing row', { row: i, data });
```

---

## 🔗 Dependencies

### NPM Packages Required
```json
{
  "dependencies": {
    "xlsx": "^0.18.5",
    "csv-parser": "^3.0.0",
    "multer": "^1.4.5-lts.1",
    "express-rate-limit": "^6.0.0"
  },
  "devDependencies": {
    "@types/multer": "^1.4.7",
    "@types/xlsx": "^0.0.36"
  }
}
```

### Install Command
```bash
cd backend
npm install xlsx csv-parser multer express-rate-limit
npm install --save-dev @types/multer @types/xlsx
```

---

## 📞 Questions for Backend Developer

1. **Database Connection Pool**: Current pool size sufficient for bulk operations?
2. **Job Queue**: Should we use a job queue (Bull, BullMQ) for background processing?
3. **File Storage**: Keep files in memory or save to disk temporarily?
4. **Webhook Notifications**: Should we notify shops when import completes (for large files)?
5. **Cleanup Job**: Use cron job to delete expired import_jobs or manual cleanup?
6. **Error Reporting**: Email detailed error report to shop owner?
7. **API Versioning**: Version these endpoints (/v1/services/import)?

---

## 📊 Estimated Timeline

| Task | Time | Days |
|------|------|------|
| Setup & Dependencies | 2-3 hours | 0.5 |
| Utilities (Parser/Generator) | 4-6 hours | 1 |
| Service Layer | 4-6 hours | 1 |
| Controller & Routes | 3-4 hours | 0.5 |
| Testing | 3-5 hours | 1 |
| Documentation | 1-2 hours | 0.5 |
| **Total** | **17-26 hours** | **3-4 days** |

**Recommended Approach:** 1 developer, 4-5 days with testing

---

## 🎯 Definition of Done

### Backend is considered complete when:
- [ ] All 4 API endpoints working
- [ ] File upload/download working
- [ ] Validation returning detailed errors
- [ ] Import modes (add/merge/replace) working
- [ ] Database migration applied
- [ ] Unit tests passing (>80% coverage)
- [ ] Integration tests passing
- [ ] Frontend integration successful
- [ ] Rate limiting working
- [ ] Logging implemented
- [ ] API documentation updated
- [ ] Code reviewed and merged

---

**Document Status**: Ready for Backend Development
**Last Updated**: April 27, 2026
**Maintained By**: Zeff
**Next Review**: After backend implementation begins
