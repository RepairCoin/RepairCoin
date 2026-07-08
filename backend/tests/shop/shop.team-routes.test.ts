import request from 'supertest';
import { describe, it, expect, beforeAll, beforeEach, afterAll, jest } from '@jest/globals';
import RepairCoinApp from '../../src/app';
import { ShopRepository } from '../../src/repositories/ShopRepository';
import { ShopTeamRepository } from '../../src/repositories/ShopTeamRepository';
import { resendEmailService } from '../../src/services/ResendEmailService';
import jwt from 'jsonwebtoken';

// Mock repositories + side-effecting services. Auto-mocking the repository modules
// makes the singletons in repositories/index.ts share the mocked prototypes, which
// we drive with jest.spyOn — the same pattern as shop.operations.test.ts.
jest.mock('../../src/repositories/ShopRepository');
jest.mock('../../src/repositories/ShopTeamRepository');
jest.mock('../../src/repositories/CustomerRepository');
jest.mock('../../src/repositories/TransactionRepository');
jest.mock('../../src/repositories/AdminRepository');
jest.mock('../../src/repositories/TreasuryRepository');
jest.mock('../../src/services/ResendEmailService');
jest.mock('../../src/services/EmailService');
jest.mock('thirdweb');

// Team management is a Business-tier feature: every mutating team route sits behind
// requireTier('teamManagement'), which resolves the shop's tier by querying live
// subscription tables (not the mocked repositories). Stub the tier resolver so the
// test shop is treated as Business tier — these tests exercise team-management logic,
// not tier gating.
jest.mock('../../src/utils/shopTier', () => ({
  ...(jest.requireActual('../../src/utils/shopTier') as object),
  getShopTier: async () => 'business',
}));

