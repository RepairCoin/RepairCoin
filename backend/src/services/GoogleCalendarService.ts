// backend/src/services/GoogleCalendarService.ts
import { google } from 'googleapis';
import CryptoJS from 'crypto-js';
import { CalendarRepository, CalendarConnection } from '../repositories/CalendarRepository';
import { logger } from '../utils/logger';

const ENCRYPTION_KEY = process.env.GOOGLE_CALENDAR_ENCRYPTION_KEY || '';
const CLIENT_ID = process.env.GOOGLE_CALENDAR_CLIENT_ID || '';
const CLIENT_SECRET = process.env.GOOGLE_CALENDAR_CLIENT_SECRET || '';
const REDIRECT_URI = process.env.GOOGLE_CALENDAR_REDIRECT_URI || '';

export interface CalendarEvent {
  orderId: string;
  serviceName: string;
  serviceDescription?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  customerAddress: string;
  bookingDate: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  totalAmount: number;
  shopTimezone?: string;
}

export class GoogleCalendarService {
  private calendarRepo: CalendarRepository;
  private oauth2Client: any;

  constructor() {
    this.calendarRepo = new CalendarRepository();
    this.oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
  }

  /**
   * Get OAuth authorization URL for a shop
   */
  async getAuthorizationUrl(shopId: string, state?: string): Promise<string> {
    try {
      console.log('[GoogleCalendarService] 🔄 getAuthorizationUrl called with shopId:', shopId);
      console.log('[GoogleCalendarService] 🔧 Environment variables check:', {
        hasClientId: !!CLIENT_ID,
        hasClientSecret: !!CLIENT_SECRET,
        hasRedirectUri: !!REDIRECT_URI,
        hasEncryptionKey: !!ENCRYPTION_KEY,
        clientIdLength: CLIENT_ID?.length,
        clientSecretLength: CLIENT_SECRET?.length,
        redirectUri: REDIRECT_URI,
      });

      console.log('[GoogleCalendarService] 🔑 OAuth2 client initialized:', {
        hasClient: !!this.oauth2Client,
        clientType: typeof this.oauth2Client,
      });

      // Generate authorization URL with required scopes
      const authUrlConfig = {
        access_type: 'offline', // Required for refresh token
        scope: [
          'https://www.googleapis.com/auth/calendar.events',
          'https://www.googleapis.com/auth/calendar.readonly',
          'https://www.googleapis.com/auth/userinfo.email',
        ],
        state: state || shopId, // Use state to track which shop is connecting
        prompt: 'consent', // Force consent screen to get refresh token
      };

      console.log('[GoogleCalendarService] 📋 Auth URL config:', authUrlConfig);
      console.log('[GoogleCalendarService] 📡 Calling oauth2Client.generateAuthUrl...');

      const authUrl = this.oauth2Client.generateAuthUrl(authUrlConfig);

      console.log('[GoogleCalendarService] ✅ Auth URL generated successfully:', authUrl);
      logger.info('Generated OAuth authorization URL', { shopId });
      return authUrl;
    } catch (error) {
      console.error('[GoogleCalendarService] ❌ Error generating authorization URL:', {
        error,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        errorStack: error instanceof Error ? error.stack : undefined,
        errorType: typeof error,
        shopId
      });
      logger.error('Error generating authorization URL:', error);
      throw new Error('Failed to generate authorization URL');
    }
  }

