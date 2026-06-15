// backend/src/domains/AdsDomain/controllers/CreativeController.ts
//
// Creative CRUD + Q8 review (approve/reject before launch). Admin-only.

import { Request, Response } from 'express';
import { logger } from '../../../utils/logger';
import { CreativeRepository } from '../repositories/CreativeRepository';

const creatives = new CreativeRepository();
const adminId = (req: Request) => (req as any).user?.address ?? 'admin';

// POST /campaigns/:id/creatives (admin)
export async function createCreative(req: Request, res: Response): Promise<void> {
  const { creativeType } = req.body || {};
  if (!creativeType) {
    res.status(400).json({ success: false, error: 'creativeType is required' });
    return;
  }
  try {
    const creative = await creatives.create({
      campaignId: req.params.id,
      creativeType,
      language: req.body.language,
      landingUrl: req.body.landingUrl ?? null,
      landingUrlType: req.body.landingUrlType ?? null,
      headline: req.body.headline ?? null,
      body: req.body.body ?? null,
    });
    res.status(201).json({ success: true, data: creative });
  } catch (err) {
    logger.error('CreativeController.createCreative failed', err);
    res.status(500).json({ success: false, error: 'Failed to create creative' });
  }
}

// GET /campaigns/:id/creatives (admin)
export async function listCreatives(req: Request, res: Response): Promise<void> {
  try {
    const items = await creatives.listByCampaign(req.params.id);
    res.json({ success: true, data: items });
  } catch (err) {
    logger.error('CreativeController.listCreatives failed', err);
    res.status(500).json({ success: false, error: 'Failed to list creatives' });
  }
}

// PATCH /creatives/:id (admin) — edit; bumps version + resets review to pending
export async function updateCreative(req: Request, res: Response): Promise<void> {
  try {
    const creative = await creatives.update(req.params.id, req.body || {});
    if (!creative) { res.status(404).json({ success: false, error: 'Creative not found' }); return; }
    res.json({ success: true, data: creative });
  } catch (err) {
    logger.error('CreativeController.updateCreative failed', err);
    res.status(500).json({ success: false, error: 'Failed to update creative' });
  }
}

// DELETE /creatives/:id (admin) — soft delete
export async function deleteCreative(req: Request, res: Response): Promise<void> {
  try {
    const ok = await creatives.softDelete(req.params.id);
    if (!ok) { res.status(404).json({ success: false, error: 'Creative not found' }); return; }
    res.json({ success: true });
  } catch (err) {
    logger.error('CreativeController.deleteCreative failed', err);
    res.status(500).json({ success: false, error: 'Failed to delete creative' });
  }
}

// PATCH /creatives/:id/review (admin) — Q8: approve/reject before launch
export async function reviewCreative(req: Request, res: Response): Promise<void> {
  const status = req.body?.status;
  if (status !== 'approved' && status !== 'rejected') {
    res.status(400).json({ success: false, error: "status must be 'approved' or 'rejected'" });
    return;
  }
  try {
    const creative = await creatives.review(req.params.id, status, adminId(req));
    if (!creative) { res.status(404).json({ success: false, error: 'Creative not found' }); return; }
    res.json({ success: true, data: creative });
  } catch (err) {
    logger.error('CreativeController.reviewCreative failed', err);
    res.status(500).json({ success: false, error: 'Failed to review creative' });
  }
}
