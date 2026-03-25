export type TrendDays = 7 | 30 | 90;

export interface BookingAnalytics {
  summary: {
    totalBookings: number;
    completed: number;
    noShows: number;
    cancelled: number;
    completionRate: number;
    noShowRate: number;
    cancellationRate: number;
    avgLeadTimeDays: number;
    rescheduledCount: number;
    avgRescheduleCount: number;
  };
  statusBreakdown: Array<{ status: string; count: number }>;
  busiestDays: Array<{ dayOfWeek: number; count: number }>;
  peakHours: Array<{ hour: number; count: number }>;
  cancellationReasons: Array<{ reason: string; count: number }>;
  bookingTrends: Array<{ date: string; count: number }>;
}
