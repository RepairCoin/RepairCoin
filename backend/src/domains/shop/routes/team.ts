import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { authMiddleware, requireRole } from '../../../middleware/auth';
import { requireShopPermission } from '../../../middleware/permissions';
import { requireTier } from '../../../middleware/tierGuard';
import { shopTeamRepository, shopRepository } from '../../../repositories';
import { getSharedPool } from '../../../utils/database-pool';
import { resendEmailService } from '../../../services/ResendEmailService';
import { EmailService } from '../../../services/EmailService';
import { logger } from '../../../utils/logger';
import { ROLE_TEMPLATES, sanitizePermissions } from '../permissions';

const router = Router();
const emailService = new EmailService();

const hashToken = (raw: string) => crypto.createHash('sha256').update(raw).digest('hex');

const buildAcceptUrl = (rawToken: string) =>
  `${process.env.FRONTEND_URL || 'https://repaircoin.ai'}/team/accept?token=${rawToken}`;

const inviteEmailHtml = (role: string, shopName: string | undefined, acceptUrl: string) => `
  <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto;">
    <h2>You're invited to ${shopName || 'a FixFlow shop'}</h2>
    <p>You've been invited to join the team on FixFlow as <strong>${role}</strong>.</p>
    <p>Click below to accept and sign in with this email</p>
    <p style="margin: 28px 0;">
      <a href="${acceptUrl}" style="background:#FFCC00;color:#1a1a1a;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">Accept invitation</a>
    </p>
    <p style="color:#666;font-size:13px;">This invitation expires in 7 days. If you weren't expecting it, you can ignore this email.</p>
  </div>`;

// Resend is primary; fall back to Gmail SMTP (EmailService) when it fails or is
// unconfigured. Returns the provider that succeeded, or an error if both failed.
const sendInviteEmail = async (
  params: { email: string; role: string; shopName?: string; acceptUrl: string }
): Promise<{ success: boolean; provider?: 'resend' | 'gmail'; error?: string }> => {
  const subject = `You've been invited to join ${params.shopName || 'a shop'} on RepairCoin`;
  const html = inviteEmailHtml(params.role, params.shopName, params.acceptUrl);

  const resend = await resendEmailService.sendEmail({ to: params.email, subject, html });
  if (resend.success) return { success: true, provider: 'resend' };

  if (emailService.isReady()) {
    const sent = await emailService.sendContactCampaignEmail(params.email, subject, html);
    if (sent) {
      logger.info('Team invite sent via Gmail SMTP fallback', { email: params.email });
      return { success: true, provider: 'gmail' };
    }
  }

  return { success: false, error: resend.error || 'No email provider available' };
};

const sanitizeMember = (m: any) => ({
  id: m.id,
  shopId: m.shopId,
  email: m.email,
  name: m.name,
  walletAddress: m.walletAddress,
  role: m.role,
  permissions: m.permissions,
  commissionPercent: m.commissionPercent,
  status: m.status,
  invitedAt: m.invitedAt,
  acceptedAt: m.acceptedAt,
});

const teamManage = [authMiddleware, requireRole(['shop']), requireShopPermission('team:manage'), requireTier('teamManagement')];

// GET /api/shops/team/me — current member's role + permissions
router.get('/me', authMiddleware, requireRole(['shop']), (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      shopId: req.user?.shopId,
      permissions: req.user?.permissions ?? ['*'],
      teamMemberId: req.user?.teamMemberId,
      isOwner: !req.user?.teamMemberId,
    },
  });
});

// GET /api/shops/team/assignable — minimal roster for the completion picker.
// Auth + shop role only (no team:manage): staff/managers who complete orders can't read
// the full roster but must be able to attribute a completion. Returns names only, plus
// whether commissions are on and which member is the caller (for the default selection).
router.get('/assignable', authMiddleware, requireRole(['shop']), async (req: Request, res: Response) => {
  try {
    const shopId = req.user!.shopId!;
    const pool = getSharedPool();
    const [members, shop] = await Promise.all([
      pool.query(
        `SELECT id, name, email, wallet_address FROM shop_team_members
         WHERE shop_id = $1 AND status = 'active'
         ORDER BY (role = 'owner') DESC, name ASC NULLS LAST`,
        [shopId]
      ),
      pool.query(`SELECT commissions_enabled FROM shops WHERE shop_id = $1`, [shopId]),
    ]);

    const addr = req.user!.address?.toLowerCase();
    let currentMemberId: string | null = req.user!.teamMemberId ?? null;
    if (!currentMemberId && addr) {
      const self = members.rows.find((m) => (m.wallet_address || '').toLowerCase() === addr);
      currentMemberId = self ? self.id : null;
    }

    res.json({
      success: true,
      data: {
        commissionsEnabled: shop.rows[0]?.commissions_enabled === true,
        currentMemberId,
        members: members.rows.map((m) => ({ id: m.id, name: m.name || m.email })),
      },
    });
  } catch (error) {
    logger.error('Error listing assignable members:', error);
    res.status(500).json({ success: false, error: 'Failed to load assignable members' });
  }
});

