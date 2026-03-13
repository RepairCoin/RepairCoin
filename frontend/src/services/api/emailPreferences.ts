// frontend/src/services/api/emailPreferences.ts
import apiClient from './client';

export interface EmailPreferences {
  shopId: string;

  // Booking & Appointment Notifications
  newBooking: boolean;
  bookingCancellation: boolean;
  bookingReschedule: boolean;
  appointmentReminder: boolean;
  noShowAlert: boolean;

  // Customer Activity
  newCustomer: boolean;
  customerReview: boolean;
  customerMessage: boolean;

  // Financial Notifications
  paymentReceived: boolean;
  refundProcessed: boolean;
  subscriptionRenewal: boolean;
  subscriptionExpiring: boolean;

  // Marketing & Promotions
  marketingUpdates: boolean;
  featureAnnouncements: boolean;
  platformNews: boolean;

  // Digest Settings
  dailyDigest: boolean;
  weeklyReport: boolean;
  monthlyReport: boolean;

  // Frequency Settings
  digestTime: 'morning' | 'afternoon' | 'evening';
  weeklyReportDay: 'monday' | 'friday';
  monthlyReportDay: number; // 1-28

  createdAt?: string;
  updatedAt?: string;
}

/**
 * Get shop's email notification preferences
 */
export const getShopEmailPreferences = async (shopId: string): Promise<EmailPreferences> => {
  console.log('🌐 [API Client] Calling GET /services/shops/' + shopId + '/email-preferences');
  const response = await apiClient.get(`/services/shops/${shopId}/email-preferences`);
  console.log('🌐 [API Client] Raw response:', response);
  console.log('🌐 [API Client] response.data:', response.data);
  // Backend returns { success: true, data: {...} } but axios already unwraps to response.data
  // So response.data is already the preferences object, not response.data.data
  return response.data.data || response.data;
};

/**
 * Update shop's email notification preferences
 */
export const updateShopEmailPreferences = async (
  shopId: string,
  preferences: Partial<EmailPreferences>
): Promise<EmailPreferences> => {
  const response = await apiClient.put(`/services/shops/${shopId}/email-preferences`, preferences);
  return response.data.data || response.data;
};