  /**
   * Handle OAuth callback and exchange code for tokens
   */
  async handleOAuthCallback(code: string, shopId: string): Promise<void> {
    try {
      // Exchange authorization code for tokens
      const { tokens } = await this.oauth2Client.getToken(code);

      if (!tokens.access_token || !tokens.refresh_token) {
        throw new Error('Missing tokens in OAuth response');
      }

      // Get user email
      this.oauth2Client.setCredentials(tokens);
      const oauth2 = google.oauth2({ version: 'v2', auth: this.oauth2Client });
      const userInfo = await oauth2.userinfo.get();

      // Calculate token expiry
      const tokenExpiry = new Date();
      tokenExpiry.setSeconds(tokenExpiry.getSeconds() + (tokens.expiry_date || 3600));

      // Encrypt tokens before storing
      const encryptedAccessToken = this.encryptToken(tokens.access_token);
      const encryptedRefreshToken = this.encryptToken(tokens.refresh_token);

      // Save connection to database
      await this.calendarRepo.saveConnection({
        shopId,
        provider: 'google',
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        tokenExpiry,
        calendarId: 'primary',
        googleAccountEmail: userInfo.data.email || undefined,
      });

      logger.info('Successfully saved Google Calendar connection', {
        shopId,
        email: userInfo.data.email,
      });
    } catch (error) {
      logger.error('Error handling OAuth callback:', error);
      throw new Error('Failed to complete Google Calendar connection');
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(shopId: string): Promise<void> {
    try {
      const connection = await this.calendarRepo.getActiveConnection(shopId, 'google');

      if (!connection) {
        throw new Error('No active calendar connection found');
      }

      // Decrypt refresh token
      const refreshToken = this.decryptToken(connection.refreshToken);

      // Set credentials and refresh
      this.oauth2Client.setCredentials({
        refresh_token: refreshToken,
      });

      const { credentials } = await this.oauth2Client.refreshAccessToken();

      if (!credentials.access_token) {
        throw new Error('Failed to refresh access token');
      }

      // Calculate new expiry
      const tokenExpiry = new Date();
      tokenExpiry.setSeconds(tokenExpiry.getSeconds() + (credentials.expiry_date || 3600));

      // Encrypt and save new access token
      const encryptedAccessToken = this.encryptToken(credentials.access_token);
      await this.calendarRepo.updateAccessToken(
        shopId,
        'google',
        encryptedAccessToken,
        tokenExpiry
      );

      await this.calendarRepo.updateLastSync(shopId, 'google', 'success');

      logger.info('Successfully refreshed access token', { shopId });
    } catch (error) {
      logger.error('Error refreshing access token:', error);
      await this.calendarRepo.updateLastSync(
        shopId,
        'google',
        'token_expired',
        'Failed to refresh token'
      );
      throw error;
    }
  }

  /**
   * Create a calendar event for an appointment
   */
  async createEvent(eventData: CalendarEvent): Promise<string> {
    try {
      const connection = await this.calendarRepo.getActiveConnection(
        eventData.customerAddress.split('-')[0], // Extract shop ID
        'google'
      );

      if (!connection) {
        logger.warn('No active calendar connection, skipping event creation', {
          orderId: eventData.orderId,
        });
        return '';
      }

      // Check if token needs refresh
      if (connection.tokenExpiry < new Date()) {
        await this.refreshAccessToken(connection.shopId);
        // Fetch updated connection
        const updatedConnection = await this.calendarRepo.getActiveConnection(
          connection.shopId,
          'google'
        );
        if (!updatedConnection) throw new Error('Connection lost after refresh');
        Object.assign(connection, updatedConnection);
      }

      // Decrypt access token
      const accessToken = this.decryptToken(connection.accessToken);
      this.oauth2Client.setCredentials({ access_token: accessToken });

      // Build calendar event
      const calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });
      const event = this.buildEventPayload(eventData, connection.shopId);

      // Create event
      const response = await calendar.events.insert({
        calendarId: connection.calendarId,
        requestBody: event,
      });

      if (!response.data.id) {
        throw new Error('No event ID returned from Google Calendar');
      }

      // Update order with calendar event ID
      await this.calendarRepo.updateOrderCalendarEvent({
        orderId: eventData.orderId,
        calendarEventId: response.data.id,
        syncStatus: 'synced',
      });

      await this.calendarRepo.updateLastSync(connection.shopId, 'google', 'success');

      logger.info('Successfully created calendar event', {
        orderId: eventData.orderId,
        eventId: response.data.id,
      });

      return response.data.id;
    } catch (error) {
      logger.error('Error creating calendar event:', error);

      // Update order with error
      await this.calendarRepo.updateOrderCalendarEvent({
        orderId: eventData.orderId,
        syncStatus: 'failed',
        syncError: error instanceof Error ? error.message : 'Unknown error',
      });

      throw error;
    }
  }

  /**
   * Update an existing calendar event
   */
  async updateEvent(orderId: string, eventData: Partial<CalendarEvent>): Promise<void> {
    try {
      // Get existing calendar event ID
      const eventId = await this.calendarRepo.getOrderCalendarEventId(orderId);

      if (!eventId) {
        logger.warn('No calendar event found for order, cannot update', { orderId });
        return;
      }

      const connection = await this.calendarRepo.getActiveConnection(
        eventData.customerAddress?.split('-')[0] || '',
        'google'
      );

      if (!connection) {
        logger.warn('No active calendar connection, skipping event update', { orderId });
        return;
      }

      // Check if token needs refresh
      if (connection.tokenExpiry < new Date()) {
        await this.refreshAccessToken(connection.shopId);
      }

      // Decrypt access token
      const accessToken = this.decryptToken(connection.accessToken);
      this.oauth2Client.setCredentials({ access_token: accessToken });

      const calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });

      // Get existing event
      const existingEvent = await calendar.events.get({
        calendarId: connection.calendarId,
        eventId,
      });

      // Update event with new data
      const updatedEvent = {
        ...existingEvent.data,
        summary: eventData.serviceName || existingEvent.data.summary,
        description: this.buildEventDescription(eventData as any) || existingEvent.data.description,
        start: eventData.bookingDate && eventData.startTime
          ? {
              dateTime: this.buildDateTime(eventData.bookingDate, eventData.startTime, eventData.shopTimezone),
              timeZone: eventData.shopTimezone || 'America/New_York',
            }
          : existingEvent.data.start,
        end: eventData.bookingDate && eventData.endTime
          ? {
              dateTime: this.buildDateTime(eventData.bookingDate, eventData.endTime, eventData.shopTimezone),
              timeZone: eventData.shopTimezone || 'America/New_York',
            }
          : existingEvent.data.end,
      };

      await calendar.events.update({
        calendarId: connection.calendarId,
        eventId,
        requestBody: updatedEvent,
      });

