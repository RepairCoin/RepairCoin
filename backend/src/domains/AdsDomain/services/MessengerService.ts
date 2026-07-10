// backend/src/domains/AdsDomain/services/MessengerService.ts
//
// Facebook Messenger transport (Send API) for the ads lead loop. Sends an AI/human message to a lead's
// Page-Scoped ID (PSID) via the connected shop Page's token. The inbound half arrives on the existing
// Meta page webhook (MetaWebhookController). Gated by ADS_MESSENGER_ENABLED; real (non-app-role) users
// need `pages_messaging` App Review — until then this works for app-role test users.
// See docs/tasks/strategy/ads-system/ads-messenger-scope.md.

import axios from 'axios';
import { logger } from '../../../utils/logger';

const GRAPH_VERSION = (process.env.META_GRAPH_VERSION || 'v19.0').trim();
const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`;

export class MessengerService {
  /** Gated: the Messenger channel is off by default (needs pages_messaging App Review to go wide). */
  enabled(): boolean {
    return process.env.ADS_MESSENGER_ENABLED === 'true';
  }

  /** Send a text message to a PSID via the shop Page. Returns 'sent' | 'failed'. `messaging_type:
   *  RESPONSE` = a reply within the 24h window (the normal AI-answer case). */
  async send(pageId: string, pageToken: string, recipientPsid: string, text: string): Promise<'sent' | 'failed'> {
    try {
      await axios.post(
        `${GRAPH}/${pageId}/messages`,
        { recipient: { id: recipientPsid }, messaging_type: 'RESPONSE', message: { text } },
        { params: { access_token: pageToken }, timeout: 15000 }
      );
      return 'sent';
    } catch (err: any) {
      const g = err?.response?.data?.error;
      logger.error('MessengerService.send failed', { pageId, recipient: recipientPsid, error: g?.message || err?.message, code: g?.code });
      return 'failed';
    }
  }
}

export const messengerService = new MessengerService();