// GET /api/shops/team/my-commissions?from&to — the caller's OWN commission, for transparency.
// Auth + shop role only: a staff member can't read the shop-wide report (shop:manage) but must
// be able to see what they personally earned. Strictly self-scoped to the caller's member id.
router.get('/my-commissions', authMiddleware, requireRole(['shop']), async (req: Request, res: Response) => {
  try {
    const shopId = req.user!.shopId!;
    const pool = getSharedPool();

    // Resolve the caller's own member id: teamMemberId for non-owners, else the owner's row by wallet.
    let memberId: string | null = req.user!.teamMemberId ?? null;
    if (!memberId && req.user!.address) {
      const self = await shopTeamRepository.getActiveMemberByWallet(req.user!.address);
      if (self && self.shopId === shopId) memberId = self.id;
    }

    const { from, to } = req.query as { from?: string; to?: string };
    const shopRow = await pool.query(`SELECT commissions_enabled FROM shops WHERE shop_id = $1`, [shopId]);
    const commissionsEnabled = shopRow.rows[0]?.commissions_enabled === true;

    if (!memberId) {
      return res.json({
        success: true,
        data: { commissionsEnabled, summary: { accrued: 0, paid: 0, total: 0, count: 0 }, rows: [] },
      });
    }

    const result = await pool.query(
      `SELECT sc.id, sc.order_id, sc.base_amount, sc.rate_percent, sc.amount, sc.status, sc.created_at, sc.paid_at
         FROM staff_commissions sc
        WHERE sc.shop_id = $1 AND sc.member_id = $2
          AND ($3::date IS NULL OR sc.created_at >= $3::date)
          AND ($4::date IS NULL OR sc.created_at < ($4::date + INTERVAL '1 day'))
        ORDER BY sc.created_at DESC`,
      [shopId, memberId, from || null, to || null]
    );

    const rows = result.rows.map((r) => ({
      id: r.id,
      orderId: r.order_id,
      baseAmount: parseFloat(r.base_amount),
      ratePercent: parseFloat(r.rate_percent),
      amount: parseFloat(r.amount),
      status: r.status,
      createdAt: r.created_at,
      paidAt: r.paid_at,
    }));

    const round2 = (n: number) => Math.round(n * 100) / 100;
    const accrued = round2(rows.filter((r) => r.status === 'accrued').reduce((s, r) => s + r.amount, 0));
    const paid = round2(rows.filter((r) => r.status === 'paid').reduce((s, r) => s + r.amount, 0));

    res.json({
      success: true,
      data: {
        commissionsEnabled,
        summary: { accrued, paid, total: round2(accrued + paid), count: rows.length },
        rows,
      },
    });
  } catch (error) {
    logger.error('Error loading own commissions:', error);
    res.status(500).json({ success: false, error: 'Failed to load your commissions' });
  }
});

// GET /api/shops/team — list members
router.get('/', teamManage, async (req: Request, res: Response) => {
  try {
    const members = await shopTeamRepository.getMembersByShop(req.user!.shopId!);
    res.json({ success: true, data: members.map(sanitizeMember) });
  } catch (error) {
    logger.error('Error listing team members:', error);
    res.status(500).json({ success: false, error: 'Failed to list team members' });
  }
});

