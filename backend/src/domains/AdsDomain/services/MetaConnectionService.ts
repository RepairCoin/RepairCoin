// backend/src/domains/AdsDomain/services/MetaConnectionService.ts
//
// Phase 3 of the Connect-Meta flow: keep tokens fresh and honor revocation.
//  - refreshExpiring(): nightly re-extend long-lived user tokens nearing expiry; on hard
//    failure, drop the §9.6 gate (campaigns can't stay live on a dead token) + notify + thread.
//  - handleDeauthorize() / handleDataDeletion(): Meta signed_request callbacks (carry only the
//    user id) → map to the shop → clear the connection.

import { logger } from '../../../utils/logger';
import { metaService } from './MetaService';
import { parseSignedRequest } from './MetaWebhookService';
import { encryptToken, decryptToken } from '../../../utils/tokenCrypto';
import { MetaConnectionRepository } from '../repositories/MetaConnectionRepository';
import { AdMessageRepository } from '../repositories/AdMessageRepository';
import { NotificationRepository } from '../../../repositories/NotificationRepository';
import { shopRepository } from '../../../repositories';

const REFRESH_WINDOW_DAYS = 7;

export class MetaConnectionService {
  constructor(
    private readonly connections = new MetaConnectionRepository(),
    private readonly messages = new AdMessageRepository(),
    private readonly notifications = new NotificationRepository()
  ) {}

  private event(shopId: string, body: string) {
    return this.messages.postEvent(shopId, body).catch((e) => logger.error('Meta connect event failed', e));
  }
  private async notifyShop(shopId: string, message: string) {
    try {
      const shop = await shopRepository.getShop(shopId);
      const receiver = (shop as any)?.walletAddress || (shop as any)?.wallet_address;
      if (receiver) await this.notifications.create({ senderAddress: 'system', receiverAddress: receiver, notificationType: 'ad_meta_connection', message, metadata: { shopId } });
    } catch (err) { logger.error('MetaConnectionService.notifyShop failed', err); }
  }

  /** Nightly: re-extend tokens expiring within the window. Returns the count refreshed. */
  async refreshExpiring(asOf = new Date()): Promise<number> {
    if (!metaService.isConfigured()) return 0;
    const before = new Date(asOf.getTime() + REFRESH_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const due = await this.connections.listExpiring(before).catch(() => []);
    let refreshed = 0;
    for (const { shopId, userTokenEnc } of due) {
      try {
        const current = decryptToken(userTokenEnc);
        const { token, expiresAt } = await metaService.refreshToken(current);
        await this.connections.updateUserToken(shopId, encryptToken(token), expiresAt);
        refreshed++;
      } catch (err) {
        // Token can't be refreshed → connection is dead. Drop the gate so a campaign can't
        // keep running on an invalid token; the shop must reconnect.
        logger.error(`MetaConnectionService: refresh failed for ${shopId} — disconnecting`, err);
        await this.connections.setConnected(shopId, false).catch(() => undefined);
        void this.event(shopId, 'Meta connection expired — reconnect your ad account to keep campaigns live.');
        await this.notifyShop(shopId, 'Your Meta ad-account connection expired. Reconnect it so your campaigns keep running.');
      }
    }
    return refreshed;
  }

  /** Meta "deauthorize" callback — the user removed the app. Clear the connection. */
  async handleDeauthorize(signedRequest: string | undefined): Promise<boolean> {
    const payload = parseSignedRequest(signedRequest, process.env.META_APP_SECRET);
    const userId = payload?.user_id ? String(payload.user_id) : null;
    if (!userId) return false;
    const shopId = await this.connections.findShopByMetaUserId(userId);
    if (!shopId) return false;
    await this.connections.clearConnection(shopId);
    void this.event(shopId, 'Meta access was revoked — ad account disconnected.');
    return true;
  }

  /** Meta "data deletion request" callback — clear stored Meta data for the user's shop. */
  async handleDataDeletion(signedRequest: string | undefined): Promise<{ ok: boolean; shopId: string | null }> {
    const payload = parseSignedRequest(signedRequest, process.env.META_APP_SECRET);
    const userId = payload?.user_id ? String(payload.user_id) : null;
    if (!userId) return { ok: false, shopId: null };
    const shopId = await this.connections.findShopByMetaUserId(userId);
    if (shopId) {
      await this.connections.clearConnection(shopId);
      void this.event(shopId, 'Meta data deletion processed — stored Meta tokens cleared.');
    }
    return { ok: true, shopId };
  }
}

export const metaConnectionService = new MetaConnectionService();