      await this.calendarRepo.updateOrderCalendarEvent({
        orderId,
        calendarEventId: eventId,
        syncStatus: 'synced',
      });

      await this.calendarRepo.updateLastSync(connection.shopId, 'google', 'success');

      logger.info('Successfully updated calendar event', { orderId, eventId });
    } catch (error) {
      logger.error('Error updating calendar event:', error);
      await this.calendarRepo.updateOrderCalendarEvent({
        orderId,
        syncStatus: 'failed',
        syncError: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Delete a calendar event
   */
  async deleteEvent(orderId: string, shopId: string): Promise<void> {
    try {
      const eventId = await this.calendarRepo.getOrderCalendarEventId(orderId);

      if (!eventId) {
        logger.warn('No calendar event found for order, cannot delete', { orderId });
        return;
      }

      const connection = await this.calendarRepo.getActiveConnection(shopId, 'google');

      if (!connection) {
        logger.warn('No active calendar connection, skipping event deletion', { orderId });
        return;
      }

      // Decrypt access token
      const accessToken = this.decryptToken(connection.accessToken);
      this.oauth2Client.setCredentials({ access_token: accessToken });

      const calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });

      await calendar.events.delete({
        calendarId: connection.calendarId,
        eventId,
      });

      await this.calendarRepo.updateOrderCalendarEvent({
        orderId,
        calendarEventId: eventId,
        syncStatus: 'deleted',
      });

      await this.calendarRepo.updateLastSync(connection.shopId, 'google', 'success');

      logger.info('Successfully deleted calendar event', { orderId, eventId });
    } catch (error) {
      logger.error('Error deleting calendar event:', error);
      throw error;
    }
  }

  /**
   * Disconnect calendar for a shop
   */
  async disconnectCalendar(shopId: string): Promise<void> {
    try {
      await this.calendarRepo.disconnectCalendar(shopId, 'google');
      logger.info('Successfully disconnected Google Calendar', { shopId });
    } catch (error) {
      logger.error('Error disconnecting calendar:', error);
      throw error;
    }
  }

  /**
   * Build calendar event payload
   */
  private buildEventPayload(eventData: CalendarEvent, shopId: string): any {
    const startDateTime = this.buildDateTime(
      eventData.bookingDate,
      eventData.startTime,
      eventData.shopTimezone
    );
    const endDateTime = this.buildDateTime(
      eventData.bookingDate,
      eventData.endTime,
      eventData.shopTimezone
    );

    return {
      summary: `${eventData.customerName || 'Customer'} - ${eventData.serviceName}`,
      description: this.buildEventDescription(eventData),
      start: {
        dateTime: startDateTime,
        timeZone: eventData.shopTimezone || 'America/New_York',
      },
      end: {
        dateTime: endDateTime,
        timeZone: eventData.shopTimezone || 'America/New_York',
      },
      attendees: eventData.customerEmail
        ? [{ email: eventData.customerEmail, displayName: eventData.customerName }]
        : [],
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 24 * 60 }, // 24 hours before
          { method: 'popup', minutes: 60 }, // 1 hour before
        ],
      },
      colorId: '9', // Blue color for appointments
    };
  }

  /**
   * Build event description
   */
  private buildEventDescription(eventData: CalendarEvent): string {
    const lines = [
      `📅 RepairCoin Appointment`,
      ``,
      `👤 Customer: ${eventData.customerName || 'N/A'}`,
      `📧 Email: ${eventData.customerEmail || 'N/A'}`,
      `📱 Phone: ${eventData.customerPhone || 'N/A'}`,
      `🔗 Wallet: ${eventData.customerAddress}`,
      ``,
      `🛠️ Service: ${eventData.serviceName}`,
    ];

    if (eventData.serviceDescription) {
      lines.push(`📝 Details: ${eventData.serviceDescription}`);
    }

    lines.push(
      ``,
      `💰 Total: $${eventData.totalAmount.toFixed(2)}`,
      ``,
      `🆔 Order ID: ${eventData.orderId}`,
      ``,
      `---`,
      `Managed via RepairCoin`
    );

    return lines.join('\n');
  }

  /**
   * Build ISO 8601 datetime string
   */
  private buildDateTime(date: string, time: string, timezone?: string): string {
    // date: YYYY-MM-DD, time: HH:MM
    const [hours, minutes] = time.split(':');
    return `${date}T${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}:00`;
  }

  /**
   * Encrypt token using AES-256-GCM
   */
  private encryptToken(token: string): string {
    if (!ENCRYPTION_KEY) {
      throw new Error('GOOGLE_CALENDAR_ENCRYPTION_KEY not configured');
    }
    return CryptoJS.AES.encrypt(token, ENCRYPTION_KEY).toString();
  }

  /**
   * Decrypt token using AES-256-GCM
   */
  private decryptToken(encryptedToken: string): string {
    if (!ENCRYPTION_KEY) {
      throw new Error('GOOGLE_CALENDAR_ENCRYPTION_KEY not configured');
    }
    const bytes = CryptoJS.AES.decrypt(encryptedToken, ENCRYPTION_KEY);
    return bytes.toString(CryptoJS.enc.Utf8);
  }
}
