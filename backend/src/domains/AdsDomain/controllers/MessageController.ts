// backend/src/domains/AdsDomain/controllers/MessageController.ts
//
// Durable shop↔admin ads message thread (lifecycle Phase 2). Shop reads/posts its own
// thread (shopId from JWT); admin reads/posts any shop's thread. Posting notifies the
// other party (best-effort).

import { Request, Response } from 'express';
import { logger } from '../../../utils/logger';
import { AdMessageRepository } from '../repositories/AdMessageRepository';
import { NotificationRepository } from '../../../repositories/NotificationRepository';
import { shopRepository } from '../../../repositories';

const messages = new AdMessageRepository();
const notifications = new NotificationRepository();

const shopIdOf = (req: Request): string | undefined => (req as any).user?.shopId;

async function notifyAdmins(message: string, metadata: any): Promise<void> {
  try {
    const addrs = (process.env.ADMIN_ADDRESSES || '').split(',').map((a) => a.trim().toLowerCase()).filter(Boolean);
    for (const receiver of addrs) {
      await notifications.create({ senderAddress: 'system', receiverAddress: receiver, notificationType: 'ad_message', message, metadata });
    }
  } catch (err) { logger.error('MessageController.notifyAdmins failed', err); }
}

async function notifyShop(shopId: string, message: string, metadata: any): Promise<void> {
  try {
    const shop = await shopRepository.getShop(shopId);
    const receiver = (shop as any)?.walletAddress || (shop as any)?.wallet_address;
    if (receiver) await notifications.create({ senderAddress: 'system', receiverAddress: receiver, notificationType: 'ad_message', message, metadata });
  } catch (err) { logger.error('MessageController.notifyShop failed', err); }
}

const validBody = (b: any): string | null => {
  const body = (b?.body ?? '').toString().trim();
  return body.length ? body : null;
};

// ---- Shop ----
export async function getMyMessages(req: Request, res: Response): Promise<void> {
  const shopId = shopIdOf(req);
  if (!shopId) { res.status(401).json({ success: false, error: 'Shop ID required' }); return; }
  try {
    res.json({ success: true, data: await messages.listByShop(shopId) });
  } catch (err) {
    logger.error('MessageController.getMyMessages failed', err);
    res.status(500).json({ success: false, error: 'Failed to load messages' });
  }
}

export async function postMyMessage(req: Request, res: Response): Promise<void> {
  const shopId = shopIdOf(req);
  if (!shopId) { res.status(401).json({ success: false, error: 'Shop ID required' }); return; }
  const body = validBody(req.body);
  if (!body) { res.status(400).json({ success: false, error: 'body is required' }); return; }
  try {
    const msg = await messages.append(shopId, 'shop', body);
    await notifyAdmins(`Shop ${shopId} sent an ads message.`, { shopId });
    res.status(201).json({ success: true, data: msg });
  } catch (err) {
    logger.error('MessageController.postMyMessage failed', err);
    res.status(500).json({ success: false, error: 'Failed to send message' });
  }
}

// ---- Admin ----
// Inbox: every shop with messages, newest first, flagged when the shop is awaiting a reply.
// Reachable in every lifecycle state (pre-subscribe, pre-campaign, live) — the single
// source of truth for shop↔admin ads comms.
export async function getMessageInbox(_req: Request, res: Response): Promise<void> {
  try {
    res.json({ success: true, data: await messages.inboxSummary() });
  } catch (err) {
    logger.error('MessageController.getMessageInbox failed', err);
    res.status(500).json({ success: false, error: 'Failed to load inbox' });
  }
}

export async function listShopMessages(req: Request, res: Response): Promise<void> {
  try {
    res.json({ success: true, data: await messages.listByShop(req.params.shopId) });
  } catch (err) {
    logger.error('MessageController.listShopMessages failed', err);
    res.status(500).json({ success: false, error: 'Failed to load messages' });
  }
}

export async function postAdminMessage(req: Request, res: Response): Promise<void> {
  const shopId = req.params.shopId;
  const body = validBody(req.body);
  if (!body) { res.status(400).json({ success: false, error: 'body is required' }); return; }
  try {
    const msg = await messages.append(shopId, 'admin', body);
    await notifyShop(shopId, 'New message from the FixFlow ads team.', { shopId });
    res.status(201).json({ success: true, data: msg });
  } catch (err) {
    logger.error('MessageController.postAdminMessage failed', err);
    res.status(500).json({ success: false, error: 'Failed to send message' });
  }
}
