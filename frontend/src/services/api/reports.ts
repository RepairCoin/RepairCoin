// frontend/src/services/api/reports.ts
import apiClient from './client';

export interface ReportSettings {
  dailyDigest: {
    enabled: boolean;
    sendTime: string; // Format: "18:00" (UTC)
  };
  weeklyReport: {
    enabled: boolean;
    dayOfWeek: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
  };
  monthlyReport: {
    enabled: boolean;
    dayOfMonth: number; // 1-28
  };
}

export interface UpdateReportSettings {
  dailyDigest?: {
    enabled?: boolean;
  };
  weeklyReport?: {
    enabled?: boolean;
    dayOfWeek?: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
  };
  monthlyReport?: {
    enabled?: boolean;
    dayOfMonth?: number; // 1-28
  };
}

export interface DailyStats {
  newBookings: number;
  bookingsTrend: number;
  revenue: number;
  revenueTrend: number;
  newCustomers: number;
  customersTrend: number;
  completedServices: number;
  completedTrend: number;
  avgRating: number;
  ratingTrend: number;
  noShows: number;
  noShowTrend: number;
  rcnIssued: number;
  reviews: number;
  cancellations: number;
}

export interface WeeklyStats {
  bookingsCount: number;
  bookingsTrend: number;
  revenue: number;
  revenueTrend: number;
  completedCount: number;
  completedTrend: number;
  avgRating: number;
  ratingTrend: number;
  completionRate: number;
  noShowRate: number;
  cancellationRate: number;
}

export interface MonthlyStats extends WeeklyStats {
  avgOrderValue: number;
  rcnIssued: number;
  rcnIssuedUsd: number;
  peakDays: string[];
  avgResponseTime: string;
  customerRetention: number;
  retentionTrend: number;
}

export interface TopService {
  name: string;
  bookings: number;
  revenue: number;
}

export interface CustomerInsights {
  newCustomers: number;
  repeatCustomers: number;
  avgSatisfaction: number;
}

export interface TopCustomer {
  name: string;
  visits: number;
  totalSpent: number;
}

export interface DailyReportPreview {
  shopName: string;
  date: string;
  stats: DailyStats;
}

export interface WeeklyReportPreview {
  shopName: string;
  weekStart: string;
  weekEnd: string;
  stats: WeeklyStats;
  topServices: TopService[];
  customerInsights: CustomerInsights;
}

export interface MonthlyReportPreview {
  shopName: string;
  monthLabel: string;
  stats: MonthlyStats;
  topServices: Array<TopService & { rank: number }>;
  topCustomers: TopCustomer[];
}

/**
 * Get report settings for the authenticated shop
 */
export const getReportSettings = async (): Promise<ReportSettings> => {
  const response = await apiClient.get('/shops/reports/settings');
  return response.data;
};

/**
 * Update report settings
 */
export const updateReportSettings = async (settings: UpdateReportSettings): Promise<void> => {
  await apiClient.put('/shops/reports/settings', settings);
};

/**
 * Generate preview of a report
 * @param type - Report type: 'daily', 'weekly', or 'monthly'
 */
export const previewReport = async (
  type: 'daily' | 'weekly' | 'monthly'
): Promise<DailyReportPreview | WeeklyReportPreview | MonthlyReportPreview> => {
  const response = await apiClient.post(`/shops/reports/preview/${type}`);
  return response.data;
};

/**
 * Send test report email
 * @param type - Report type: 'daily', 'weekly', or 'monthly'
 * @param recipientEmail - Email address to send test report to
 */
export const sendTestReport = async (
  type: 'daily' | 'weekly' | 'monthly',
  recipientEmail: string
): Promise<void> => {
  await apiClient.post(`/shops/reports/test/${type}`, { recipientEmail });
};
