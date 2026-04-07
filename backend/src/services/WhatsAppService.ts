import axios from 'axios';

/**
 * WhatsApp Business API Integration Service
 *
 * This service integrates with WhatsApp Business API to send notifications
 * like booking confirmations, appointment reminders, and order updates.
 *
 * SETUP REQUIRED:
 * 1. Sign up for WhatsApp Business API at https://business.whatsapp.com/
 * 2. Get API credentials (Phone Number ID and Access Token)
 * 3. Set environment variables:
 *    - WHATSAPP_PHONE_NUMBER_ID
 *    - WHATSAPP_ACCESS_TOKEN
 *    - WHATSAPP_API_VERSION (default: v18.0)
 *
 * Alternative providers:
 * - Twilio WhatsApp API: https://www.twilio.com/whatsapp
 * - MessageBird: https://www.messagebird.com/whatsapp-business-api
 * - 360Dialog: https://www.360dialog.com/
 */

interface WhatsAppConfig {
  phoneNumberId: string;
  accessToken: string;
  apiVersion: string;
}

interface WhatsAppMessage {
  to: string; // Recipient phone number (E.164 format: +1234567890)
  type: 'text' | 'template';
  text?: {
    body: string;
  };
  template?: {
    name: string;
    language: {
      code: string;
    };
    components?: Array<{
      type: string;
      parameters: Array<{
        type: string;
        text: string;
      }>;
    }>;
  };
}

interface BookingConfirmationParams {
  customerPhone: string;
  customerName: string;
  shopName: string;
  serviceName: string;
  bookingDate: string;
  bookingTime: string;
  totalAmount: number;
  bookingId: string;
}

class WhatsAppService {
  private config: WhatsAppConfig | null = null;
  private baseUrl: string = 'https://graph.facebook.com';

  constructor() {
    this.initializeConfig();
  }

  private initializeConfig() {
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
    const apiVersion = process.env.WHATSAPP_API_VERSION || 'v18.0';

    if (!phoneNumberId || !accessToken) {
      console.warn('[WhatsAppService] WhatsApp API credentials not configured. WhatsApp notifications will be disabled.');
      return;
    }

    this.config = {
      phoneNumberId,
      accessToken,
      apiVersion,
    };

    console.log('[WhatsAppService] WhatsApp API initialized successfully');
  }

  /**
   * Check if WhatsApp service is enabled
   */
  public isEnabled(): boolean {
    return this.config !== null;
  }

