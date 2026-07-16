// backend/src/services/WhatsAppNumberService.ts
import { logger } from '../utils/logger';

/**
 * Resolves an inbound WhatsApp business `phone_number_id` to the owning shop — the WhatsApp analog of
 * SmsNumberService's To→shop routing (the WhatsApp "D2" seam).
 *
 * Today the platform has ONE global WhatsApp Business number (WhatsAppService's config), so this is an
 * env single-shop mapping: WHATSAPP_PHONE_NUMBER_ID → WHATSAPP_DEFAULT_SHOP_ID. When per-shop WhatsApp
 * senders are provisioned (the gated build), this method becomes a `shop_whatsapp_numbers` lookup and
 * everything downstream stays the same. Returns null when the number isn't mapped (→ inbound skipped,
 * never mis-attributed).
 */
export class WhatsAppNumberService {
  async findShopIdByPhoneNumberId(phoneNumberId: string): Promise<string | null> {
    const platformPnid = (process.env.WHATSAPP_PHONE_NUMBER_ID || '').trim();
    const defaultShop = (process.env.WHATSAPP_DEFAULT_SHOP_ID || '').trim();
    if (phoneNumberId && platformPnid && phoneNumberId === platformPnid && defaultShop) {
      return defaultShop;
    }
    if (phoneNumberId) {
      logger.info('WhatsAppNumberService: inbound phone_number_id not mapped to a shop', { phoneNumberId });
    }
    return null;
  }
}

export const whatsAppNumberService = new WhatsAppNumberService();
