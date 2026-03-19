// Push token registration params
export interface RegisterPushTokenParams {
  expoPushToken: string;
  deviceId?: string;
  deviceType: 'ios' | 'android';
  deviceName?: string;
  appVersion?: string;
}

// Device info returned from API
export interface DeviceInfo {
  id: string;
  deviceType: 'ios' | 'android';
  deviceName: string | null;
  appVersion: string | null;
  lastUsedAt: string;
  createdAt: string;
}

// Response from register push token
export interface RegisterPushTokenResponse {
  message: string;
  token: {
    id: string;
    deviceType: 'ios' | 'android';
    deviceName: string | null;
    createdAt: string;
  };
}

// Response from get active devices
export interface GetActiveDevicesResponse {
  devices: DeviceInfo[];
}

// Response from deactivate tokens
export interface DeactivateTokensResponse {
  message: string;
  count?: number;
}

// Push notification data payload types
export type NotificationType =
  | 'reward_issued'
  | 'redemption_approval_requested'
  | 'redemption_approval_request'
  | 'redemption_approved'
  | 'redemption_rejected'
  | 'booking_confirmed'
  | 'appointment_reminder'
  | 'upcoming_appointment'
  | 'order_completed'
  | 'service_order_completed'
  | 'service_booking_received'
  | 'new_booking'
  | 'token_gifted'
  | 'reschedule_request_created'
  | 'reschedule_request_approved'
  | 'reschedule_request_rejected'
  | 'subscription_expiring'
  | 'subscription_expired'
  | 'subscription_renewed';

// Base notification data
export interface NotificationData {
  type: NotificationType;
  [key: string]: any;
}

// Specific notification data types
export interface RewardIssuedData extends NotificationData {
  type: 'reward_issued';
  transactionId?: string;
  amount: number;
  shopName: string;
}

export interface BookingConfirmedData extends NotificationData {
  type: 'booking_confirmed';
  orderId: string;
  shopName: string;
  serviceName: string;
  appointmentDate: string;
  appointmentTime: string;
}

export interface AppointmentReminderData extends NotificationData {
  type: 'appointment_reminder';
  orderId: string;
  shopName: string;
  serviceName: string;
  appointmentTime: string;
}

export interface RedemptionApprovalData extends NotificationData {
  type: 'redemption_approval_requested';
  sessionId: string;
  amount: number;
  shopName: string;
}

// Push notification state
export interface PushNotificationState {
  expoPushToken: string | null;
  isRegistered: boolean;
  isLoading: boolean;
  permissionStatus: 'undetermined' | 'granted' | 'denied';
  error: string | null;
}

// In-app notification from API
export interface Notification {
  id: string;
  senderAddress: string;
  receiverAddress: string;
  notificationType: string;
  message: string;
  metadata: Record<string, any>;
  isRead: boolean;
  createdAt: string;
  updatedAt: string;
}

// Response from get notifications
export interface GetNotificationsResponse {
  items: Notification[];
  pagination: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
    hasMore: boolean;
  };
}

// Response from get unread count
export interface GetUnreadCountResponse {
  count: number;
}

// Response from mark as read
export interface MarkAsReadResponse {
  message: string;
  notification?: Notification;
}

// Appointment notification preferences
export interface AppointmentNotificationPreferences {
  id?: string;
  customerAddress?: string;
  emailEnabled: boolean;
  smsEnabled: boolean;
  inAppEnabled: boolean;
  reminder24hEnabled: boolean;
  reminder2hEnabled: boolean;
  reminder30mEnabled: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  createdAt?: string;
  updatedAt?: string;
}

// General notification preferences
export interface GeneralNotificationPreferences {
  id?: string;
  userAddress?: string;
  userType?: 'customer' | 'shop' | 'admin';
  // Platform Updates
  platformUpdates: boolean;
  maintenanceAlerts: boolean;
  newFeatures: boolean;
  // Account & Security
  securityAlerts: boolean;
  loginNotifications: boolean;
  passwordChanges: boolean;
  // Tokens & Rewards (Customer)
  tokenReceived: boolean;
  tokenRedeemed: boolean;
  rewardsEarned: boolean;
  // Orders & Services (Customer)
  orderUpdates: boolean;
  serviceApproved: boolean;
  reviewRequests: boolean;
  // Shop Operations
  newOrders: boolean;
  customerMessages: boolean;
  lowTokenBalance: boolean;
  subscriptionReminders: boolean;
  // Admin
  systemAlerts: boolean;
  userReports: boolean;
  treasuryChanges: boolean;
  // Marketing
  promotions: boolean;
  newsletter: boolean;
  surveys: boolean;
  createdAt?: string;
  updatedAt?: string;
}

// Update payload for general preferences (partial)
export type UpdateGeneralNotificationPreferences = Partial<
  Omit<GeneralNotificationPreferences, 'id' | 'userAddress' | 'userType' | 'createdAt' | 'updatedAt'>
>;