  /**
   * Send a WhatsApp message
   */
  private async sendMessage(message: WhatsAppMessage): Promise<boolean> {
    if (!this.config) {
      console.log('[WhatsAppService] WhatsApp not configured. Skipping message.');
      return false;
    }

    try {
      const url = `${this.baseUrl}/${this.config.apiVersion}/${this.config.phoneNumberId}/messages`;

      const response = await axios.post(
        url,
        {
          messaging_product: 'whatsapp',
          ...message,
        },
        {
          headers: {
            'Authorization': `Bearer ${this.config.accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      console.log('[WhatsAppService] Message sent successfully:', response.data);
      return true;
    } catch (error: any) {
      console.error('[WhatsAppService] Failed to send WhatsApp message:', error.response?.data || error.message);
      return false;
    }
  }

  /**
   * Format phone number to E.164 format (+1234567890)
   */
  private formatPhoneNumber(phone: string): string {
    // Remove all non-digit characters
    let cleaned = phone.replace(/\D/g, '');

    // If doesn't start with country code, assume US/Canada (+1)
    if (!cleaned.startsWith('1') && cleaned.length === 10) {
      cleaned = '1' + cleaned;
    }

    return '+' + cleaned;
  }

  /**
   * Send booking confirmation message
   */
  public async sendBookingConfirmation(params: BookingConfirmationParams): Promise<boolean> {
    if (!this.isEnabled()) {
      return false;
    }

    const {
      customerPhone,
      customerName,
      shopName,
      serviceName,
      bookingDate,
      bookingTime,
      totalAmount,
      bookingId,
    } = params;

    const formattedPhone = this.formatPhoneNumber(customerPhone);

    const message: WhatsAppMessage = {
      to: formattedPhone,
      type: 'text',
      text: {
        body: `🎉 *Booking Confirmed!*\n\nHi ${customerName},\n\nYour booking has been confirmed:\n\n📍 *Shop:* ${shopName}\n🔧 *Service:* ${serviceName}\n📅 *Date:* ${bookingDate}\n⏰ *Time:* ${bookingTime}\n💰 *Total:* $${totalAmount.toFixed(2)}\n\n📝 *Booking ID:* ${bookingId}\n\nWe look forward to seeing you!\n\n_Powered by RepairCoin_`,
      },
    };

    return await this.sendMessage(message);
  }

  /**
   * Send appointment reminder (24 hours before)
   */
  public async sendAppointmentReminder(params: BookingConfirmationParams): Promise<boolean> {
    if (!this.isEnabled()) {
      return false;
    }

    const {
      customerPhone,
      customerName,
      shopName,
      serviceName,
      bookingDate,
      bookingTime,
    } = params;

    const formattedPhone = this.formatPhoneNumber(customerPhone);

    const message: WhatsAppMessage = {
      to: formattedPhone,
      type: 'text',
      text: {
        body: `⏰ *Appointment Reminder*\n\nHi ${customerName},\n\nThis is a friendly reminder about your upcoming appointment:\n\n📍 *Shop:* ${shopName}\n🔧 *Service:* ${serviceName}\n📅 *Date:* ${bookingDate}\n⏰ *Time:* ${bookingTime}\n\n💡 *Tip:* Please arrive 5-10 minutes early.\n\nSee you soon!\n\n_Powered by RepairCoin_`,
      },
    };

    return await this.sendMessage(message);
  }

  /**
   * Send order completion notification
   */
  public async sendOrderCompleted(params: {
    customerPhone: string;
    customerName: string;
    shopName: string;
    serviceName: string;
    rcnEarned: number;
  }): Promise<boolean> {
    if (!this.isEnabled()) {
      return false;
    }

    const { customerPhone, customerName, shopName, serviceName, rcnEarned } = params;
    const formattedPhone = this.formatPhoneNumber(customerPhone);

    const message: WhatsAppMessage = {
      to: formattedPhone,
      type: 'text',
      text: {
        body: `✅ *Service Completed!*\n\nHi ${customerName},\n\nThank you for using our service!\n\n📍 *Shop:* ${shopName}\n🔧 *Service:* ${serviceName}\n\n🪙 *You earned:* ${rcnEarned} RCN tokens!\n\nWe'd love to hear your feedback. Please rate your experience on RepairCoin.\n\n_Powered by RepairCoin_`,
      },
    };

    return await this.sendMessage(message);
  }

  /**
   * Send cancellation notification
   */
  public async sendCancellationNotification(params: {
    customerPhone: string;
    customerName: string;
    shopName: string;
    serviceName: string;
    refundAmount: number;
  }): Promise<boolean> {
    if (!this.isEnabled()) {
      return false;
    }

    const { customerPhone, customerName, shopName, serviceName, refundAmount } = params;
    const formattedPhone = this.formatPhoneNumber(customerPhone);

    const message: WhatsAppMessage = {
      to: formattedPhone,
      type: 'text',
      text: {
        body: `❌ *Booking Cancelled*\n\nHi ${customerName},\n\nYour booking has been cancelled:\n\n📍 *Shop:* ${shopName}\n🔧 *Service:* ${serviceName}\n\n💰 *Refund:* $${refundAmount.toFixed(2)}\n\nYour refund will be processed within 5-10 business days.\n\nWe hope to see you again soon!\n\n_Powered by RepairCoin_`,
      },
    };

    return await this.sendMessage(message);
  }
}

export default new WhatsAppService();