// POST /api/shops/team/invite — invite by email
router.post('/invite', teamManage, async (req: Request, res: Response) => {
  try {
    const shopId = req.user!.shopId!;
    const { email, name, role = 'staff', permissions } = req.body;

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return res.status(400).json({ success: false, error: 'A valid email is required' });
    }
    if (role === 'owner') {
      return res.status(400).json({ success: false, error: 'Cannot invite a member as owner' });
    }

    let resolvedPermissions: string[];
    if (role === 'custom') {
      resolvedPermissions = sanitizePermissions(permissions || []);
      if (resolvedPermissions.length === 0) {
        return res.status(400).json({ success: false, error: 'Custom role requires at least one permission' });
      }
    } else if (ROLE_TEMPLATES[role]) {
      resolvedPermissions = ROLE_TEMPLATES[role];
    } else {
      return res.status(400).json({ success: false, error: `Invalid role: ${role}` });
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const existing = await shopTeamRepository.getByShopAndEmail(shopId, email);
    if (existing && existing.status === 'active') {
      return res.status(409).json({ success: false, error: 'This email is already an active team member' });
    }

    let member;
    if (existing) {
      // Re-invite a previously invited/suspended/removed member
      member = await shopTeamRepository.updateMember(existing.id, {
        name: name ?? existing.name,
        role,
        permissions: resolvedPermissions,
        status: 'invited',
        walletAddress: null,
        acceptedAt: null,
        inviteToken: tokenHash,
        inviteExpiresAt: expiresAt,
      });
    } else {
      member = await shopTeamRepository.createMember({
        shopId,
        email,
        name: name ?? null,
        role,
        permissions: resolvedPermissions,
        status: 'invited',
        inviteToken: tokenHash,
        inviteExpiresAt: expiresAt,
        invitedBy: req.user!.address,
      });
    }

    const shop = await shopRepository.getShop(shopId);
    const acceptUrl = buildAcceptUrl(rawToken);
    const emailResult = await sendInviteEmail({ email, role, shopName: shop?.name, acceptUrl });

    if (!emailResult.success) {
      logger.warn('Team invite email failed to send', { shopId, email, error: emailResult.error });
    }

    // acceptUrl is returned so the owner can copy/share the link even if the email
    // failed — a bounced invite is never a dead end. The raw token is never stored
    // (only its hash) and is only ever surfaced here, right after generation.
    res.status(201).json({
      success: true,
      data: sanitizeMember(member),
      emailSent: emailResult.success,
      acceptUrl,
    });
  } catch (error) {
    logger.error('Error inviting team member:', error);
    res.status(500).json({ success: false, error: 'Failed to invite team member' });
  }
});

// PUT /api/shops/team/:memberId — change role/permissions/name
router.put('/:memberId', teamManage, async (req: Request, res: Response) => {
  try {
    const shopId = req.user!.shopId!;
    const { memberId } = req.params;
    const { role, permissions, name, commissionPercent } = req.body;

    const member = await shopTeamRepository.getMemberById(memberId);
    if (!member || member.shopId !== shopId) {
      return res.status(404).json({ success: false, error: 'Team member not found' });
    }

    // Guard: never strip the last owner of the shop
    if (member.role === 'owner' && role && role !== 'owner') {
      const owners = await shopTeamRepository.countActiveOwners(shopId);
      if (owners <= 1) {
        return res.status(400).json({ success: false, error: 'Cannot change the role of the last owner' });
      }
    }

    const updates: any = {};
    if (name !== undefined) updates.name = name;
    if (role !== undefined) {
      if (role === 'owner') {
        return res.status(400).json({ success: false, error: 'Cannot promote to owner via this endpoint' });
      }
      updates.role = role;
      updates.permissions = role === 'custom' ? sanitizePermissions(permissions || []) : ROLE_TEMPLATES[role];
      if (!updates.permissions) {
        return res.status(400).json({ success: false, error: `Invalid role: ${role}` });
      }
    } else if (permissions !== undefined) {
      updates.permissions = sanitizePermissions(permissions);
    }

    if (commissionPercent !== undefined) {
      if (commissionPercent === null) {
        updates.commissionPercent = null;
      } else {
        const n = Number(commissionPercent);
        if (!Number.isFinite(n) || n < 0 || n > 100) {
          return res.status(400).json({ success: false, error: 'commissionPercent must be between 0 and 100, or null to inherit' });
        }
        updates.commissionPercent = n;
      }
    }

    const updated = await shopTeamRepository.updateMember(memberId, updates);
    res.json({ success: true, data: sanitizeMember(updated) });
  } catch (error) {
    logger.error('Error updating team member:', error);
    res.status(500).json({ success: false, error: 'Failed to update team member' });
  }
});

