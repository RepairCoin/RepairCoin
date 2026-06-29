import { Router, Request, Response } from 'express';
import { shopTeamRepository, shopRepository } from '../../../repositories';
import { logger } from '../../../utils/logger';
import { ROLE_TEMPLATES, sanitizePermissions } from '../../shop/permissions';

// Mounted at /api/admin/shops/:shopId/team; mergeParams exposes :shopId.
const router = Router({ mergeParams: true });

const sanitizeMember = (m: any) => ({
  id: m.id,
  shopId: m.shopId,
  email: m.email,
  name: m.name,
  walletAddress: m.walletAddress,
  role: m.role,
  permissions: m.permissions,
  status: m.status,
  invitedAt: m.invitedAt,
  acceptedAt: m.acceptedAt,
});

router.get('/', async (req: Request, res: Response) => {
  try {
    const { shopId } = req.params;
    const shop = await shopRepository.getShop(shopId);
    if (!shop) {
      return res.status(404).json({ success: false, error: 'Shop not found' });
    }
    const members = await shopTeamRepository.getMembersByShop(shopId);
    res.json({ success: true, data: members.map(sanitizeMember) });
  } catch (error) {
    logger.error('Admin: error listing shop team members:', error);
    res.status(500).json({ success: false, error: 'Failed to list team members' });
  }
});

router.put('/:memberId', async (req: Request, res: Response) => {
  try {
    const { shopId, memberId } = req.params;
    const { role, permissions, name } = req.body;

    const member = await shopTeamRepository.getMemberById(memberId);
    if (!member || member.shopId !== shopId) {
      return res.status(404).json({ success: false, error: 'Team member not found' });
    }

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
        return res.status(400).json({ success: false, error: 'Cannot promote a member to owner' });
      }
      if (role === 'custom') {
        updates.role = 'custom';
        updates.permissions = sanitizePermissions(permissions || []);
        if (updates.permissions.length === 0) {
          return res.status(400).json({ success: false, error: 'Custom role requires at least one permission' });
        }
      } else if (ROLE_TEMPLATES[role]) {
        updates.role = role;
        updates.permissions = ROLE_TEMPLATES[role];
      } else {
        return res.status(400).json({ success: false, error: `Invalid role: ${role}` });
      }
    } else if (permissions !== undefined) {
      updates.permissions = sanitizePermissions(permissions);
    }

    const updated = await shopTeamRepository.updateMember(memberId, updates);
    res.json({ success: true, data: sanitizeMember(updated) });
  } catch (error) {
    logger.error('Admin: error updating shop team member:', error);
    res.status(500).json({ success: false, error: 'Failed to update team member' });
  }
});

router.post('/:memberId/suspend', async (req: Request, res: Response) => {
  try {
    const { shopId, memberId } = req.params;
    const member = await shopTeamRepository.getMemberById(memberId);
    if (!member || member.shopId !== shopId) {
      return res.status(404).json({ success: false, error: 'Team member not found' });
    }
    if (member.role === 'owner') {
      const owners = await shopTeamRepository.countActiveOwners(shopId);
      if (owners <= 1) {
        return res.status(400).json({ success: false, error: 'Cannot suspend the last owner' });
      }
    }
    const updated = await shopTeamRepository.updateMember(memberId, { status: 'suspended' });
    res.json({ success: true, data: sanitizeMember(updated) });
  } catch (error) {
    logger.error('Admin: error suspending shop team member:', error);
    res.status(500).json({ success: false, error: 'Failed to suspend team member' });
  }
});

router.post('/:memberId/reactivate', async (req: Request, res: Response) => {
  try {
    const { shopId, memberId } = req.params;
    const member = await shopTeamRepository.getMemberById(memberId);
    if (!member || member.shopId !== shopId) {
      return res.status(404).json({ success: false, error: 'Team member not found' });
    }
    if (member.status !== 'suspended') {
      return res.status(400).json({ success: false, error: 'Only suspended members can be reactivated' });
    }
    const updated = await shopTeamRepository.updateMember(memberId, { status: 'active' });
    res.json({ success: true, data: sanitizeMember(updated) });
  } catch (error) {
    logger.error('Admin: error reactivating shop team member:', error);
    res.status(500).json({ success: false, error: 'Failed to reactivate team member' });
  }
});

router.delete('/:memberId', async (req: Request, res: Response) => {
  try {
    const { shopId, memberId } = req.params;
    const member = await shopTeamRepository.getMemberById(memberId);
    if (!member || member.shopId !== shopId) {
      return res.status(404).json({ success: false, error: 'Team member not found' });
    }
    if (member.role === 'owner') {
      const owners = await shopTeamRepository.countActiveOwners(shopId);
      if (owners <= 1) {
        return res.status(400).json({ success: false, error: 'Cannot remove the last owner' });
      }
    }
    await shopTeamRepository.removeMember(memberId);
    res.json({ success: true, message: 'Team member removed' });
  } catch (error) {
    logger.error('Admin: error removing shop team member:', error);
    res.status(500).json({ success: false, error: 'Failed to remove team member' });
  }
});

export default router;