describe('Shop Team Management routes', () => {
  let app: any;
  let ownerToken: string;
  let staffToken: string;

  const shopId = 'test-shop';
  const ownerWallet = '0x1111111111111111111111111111111111111111';
  const staffWallet = '0x2222222222222222222222222222222222222222';
  const newWallet = '0x3333333333333333333333333333333333333333';

  const mockShop = { shopId, name: 'Test Shop', walletAddress: ownerWallet, email: 'owner@test.com' };

  const staffMember = {
    id: 'member-staff',
    shopId,
    walletAddress: staffWallet,
    email: 'staff@test.com',
    name: 'Staff Person',
    role: 'staff',
    permissions: ['bookings:view', 'customers:view'],
    status: 'active',
    invitedAt: '2026-06-26T00:00:00.000Z',
    acceptedAt: '2026-06-26T00:00:00.000Z',
  };

  const ownerMember = { ...staffMember, id: 'member-owner', role: 'owner', permissions: ['*'], email: 'owner@test.com' };

  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-secret-key-32-chars-long!!';
    process.env.NODE_ENV = 'test';
    process.env.FRONTEND_URL = 'https://app.test';

    const repairCoinApp = new RepairCoinApp();
    await repairCoinApp.initialize();
    app = repairCoinApp.app;

    ownerToken = jwt.sign({ address: ownerWallet, role: 'shop', shopId }, process.env.JWT_SECRET);
    staffToken = jwt.sign(
      {
        address: staffWallet,
        role: 'shop',
        shopId,
        permissions: ['bookings:view', 'customers:view'],
        teamMemberId: 'member-staff',
      },
      process.env.JWT_SECRET
    );
  });

  afterAll(async () => {
    await new Promise((resolve) => setTimeout(resolve, 100));
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Auth: every shop token resolves its shop.
    jest.spyOn(ShopRepository.prototype, 'getShop').mockResolvedValue(mockShop as any);
    // Email: Resend succeeds by default.
    jest.spyOn(resendEmailService, 'sendEmail').mockResolvedValue({ success: true } as any);
  });

  describe('GET /api/shops/team/me', () => {
    it('reports an owner (no teamMemberId) with wildcard permissions', async () => {
      const res = await request(app)
        .get('/api/shops/team/me')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ shopId, isOwner: true, permissions: ['*'] });
    });

    it('reports a team member with their scoped permissions', async () => {
      jest.spyOn(ShopTeamRepository.prototype, 'getMemberById').mockResolvedValue(staffMember as any);

      const res = await request(app)
        .get('/api/shops/team/me')
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({
        shopId,
        isOwner: false,
        teamMemberId: 'member-staff',
        permissions: ['bookings:view', 'customers:view'],
      });
    });
  });

  describe('GET /api/shops/team', () => {
    it('lists members for an owner', async () => {
      jest
        .spyOn(ShopTeamRepository.prototype, 'getMembersByShop')
        .mockResolvedValue([ownerMember, staffMember] as any);

      const res = await request(app).get('/api/shops/team').set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
      // sanitizeMember must not leak invite_token/expiry to the client
      expect(res.body.data[0]).not.toHaveProperty('inviteToken');
    });

    it('denies a staff member who lacks team:manage', async () => {
      jest.spyOn(ShopTeamRepository.prototype, 'getMemberById').mockResolvedValue(staffMember as any);

      const res = await request(app).get('/api/shops/team').set('Authorization', `Bearer ${staffToken}`);

      expect(res.status).toBe(403);
    });

    it('rejects an unauthenticated request', async () => {
      const res = await request(app).get('/api/shops/team');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/shops/team/invite', () => {
    it('rejects an invalid email', async () => {
      const res = await request(app)
        .post('/api/shops/team/invite')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ email: 'not-an-email', role: 'staff' });

      expect(res.status).toBe(400);
    });

    it('rejects inviting someone as owner', async () => {
      const res = await request(app)
        .post('/api/shops/team/invite')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ email: 'x@test.com', role: 'owner' });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/owner/i);
    });

    it('rejects a custom role with no permissions', async () => {
      const res = await request(app)
        .post('/api/shops/team/invite')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ email: 'x@test.com', role: 'custom', permissions: [] });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/permission/i);
    });

    it('creates a new member and returns an accept link + emailSent flag', async () => {
      jest.spyOn(ShopTeamRepository.prototype, 'getByShopAndEmail').mockResolvedValue(null as any);
      const created = { ...staffMember, id: 'member-new', email: 'new@test.com', status: 'invited', walletAddress: null };
      jest.spyOn(ShopTeamRepository.prototype, 'createMember').mockResolvedValue(created as any);

      const res = await request(app)
        .post('/api/shops/team/invite')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ email: 'new@test.com', name: 'New Hire', role: 'staff' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.emailSent).toBe(true);
      expect(res.body.acceptUrl).toContain('https://app.test/team/accept?token=');
      // The raw token is only ever surfaced here, never persisted
      expect(res.body.data).not.toHaveProperty('inviteToken');
    });

    it('still returns 201 with emailSent=false when the email provider fails', async () => {
      jest.spyOn(ShopTeamRepository.prototype, 'getByShopAndEmail').mockResolvedValue(null as any);
      jest.spyOn(ShopTeamRepository.prototype, 'createMember').mockResolvedValue(staffMember as any);
      jest.spyOn(resendEmailService, 'sendEmail').mockResolvedValue({ success: false, error: 'down' } as any);

      const res = await request(app)
        .post('/api/shops/team/invite')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ email: 'new@test.com', role: 'staff' });

      expect(res.status).toBe(201);
      expect(res.body.emailSent).toBe(false);
      expect(res.body.acceptUrl).toContain('/team/accept?token=');
    });

    it('rejects re-inviting an already-active member', async () => {
      jest
        .spyOn(ShopTeamRepository.prototype, 'getByShopAndEmail')
        .mockResolvedValue({ ...staffMember, status: 'active' } as any);

      const res = await request(app)
        .post('/api/shops/team/invite')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ email: 'staff@test.com', role: 'staff' });

      expect(res.status).toBe(409);
    });

    it('re-invites a previously removed member by reusing their row', async () => {
      const removed = { ...staffMember, status: 'removed' };
      jest.spyOn(ShopTeamRepository.prototype, 'getByShopAndEmail').mockResolvedValue(removed as any);
      const updateSpy = jest
        .spyOn(ShopTeamRepository.prototype, 'updateMember')
        .mockResolvedValue({ ...staffMember, status: 'invited' } as any);
      const createSpy = jest.spyOn(ShopTeamRepository.prototype, 'createMember');

      const res = await request(app)
        .post('/api/shops/team/invite')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ email: 'staff@test.com', role: 'staff' });

      expect(res.status).toBe(201);
      expect(updateSpy).toHaveBeenCalledWith('member-staff', expect.objectContaining({ status: 'invited' }));
      expect(createSpy).not.toHaveBeenCalled();
    });
  });

  describe('PUT /api/shops/team/:memberId', () => {
    it('returns 404 for a member belonging to another shop', async () => {
      jest
        .spyOn(ShopTeamRepository.prototype, 'getMemberById')
        .mockResolvedValue({ ...staffMember, shopId: 'other-shop' } as any);

      const res = await request(app)
        .put('/api/shops/team/member-staff')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ role: 'manager' });

      expect(res.status).toBe(404);
    });

    it('rejects promotion to owner', async () => {
      jest.spyOn(ShopTeamRepository.prototype, 'getMemberById').mockResolvedValue(staffMember as any);

      const res = await request(app)
        .put('/api/shops/team/member-staff')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ role: 'owner' });

      expect(res.status).toBe(400);
    });

    it('refuses to demote the last owner', async () => {
      jest.spyOn(ShopTeamRepository.prototype, 'getMemberById').mockResolvedValue(ownerMember as any);
      jest.spyOn(ShopTeamRepository.prototype, 'countActiveOwners').mockResolvedValue(1 as any);

      const res = await request(app)
        .put('/api/shops/team/member-owner')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ role: 'manager' });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/last owner/i);
    });

    it('updates a member role and applies the role template permissions', async () => {
      jest.spyOn(ShopTeamRepository.prototype, 'getMemberById').mockResolvedValue(staffMember as any);
      const updateSpy = jest
        .spyOn(ShopTeamRepository.prototype, 'updateMember')
        .mockResolvedValue({ ...staffMember, role: 'manager' } as any);

      const res = await request(app)
        .put('/api/shops/team/member-staff')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ role: 'manager' });

      expect(res.status).toBe(200);
      const updateArg = updateSpy.mock.calls[0][1] as any;
      expect(updateArg.role).toBe('manager');
      expect(updateArg.permissions).not.toContain('team:manage');
    });
  });

  describe('POST /api/shops/team/:memberId/suspend', () => {
    it('suspends an active staff member', async () => {
      jest.spyOn(ShopTeamRepository.prototype, 'getMemberById').mockResolvedValue(staffMember as any);
      const updateSpy = jest
        .spyOn(ShopTeamRepository.prototype, 'updateMember')
        .mockResolvedValue({ ...staffMember, status: 'suspended' } as any);

      const res = await request(app)
        .post('/api/shops/team/member-staff/suspend')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(updateSpy).toHaveBeenCalledWith('member-staff', { status: 'suspended' });
    });

    it('refuses to suspend the last owner', async () => {
      jest.spyOn(ShopTeamRepository.prototype, 'getMemberById').mockResolvedValue(ownerMember as any);
      jest.spyOn(ShopTeamRepository.prototype, 'countActiveOwners').mockResolvedValue(1 as any);

      const res = await request(app)
        .post('/api/shops/team/member-owner/suspend')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /api/shops/team/:memberId', () => {
    it('soft-removes a staff member', async () => {
      jest.spyOn(ShopTeamRepository.prototype, 'getMemberById').mockResolvedValue(staffMember as any);
      const removeSpy = jest.spyOn(ShopTeamRepository.prototype, 'removeMember').mockResolvedValue(undefined as any);

      const res = await request(app)
        .delete('/api/shops/team/member-staff')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(removeSpy).toHaveBeenCalledWith('member-staff');
    });

    it('refuses to remove the last owner', async () => {
      jest.spyOn(ShopTeamRepository.prototype, 'getMemberById').mockResolvedValue(ownerMember as any);
      jest.spyOn(ShopTeamRepository.prototype, 'countActiveOwners').mockResolvedValue(1 as any);

      const res = await request(app)
        .delete('/api/shops/team/member-owner')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/shops/team/:memberId/resend', () => {
    it('regenerates the token and resends for a pending invite', async () => {
      jest
        .spyOn(ShopTeamRepository.prototype, 'getMemberById')
        .mockResolvedValue({ ...staffMember, status: 'invited' } as any);
      jest
        .spyOn(ShopTeamRepository.prototype, 'updateMember')
        .mockResolvedValue({ ...staffMember, status: 'invited' } as any);

      const res = await request(app)
        .post('/api/shops/team/member-staff/resend')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.emailSent).toBe(true);
      expect(res.body.acceptUrl).toContain('/team/accept?token=');
    });

    it('rejects resending to an already-active member', async () => {
      jest.spyOn(ShopTeamRepository.prototype, 'getMemberById').mockResolvedValue(staffMember as any);

      const res = await request(app)
        .post('/api/shops/team/member-staff/resend')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/shops/team/accept (public)', () => {
    it('rejects a missing token', async () => {
      const res = await request(app).post('/api/shops/team/accept').send({ walletAddress: newWallet });
      expect(res.status).toBe(400);
    });

    it('rejects an invalid wallet address', async () => {
      const res = await request(app)
        .post('/api/shops/team/accept')
        .send({ token: 'a'.repeat(64), walletAddress: 'nope' });
      expect(res.status).toBe(400);
    });

    it('rejects an invalid or expired invite token', async () => {
      jest.spyOn(ShopTeamRepository.prototype, 'getByInviteTokenHash').mockResolvedValue(null as any);

      const res = await request(app)
        .post('/api/shops/team/accept')
        .send({ token: 'a'.repeat(64), walletAddress: newWallet });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/invalid or expired/i);
    });

    it('activates the member and links the wallet on success', async () => {
      const invited = { ...staffMember, status: 'invited', walletAddress: null };
      jest.spyOn(ShopTeamRepository.prototype, 'getByInviteTokenHash').mockResolvedValue(invited as any);
      const updateSpy = jest
        .spyOn(ShopTeamRepository.prototype, 'updateMember')
        .mockResolvedValue({ ...staffMember, walletAddress: newWallet, status: 'active' } as any);

      const res = await request(app)
        .post('/api/shops/team/accept')
        .send({ token: 'a'.repeat(64), walletAddress: newWallet });

      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ shopId, role: 'staff', email: 'staff@test.com' });
      const updateArg = updateSpy.mock.calls[0][1] as any;
      expect(updateArg).toMatchObject({ walletAddress: newWallet, status: 'active', inviteToken: null });
    });

    it('returns 409 when the wallet is already linked to the shop', async () => {
      const invited = { ...staffMember, status: 'invited', walletAddress: null };
      jest.spyOn(ShopTeamRepository.prototype, 'getByInviteTokenHash').mockResolvedValue(invited as any);
      jest
        .spyOn(ShopTeamRepository.prototype, 'updateMember')
        .mockRejectedValue({ code: '23505' } as any);

      const res = await request(app)
        .post('/api/shops/team/accept')
        .send({ token: 'a'.repeat(64), walletAddress: newWallet });

      expect(res.status).toBe(409);
    });
  });
});
