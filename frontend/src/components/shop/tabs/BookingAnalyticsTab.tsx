'use client';

import React, { useEffect } from 'react';
import { useBookingAnalyticsStore } from '@/stores/bookingAnalyticsStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Calendar, CheckCircle, AlertTriangle, Clock, RefreshCw, XCircle, Users } from 'lucide-react';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const STATUS_COLORS: Record<string, string> = {
  paid: '#3B82F6',
  completed: '#22C55E',
  cancelled: '#EF4444',
  no_show: '#F59E0B',
  pending: '#6B7280',
};

function formatHour(hour: number): string {
  if (hour === 0) return '12 AM';
  if (hour === 12) return '12 PM';
  return hour < 12 ? `${hour} AM` : `${hour - 12} PM`;
}

export function BookingAnalyticsTab() {
  const { trendDays, setTrendDays, fetchAnalytics, getData, isDataStale, isRefreshing, error } =
    useBookingAnalyticsStore();

  const analytics = getData(trendDays);

  useEffect(() => {
    if (isDataStale(trendDays)) {
      fetchAnalytics(trendDays);
    }
  }, [trendDays]);

  const isLoading = !analytics && isRefreshing;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-[#FFCC00]" />
      </div>
    );
  }

  if (!analytics && error) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400">{error}</p>
        <button
          onClick={() => fetchAnalytics(trendDays, true)}
          className="mt-4 px-6 py-2 bg-[#FFCC00] text-black font-semibold rounded-lg hover:bg-[#FFD700] transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-[#FFCC00]" />
      </div>
    );
  }

  const { summary, statusBreakdown, busiestDays, peakHours, cancellationReasons, bookingTrends } = analytics;
  const totalStatusCount = statusBreakdown.reduce((sum, s) => sum + s.count, 0);
  const maxDayCount = Math.max(...busiestDays.map(d => d.count), 1);
  const maxHourCount = Math.max(...peakHours.map(h => h.count), 1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white">Booking Analytics</h2>
          <p className="text-gray-400">
            Track booking patterns and appointment metrics
            {isRefreshing && <span className="ml-2 text-xs text-[#FFCC00]">Updating...</span>}
          </p>
        </div>

        {/* Time Range Selector */}
        <div className="flex gap-2">
          {[7, 30, 90].map((days) => (
            <button
              key={days}
              onClick={() => setTrendDays(days)}
              className={`px-4 py-2 rounded-lg font-semibold transition-all duration-200 ${
                trendDays === days
                  ? 'bg-[#FFCC00] text-black'
                  : 'bg-[#1A1A1A] text-gray-400 border border-gray-800 hover:border-[#FFCC00]/50'
              }`}
            >
              {days} Days
            </button>
          ))}
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-[#1A1A1A] border-gray-800">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <Calendar className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-gray-400">Total Bookings</p>
                <p className="text-2xl font-bold text-white">{summary.totalBookings}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#1A1A1A] border-gray-800">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/20 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-400" />
              </div>
              <div>
                <p className="text-sm text-gray-400">Completion Rate</p>
                <p className="text-2xl font-bold text-white">{summary.completionRate.toFixed(1)}%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#1A1A1A] border-gray-800">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-500/20 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-yellow-400" />
              </div>
              <div>
                <p className="text-sm text-gray-400">No-Show Rate</p>
                <p className="text-2xl font-bold text-white">{summary.noShowRate.toFixed(1)}%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#1A1A1A] border-gray-800">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/20 rounded-lg">
                <Clock className="h-5 w-5 text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-gray-400">Avg Lead Time</p>
                <p className="text-2xl font-bold text-white">{summary.avgLeadTimeDays.toFixed(1)} days</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Status Breakdown */}
      <Card className="bg-[#1A1A1A] border-gray-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Users className="h-5 w-5 text-[#FFCC00]" />
            Status Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          {totalStatusCount > 0 ? (
            <>
              <div className="flex w-full h-8 rounded-lg overflow-hidden">
                {statusBreakdown.map((s) => {
                  const pct = (s.count / totalStatusCount) * 100;
                  if (pct === 0) return null;
                  return (
                    <div
                      key={s.status}
                      style={{
                        width: `${pct}%`,
                        backgroundColor: STATUS_COLORS[s.status] || '#6B7280',
                      }}
                      className="transition-all duration-300"
                      title={`${s.status}: ${s.count} (${pct.toFixed(1)}%)`}
                    />
                  );
                })}
              </div>
              <div className="flex flex-wrap gap-4 mt-4">
                {statusBreakdown.map((s) => (
                  <div key={s.status} className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: STATUS_COLORS[s.status] || '#6B7280' }}
                    />
                    <span className="text-sm text-gray-400 capitalize">
                      {s.status.replace('_', ' ')}: {s.count}
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-gray-500 text-sm">No booking data available</p>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Busiest Days */}
        <Card className="bg-[#1A1A1A] border-gray-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Calendar className="h-5 w-5 text-[#FFCC00]" />
              Busiest Days
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {busiestDays.length > 0 ? (
              busiestDays.map((d) => (
                <div key={d.dayOfWeek} className="flex items-center gap-3">
                  <span className="text-sm text-gray-400 w-10">{DAY_NAMES[d.dayOfWeek]}</span>
                  <div className="flex-1 bg-gray-800 rounded-full h-6 overflow-hidden">
                    <div
                      className="h-full bg-[#FFCC00] rounded-full transition-all duration-500"
                      style={{ width: `${(d.count / maxDayCount) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm text-white font-medium w-8 text-right">{d.count}</span>
                </div>
              ))
            ) : (
              <p className="text-gray-500 text-sm">No data available</p>
            )}
          </CardContent>
        </Card>

        {/* Peak Hours */}
        <Card className="bg-[#1A1A1A] border-gray-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Clock className="h-5 w-5 text-[#FFCC00]" />
              Peak Hours
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-2">
              {Array.from({ length: 16 }, (_, i) => i + 6).map((hour) => {
                const entry = peakHours.find((h) => h.hour === hour);
                const count = entry?.count || 0;
                const opacity = maxHourCount > 0 ? Math.max(0.1, count / maxHourCount) : 0.1;
                return (
                  <div
                    key={hour}
                    className="flex flex-col items-center justify-center p-2 rounded-lg border border-gray-800"
                    style={{ backgroundColor: `rgba(255, 204, 0, ${opacity})` }}
                    title={`${formatHour(hour)}: ${count} bookings`}
                  >
                    <span className="text-xs text-gray-400">{formatHour(hour)}</span>
                    <span className="text-sm font-bold text-white">{count}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cancellation Insights */}
      {cancellationReasons.length > 0 && (
        <Card className="bg-[#1A1A1A] border-gray-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-400" />
              Cancellation Insights
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {cancellationReasons.map((r, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0">
                  <span className="text-sm text-gray-300">{r.reason}</span>
                  <span className="text-sm font-semibold text-white bg-red-500/20 px-3 py-1 rounded-full">
                    {r.count}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Booking Trends */}
      <Card className="bg-[#1A1A1A] border-gray-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Calendar className="h-5 w-5 text-[#FFCC00]" />
            Booking Trends (Last {trendDays} Days)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {bookingTrends.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-800">
                    <th className="text-left py-2 text-sm text-gray-400 font-medium">Date</th>
                    <th className="text-right py-2 text-sm text-gray-400 font-medium">Bookings</th>
                  </tr>
                </thead>
                <tbody>
                  {bookingTrends.map((t) => (
                    <tr key={t.date} className="border-b border-gray-800/50">
                      <td className="py-2 text-sm text-gray-300">
                        {new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </td>
                      <td className="py-2 text-sm text-white text-right font-medium">{t.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-500 text-sm">No trend data available</p>
          )}
        </CardContent>
      </Card>

      {/* Reschedule Stats */}
      <Card className="bg-[#1A1A1A] border-gray-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-[#FFCC00]" />
            Reschedule Stats
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-400">Total Rescheduled</p>
              <p className="text-xl font-bold text-white">{summary.rescheduledCount}</p>
            </div>
            <div>
              <p className="text-sm text-gray-400">Avg Reschedules per Booking</p>
              <p className="text-xl font-bold text-white">{summary.avgRescheduleCount.toFixed(2)}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default BookingAnalyticsTab;
