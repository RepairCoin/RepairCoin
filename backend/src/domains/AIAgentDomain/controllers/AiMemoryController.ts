// backend/src/domains/AIAgentDomain/controllers/AiMemoryController.ts
//
// AI Memory settings (Phase 2) — shop-owner CRUD over their saved standing
// instructions. All shop-scoped via the JWT (shopId never from the URL/body), so
// a shop can only ever touch its own memories. Gated by ENABLE_AI_MEMORY: when
// off, GET returns enabled:false + an empty list and mutations 409.

import { Request, Response } from 'express';
import { logger } from '../../../utils/logger';
import { getAiMemoryService, isAiMemoryEnabled } from '../services/AiMemoryService';
import type { AiMemoryKind } from '../../../repositories/AiMemoryRepository';

const KINDS: AiMemoryKind[] = ['preference', 'instruction', 'decision', 'correction'];

function shopIdOf(req: Request): string | undefined {
  return (req as any).user?.shopId;
}

function parseTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((t): t is string => typeof t === 'string');
}

// GET /api/ai/memories — list the shop's saved memories (+ whether the feature is on).
export async function listMemories(req: Request, res: Response): Promise<void> {
  const shopId = shopIdOf(req);
  if (!shopId) { res.status(401).json({ success: false, error: 'Shop ID required' }); return; }
  try {
    const memories = await getAiMemoryService().list(shopId);
    res.json({ success: true, data: { enabled: isAiMemoryEnabled(), memories } });
  } catch (err) {
    logger.error('AiMemoryController.listMemories failed', err);
    res.status(500).json({ success: false, error: 'Failed to load memories' });
  }
}

// POST /api/ai/memories — owner adds a standing instruction (pre-seed). Pinned.
export async function createMemory(req: Request, res: Response): Promise<void> {
  const shopId = shopIdOf(req);
  if (!shopId) { res.status(401).json({ success: false, error: 'Shop ID required' }); return; }
  if (!isAiMemoryEnabled()) { res.status(409).json({ success: false, error: 'AI memory is not enabled' }); return; }

  const body = req.body as { kind?: unknown; content?: unknown; tags?: unknown };
  const kind: AiMemoryKind =
    typeof body.kind === 'string' && (KINDS as string[]).includes(body.kind)
      ? (body.kind as AiMemoryKind)
      : 'instruction';
  const content = typeof body.content === 'string' ? body.content.trim() : '';
  if (!content) { res.status(400).json({ success: false, error: '`content` is required' }); return; }

  try {
    const result = await getAiMemoryService().remember(shopId, {
      kind,
      content,
      tags: parseTags(body.tags),
      source: 'explicit',
    });
    if (!result.saved) {
      // looks_like_fact / duplicate / empty — a client problem, not a server error.
      res.status(400).json({ success: false, error: result.reason ?? 'not_saved' });
      return;
    }
    res.status(201).json({ success: true, data: result.memory });
  } catch (err) {
    logger.error('AiMemoryController.createMemory failed', err);
    res.status(500).json({ success: false, error: 'Failed to save memory' });
  }
}

// PATCH /api/ai/memories/:id — edit content / tags / pinned.
export async function updateMemory(req: Request, res: Response): Promise<void> {
  const shopId = shopIdOf(req);
  if (!shopId) { res.status(401).json({ success: false, error: 'Shop ID required' }); return; }
  if (!isAiMemoryEnabled()) { res.status(409).json({ success: false, error: 'AI memory is not enabled' }); return; }

  const body = req.body as { content?: unknown; tags?: unknown; pinned?: unknown };
  const fields: { content?: string; tags?: string[]; pinned?: boolean } = {};
  if (typeof body.content === 'string') fields.content = body.content;
  if (Array.isArray(body.tags)) fields.tags = parseTags(body.tags);
  if (typeof body.pinned === 'boolean') fields.pinned = body.pinned;

  try {
    const updated = await getAiMemoryService().update(shopId, req.params.id, fields);
    if (!updated) { res.status(404).json({ success: false, error: 'Memory not found' }); return; }
    res.json({ success: true, data: updated });
  } catch (err) {
    logger.error('AiMemoryController.updateMemory failed', err);
    res.status(500).json({ success: false, error: 'Failed to update memory' });
  }
}

// DELETE /api/ai/memories/:id — forget a memory (soft delete).
export async function removeMemory(req: Request, res: Response): Promise<void> {
  const shopId = shopIdOf(req);
  if (!shopId) { res.status(401).json({ success: false, error: 'Shop ID required' }); return; }
  if (!isAiMemoryEnabled()) { res.status(409).json({ success: false, error: 'AI memory is not enabled' }); return; }
  try {
    const deleted = await getAiMemoryService().forget(shopId, req.params.id);
    if (!deleted) { res.status(404).json({ success: false, error: 'Memory not found' }); return; }
    res.json({ success: true, data: { deleted: true } });
  } catch (err) {
    logger.error('AiMemoryController.removeMemory failed', err);
    res.status(500).json({ success: false, error: 'Failed to delete memory' });
  }
}
