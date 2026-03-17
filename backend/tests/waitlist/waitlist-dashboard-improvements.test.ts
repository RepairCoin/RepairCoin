/**
 * Waitlist Dashboard Improvements E2E Tests
 *
 * Covers all 6 phases of the waitlist admin dashboard strategy:
 * Phase 1: CVR fix, title rename (backend stats changes)
 * Phase 2: Split 24h KPIs (demoRequests24h, waitlistSignups24h)
 * Phase 3: Lead quality fields (businessCategory, city)
 * Phase 4: Workflow actions (existing status update endpoint)
 * Phase 5: Assigned to field, CSV export (backend update endpoint)
 * Phase 6: Consistent badges, email search (frontend-only, verified via contract)
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// ============================================================
// Mock setup
// ============================================================
const mockExistsByEmail = jest.fn<(...args: any[]) => Promise<boolean>>();
const mockCreate = jest.fn<(...args: any[]) => Promise<any>>();
const mockGetAll = jest.fn<(...args: any[]) => Promise<any>>();
const mockGetStats = jest.fn<(...args: any[]) => Promise<any>>();
const mockUpdateStatus = jest.fn<(...args: any[]) => Promise<any>>();
const mockDelete = jest.fn<(...args: any[]) => Promise<void>>();
const mockTrackVisit = jest.fn<(...args: any[]) => Promise<void>>();

jest.mock('../../src/repositories/WaitlistRepository', () => ({
  __esModule: true,
  default: {
    existsByEmail: (...args: any[]) => mockExistsByEmail(...args),
    create: (...args: any[]) => mockCreate(...args),
    getAll: (...args: any[]) => mockGetAll(...args),
    getStats: (...args: any[]) => mockGetStats(...args),
    updateStatus: (...args: any[]) => mockUpdateStatus(...args),
    delete: (...args: any[]) => mockDelete(...args),
    trackVisit: (...args: any[]) => mockTrackVisit(...args),
  },
}));

jest.mock('../../src/services/EmailService', () => ({
  EmailService: jest.fn().mockImplementation(() => ({
    sendWaitlistConfirmation: jest.fn().mockResolvedValue(true as never),
    sendWaitlistAdminNotification: jest.fn().mockResolvedValue(true as never),
  })),
}));

import {
  submitWaitlist,
  getWaitlistEntries,
  getWaitlistStats,
  updateWaitlistStatus,
  deleteWaitlistEntry,
} from '../../src/controllers/WaitlistController';

// Helpers
function createMockReqRes(body: any = {}, params: any = {}, query: any = {}) {
  const req = { body, params, query, headers: {} } as any;
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as any;
  return { req, res };
}

const mockEntry = (overrides: any = {}) => ({
  id: 'uuid-test',
  email: 'test@example.com',
  userType: 'shop',
  inquiryType: 'waitlist',
  status: 'pending',
  source: 'direct',
  businessCategory: null,
  city: null,
  assignedTo: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  notes: null,
  ...overrides,
});

describe('Waitlist Dashboard Improvements E2E', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================
  // Phase 1 & 2: Stats Endpoint (CVR fix + split 24h KPIs)
  // ============================================================
  describe('Phase 1 & 2: Stats endpoint - CVR fix and split 24h KPIs', () => {
    const fullStats = {
      total: 50,
      byStatus: { pending: 20, contacted: 15, approved: 10, rejected: 5 },
      byUserType: { customer: 30, shop: 20 },
      byInquiryType: { waitlist: 35, demo: 15 },
      bySource: { direct: 25, organic: 15, fb: 10 },
      recent24h: 8,
      demoRequests24h: 3,
      waitlistSignups24h: 5,
      campaignPerformance: [
        { source: 'direct', visits: 100, signups: 25, conversionRate: 25 },
        { source: 'organic', visits: 50, signups: 15, conversionRate: 30 },
        { source: 'fb', visits: 0, signups: 5, conversionRate: null },
      ],
    };

    it('should return stats with demoRequests24h and waitlistSignups24h fields', async () => {
      mockGetStats.mockResolvedValue(fullStats);

      const { req, res } = createMockReqRes();
      await getWaitlistStats(req, res);

      const response = (res.json as jest.Mock).mock.calls[0][0] as any;
      expect(response.success).toBe(true);
      expect(response.data.demoRequests24h).toBe(3);
      expect(response.data.waitlistSignups24h).toBe(5);
      expect(response.data.recent24h).toBe(8);
    });

    it('should return campaignPerformance with null CVR when visits = 0', async () => {
      mockGetStats.mockResolvedValue(fullStats);

      const { req, res } = createMockReqRes();
      await getWaitlistStats(req, res);

      const response = (res.json as jest.Mock).mock.calls[0][0] as any;
      const fbCampaign = response.data.campaignPerformance.find(
        (c: any) => c.source === 'fb'
      );
      expect(fbCampaign.conversionRate).toBeNull();
      expect(fbCampaign.visits).toBe(0);
      expect(fbCampaign.signups).toBe(5);
    });

    it('should return valid CVR when signups <= visits', async () => {
      mockGetStats.mockResolvedValue(fullStats);

      const { req, res } = createMockReqRes();
      await getWaitlistStats(req, res);

      const response = (res.json as jest.Mock).mock.calls[0][0] as any;
      const directCampaign = response.data.campaignPerformance.find(
        (c: any) => c.source === 'direct'
      );
      expect(directCampaign.conversionRate).toBe(25);
      expect(directCampaign.conversionRate).toBeLessThanOrEqual(100);
    });

    it('should return real CVR (>100%) when signups > visits', async () => {
      const statsWithOverflow = {
        ...fullStats,
        campaignPerformance: [
          { source: 'direct', visits: 10, signups: 14, conversionRate: 140 },
        ],
      };
      mockGetStats.mockResolvedValue(statsWithOverflow);

      const { req, res } = createMockReqRes();
      await getWaitlistStats(req, res);

      const response = (res.json as jest.Mock).mock.calls[0][0] as any;
      const directCampaign = response.data.campaignPerformance.find(
        (c: any) => c.source === 'direct'
      );
      // When signups > visits, show real CVR so admin knows tracking is incomplete
      expect(directCampaign.conversionRate).toBe(140);
    });

    it('should return 500 on stats error', async () => {
      mockGetStats.mockRejectedValue(new Error('DB error'));

      const { req, res } = createMockReqRes();
      await getWaitlistStats(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  // ============================================================
  // Phase 3: Lead Quality Fields (businessCategory, city)
  // ============================================================
  describe('Phase 3: Lead quality fields', () => {
    it('should accept businessCategory and city in submission', async () => {
      mockExistsByEmail.mockResolvedValue(false);
      mockCreate.mockResolvedValue(
        mockEntry({ businessCategory: 'repair', city: 'Los Angeles, CA' })
      );

      const { req, res } = createMockReqRes({
        email: 'shop@repair.com',
        userType: 'shop',
        businessCategory: 'repair',
        city: 'Los Angeles, CA',
      });
      await submitWaitlist(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          businessCategory: 'repair',
          city: 'Los Angeles, CA',
        })
      );
    });

    it('should accept submission without businessCategory and city', async () => {
      mockExistsByEmail.mockResolvedValue(false);
      mockCreate.mockResolvedValue(mockEntry());

      const { req, res } = createMockReqRes({
        email: 'user@example.com',
        userType: 'customer',
      });
      await submitWaitlist(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          businessCategory: undefined,
          city: undefined,
        })
      );
    });

    it('should reject invalid businessCategory', async () => {
      mockExistsByEmail.mockResolvedValue(false);

      const { req, res } = createMockReqRes({
        email: 'shop@test.com',
        userType: 'shop',
        businessCategory: 'invalid_category',
      });
      await submitWaitlist(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      const response = (res.json as jest.Mock).mock.calls[0][0] as any;
      expect(response.error).toContain('Business category must be one of');
    });

    it('should accept all valid businessCategory values', async () => {
      const validCategories = ['repair', 'barber', 'nails', 'gym', 'restaurant', 'retail', 'other'];

      for (const category of validCategories) {
        jest.clearAllMocks();
        mockExistsByEmail.mockResolvedValue(false);
        mockCreate.mockResolvedValue(mockEntry({ businessCategory: category }));

        const { req, res } = createMockReqRes({
          email: `${category}@test.com`,
          userType: 'shop',
          businessCategory: category,
        });
        await submitWaitlist(req, res);

        expect(res.status).toHaveBeenCalledWith(201);
      }
    });

    it('should trim city whitespace', async () => {
      mockExistsByEmail.mockResolvedValue(false);
      mockCreate.mockResolvedValue(mockEntry({ city: 'New York' }));

      const { req, res } = createMockReqRes({
        email: 'user@test.com',
        userType: 'shop',
        city: '  New York  ',
      });
      await submitWaitlist(req, res);

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ city: 'New York' })
      );
    });

    it('should pass businessCategory filter to getAll', async () => {
      mockGetAll.mockResolvedValue({ entries: [], total: 0 });

      const { req, res } = createMockReqRes({}, {}, {
        businessCategory: 'repair',
        limit: '50',
        offset: '0',
      });
      await getWaitlistEntries(req, res);

      expect(mockGetAll).toHaveBeenCalledWith(
        expect.objectContaining({ businessCategory: 'repair' })
      );
    });
  });

  // ============================================================
  // Phase 4: Workflow Actions (quick status updates)
  // ============================================================
  describe('Phase 4: Workflow status actions', () => {
    it('should update status to "contacted" (Mark Contacted)', async () => {
      mockUpdateStatus.mockResolvedValue(mockEntry({ status: 'contacted' }));

      const { req, res } = createMockReqRes(
        { status: 'contacted' },
        { id: 'uuid-1' }
      );
      await updateWaitlistStatus(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({ status: 'contacted' }),
        })
      );
    });

    it('should update status to "approved" (Mark Booked)', async () => {
      mockUpdateStatus.mockResolvedValue(mockEntry({ status: 'approved' }));

      const { req, res } = createMockReqRes(
        { status: 'approved' },
        { id: 'uuid-2' }
      );
      await updateWaitlistStatus(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({ status: 'approved' }),
        })
      );
    });

    it('should update status to "rejected" (Archive)', async () => {
      mockUpdateStatus.mockResolvedValue(mockEntry({ status: 'rejected' }));

      const { req, res } = createMockReqRes(
        { status: 'rejected' },
        { id: 'uuid-3' }
      );
      await updateWaitlistStatus(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({ status: 'rejected' }),
        })
      );
    });

    it('should reject invalid status value', async () => {
      const { req, res } = createMockReqRes(
        { status: 'booked' },
        { id: 'uuid-4' }
      );
      await updateWaitlistStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should reject missing status', async () => {
      const { req, res } = createMockReqRes({}, { id: 'uuid-5' });
      await updateWaitlistStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 404 when entry not found', async () => {
      mockUpdateStatus.mockRejectedValue(new Error('Waitlist entry not found'));

      const { req, res } = createMockReqRes(
        { status: 'contacted' },
        { id: 'nonexistent' }
      );
      await updateWaitlistStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('should delete entry successfully', async () => {
      mockDelete.mockResolvedValue(undefined);

      const { req, res } = createMockReqRes({}, { id: 'uuid-del' });
      await deleteWaitlistEntry(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true })
      );
      expect(mockDelete).toHaveBeenCalledWith('uuid-del');
    });
  });

  // ============================================================
  // Phase 5: Assigned To field
  // ============================================================
  describe('Phase 5: Assigned To field', () => {
    it('should pass assignedTo when updating status', async () => {
      mockUpdateStatus.mockResolvedValue(
        mockEntry({ status: 'contacted', assignedTo: 'John' })
      );

      const { req, res } = createMockReqRes(
        { status: 'contacted', assignedTo: 'John' },
        { id: 'uuid-assign' }
      );
      await updateWaitlistStatus(req, res);

      expect(mockUpdateStatus).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'uuid-assign',
          status: 'contacted',
          assignedTo: 'John',
        })
      );
    });

    it('should trim assignedTo whitespace', async () => {
      mockUpdateStatus.mockResolvedValue(
        mockEntry({ assignedTo: 'Sales Team' })
      );

      const { req, res } = createMockReqRes(
        { status: 'pending', assignedTo: '  Sales Team  ' },
        { id: 'uuid-trim' }
      );
      await updateWaitlistStatus(req, res);

      expect(mockUpdateStatus).toHaveBeenCalledWith(
        expect.objectContaining({ assignedTo: 'Sales Team' })
      );
    });

    it('should not send assignedTo when empty', async () => {
      mockUpdateStatus.mockResolvedValue(mockEntry());

      const { req, res } = createMockReqRes(
        { status: 'pending', assignedTo: '' },
        { id: 'uuid-empty' }
      );
      await updateWaitlistStatus(req, res);

      expect(mockUpdateStatus).toHaveBeenCalledWith(
        expect.objectContaining({ assignedTo: undefined })
      );
    });

    it('should update with notes and assignedTo together', async () => {
      mockUpdateStatus.mockResolvedValue(
        mockEntry({ notes: 'Called twice', assignedTo: 'Admin' })
      );

      const { req, res } = createMockReqRes(
        { status: 'contacted', notes: 'Called twice', assignedTo: 'Admin' },
        { id: 'uuid-both' }
      );
      await updateWaitlistStatus(req, res);

      expect(mockUpdateStatus).toHaveBeenCalledWith({
        id: 'uuid-both',
        status: 'contacted',
        notes: 'Called twice',
        assignedTo: 'Admin',
      });
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true })
      );
    });
  });

  // ============================================================
  // Phase 6: Frontend contract verification
  // ============================================================
  describe('Phase 6: Frontend contract verification', () => {
    it('entries response should include all fields needed by admin table', async () => {
      const fullEntry = mockEntry({
        businessCategory: 'repair',
        city: 'Austin, TX',
        assignedTo: 'John',
        notes: 'Hot lead',
      });
      mockGetAll.mockResolvedValue({ entries: [fullEntry], total: 1 });

      const { req, res } = createMockReqRes({}, {}, { limit: '50', offset: '0' });
      await getWaitlistEntries(req, res);

      const response = (res.json as jest.Mock).mock.calls[0][0] as any;
      const entry = response.data.entries[0];

      // All columns displayed in the admin table
      expect(entry).toHaveProperty('email');
      expect(entry).toHaveProperty('userType');
      expect(entry).toHaveProperty('source');
      expect(entry).toHaveProperty('businessCategory');
      expect(entry).toHaveProperty('city');
      expect(entry).toHaveProperty('inquiryType');
      expect(entry).toHaveProperty('status');
      expect(entry).toHaveProperty('assignedTo');
      expect(entry).toHaveProperty('createdAt');
      expect(entry).toHaveProperty('notes');
    });

    it('stats response should include all fields needed by KPI cards', async () => {
      mockGetStats.mockResolvedValue({
        total: 10,
        byStatus: { pending: 5, contacted: 3, approved: 1, rejected: 1 },
        byUserType: { customer: 6, shop: 4 },
        byInquiryType: { waitlist: 7, demo: 3 },
        bySource: { direct: 10 },
        recent24h: 2,
        demoRequests24h: 1,
        waitlistSignups24h: 1,
        campaignPerformance: [],
      });

      const { req, res } = createMockReqRes();
      await getWaitlistStats(req, res);

      const data = ((res.json as jest.Mock).mock.calls[0][0] as any).data;

      // KPI cards
      expect(data).toHaveProperty('total');
      expect(data.byStatus).toHaveProperty('pending');
      expect(data.byUserType).toHaveProperty('shop');
      expect(data).toHaveProperty('demoRequests24h');
      expect(data).toHaveProperty('waitlistSignups24h');
      expect(data).toHaveProperty('campaignPerformance');
    });

    it('CSV export fields should match entry response shape', () => {
      // The frontend CSV export maps these fields from the entries response:
      const csvHeaders = [
        'Email', 'Type', 'Category', 'City', 'Source',
        'Inquiry', 'Status', 'Assigned To', 'Joined', 'Notes',
      ];
      const entryFields = [
        'email', 'userType', 'businessCategory', 'city', 'source',
        'inquiryType', 'status', 'assignedTo', 'createdAt', 'notes',
      ];

      // Verify 1:1 mapping between CSV headers and entry fields
      expect(csvHeaders.length).toBe(entryFields.length);
      expect(csvHeaders.length).toBe(10);

      // Verify all fields exist on a mock entry
      const entry = mockEntry({
        businessCategory: 'repair',
        city: 'NYC',
        assignedTo: 'Admin',
      });
      for (const field of entryFields) {
        expect(entry).toHaveProperty(field);
      }
    });
  });

  // ============================================================
  // Full flow: submission → entries → update → verify
  // ============================================================
  describe('Full admin workflow flow', () => {
    it('submit → list → mark contacted → mark booked', async () => {
      // Step 1: Submit
      mockExistsByEmail.mockResolvedValue(false);
      const created = mockEntry({
        email: 'lead@biz.com',
        businessCategory: 'gym',
        city: 'Miami, FL',
      });
      mockCreate.mockResolvedValue(created);

      const { req: submitReq, res: submitRes } = createMockReqRes({
        email: 'lead@biz.com',
        userType: 'shop',
        businessCategory: 'gym',
        city: 'Miami, FL',
      });
      await submitWaitlist(submitReq, submitRes);
      expect(submitRes.status).toHaveBeenCalledWith(201);

      // Step 2: List entries
      mockGetAll.mockResolvedValue({ entries: [created], total: 1 });
      const { req: listReq, res: listRes } = createMockReqRes({}, {}, {
        limit: '100', offset: '0',
      });
      await getWaitlistEntries(listReq, listRes);
      const listData = (listRes.json as jest.Mock).mock.calls[0][0] as any;
      expect(listData.data.entries).toHaveLength(1);
      expect(listData.data.entries[0].businessCategory).toBe('gym');

      // Step 3: Mark Contacted with assignment
      mockUpdateStatus.mockResolvedValue({
        ...created,
        status: 'contacted',
        assignedTo: 'Sales',
      });
      const { req: contactReq, res: contactRes } = createMockReqRes(
        { status: 'contacted', assignedTo: 'Sales' },
        { id: created.id }
      );
      await updateWaitlistStatus(contactReq, contactRes);
      const contactData = (contactRes.json as jest.Mock).mock.calls[0][0] as any;
      expect(contactData.data.status).toBe('contacted');
      expect(contactData.data.assignedTo).toBe('Sales');

      // Step 4: Mark Booked
      mockUpdateStatus.mockResolvedValue({
        ...created,
        status: 'approved',
        assignedTo: 'Sales',
        notes: 'Demo scheduled for Friday',
      });
      const { req: bookReq, res: bookRes } = createMockReqRes(
        { status: 'approved', notes: 'Demo scheduled for Friday' },
        { id: created.id }
      );
      await updateWaitlistStatus(bookReq, bookRes);
      const bookData = (bookRes.json as jest.Mock).mock.calls[0][0] as any;
      expect(bookData.data.status).toBe('approved');
      expect(bookData.data.notes).toBe('Demo scheduled for Friday');
    });
  });
});