// POST /api/shops/team/:memberId/suspend
router.post('/:memberId/suspend', teamManage, async (req: Request, res: Response) => {
  try {
    const shopId = req.user!.shopId!;
    const member = await shopTeamRepository.getMemberById(req.params.memberId);
    if (!member || member.shopId !== shopId) {
      return res.status(404).json({ success: false, error: 'Team member not found' });
    }
    if (member.role === 'owner') {
      const owners = await shopTeamRepository.countActiveOwners(shopId);
      if (owners <= 1) {
        return res.status(400).json({ success: false, error: 'Cannot suspend the last owner' });
      }
    }
    const updated = await shopTeamRepository.updateMember(member.id, { status: 'suspended' });
    res.json({ success: true, data: sanitizeMember(updated) });
  } catch (error) {
    logger.error('Error suspending team member:', error);
    res.status(500).json({ success: false, error: 'Failed to suspend team member' });
  }
});

// DELETE /api/shops/team/:memberId — remove (soft)
router.delete('/:memberId', teamManage, async (req: Request, res: Response) => {
  try {
    const shopId = req.user!.shopId!;
    const member = await shopTeamRepository.getMemberById(req.params.memberId);
    if (!member || member.shopId !== shopId) {
      return res.status(404).json({ success: false, error: 'Team member not found' });
    }
    if (member.role === 'owner') {
      const owners = await shopTeamRepository.countActiveOwners(shopId);
      if (owners <= 1) {
        return res.status(400).json({ success: false, error: 'Cannot remove the last owner' });
      }
    }
    await shopTeamRepository.removeMember(member.id);
    res.json({ success: true, message: 'Team member removed' });
  } catch (error) {
    logger.error('Error removing team member:', error);
    res.status(500).json({ success: false, error: 'Failed to remove team member' });
  }
});

// POST /api/shops/team/:memberId/resend — regenerate token + re-send the invite email
router.post('/:memberId/resend', teamManage, async (req: Request, res: Response) => {
  try {
    const shopId = req.user!.shopId!;
    const member = await shopTeamRepository.getMemberById(req.params.memberId);
    if (!member || member.shopId !== shopId) {
      return res.status(404).json({ success: false, error: 'Team member not found' });
    }
    if (member.status !== 'invited') {
      return res.status(400).json({ success: false, error: 'Only pending invitations can be resent' });
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const updated = await shopTeamRepository.updateMember(member.id, {
      inviteToken: hashToken(rawToken),
      inviteExpiresAt: expiresAt,
    });

    const shop = await shopRepository.getShop(shopId);
    const acceptUrl = buildAcceptUrl(rawToken);
    const emailResult = await sendInviteEmail({ email: member.email, role: member.role, shopName: shop?.name, acceptUrl });

    if (!emailResult.success) {
      logger.warn('Team invite resend email failed', { shopId, email: member.email, error: emailResult.error });
    }

    res.json({ success: true, data: sanitizeMember(updated), emailSent: emailResult.success, acceptUrl });
  } catch (error) {
    logger.error('Error resending team invite:', error);
    res.status(500).json({ success: false, error: 'Failed to resend invitation' });
  }
});

// POST /api/shops/team/accept — public, token-based
router.post('/accept', async (req: Request, res: Response) => {
  try {
    const { token, walletAddress } = req.body;
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ success: false, error: 'Invite token is required' });
    }
    if (!walletAddress || !/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      return res.status(400).json({ success: false, error: 'A valid wallet address is required' });
    }

    const member = await shopTeamRepository.getByInviteTokenHash(hashToken(token));
    if (!member) {
      return res.status(400).json({ success: false, error: 'Invalid or expired invitation' });
    }

    try {
      const updated = await shopTeamRepository.updateMember(member.id, {
        walletAddress,
        status: 'active',
        acceptedAt: new Date().toISOString(),
        inviteToken: null,
      });
      res.json({
        success: true,
        data: { shopId: updated!.shopId, role: updated!.role, email: updated!.email },
      });
    } catch (err: any) {
      // Unique (shop_id, wallet_address) violation — wallet already used in this shop
      if (err?.code === '23505') {
        return res.status(409).json({ success: false, error: 'This wallet is already linked to a member of this shop' });
      }
      throw err;
    }
  } catch (error) {
    logger.error('Error accepting team invite:', error);
    res.status(500).json({ success: false, error: 'Failed to accept invitation' });
  }
});

export default router;
