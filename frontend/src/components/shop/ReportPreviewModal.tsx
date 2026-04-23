"use client";

import React from "react";
import { X, TrendingUp, TrendingDown, Minus } from "lucide-react";
import type {
  DailyReportPreview,
  WeeklyReportPreview,
  MonthlyReportPreview,
} from "@/services/api/reports";

interface ReportPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  previewData: DailyReportPreview | WeeklyReportPreview | MonthlyReportPreview;
}

export const ReportPreviewModal: React.FC<ReportPreviewModalProps> = ({
  isOpen,
  onClose,
  previewData,
}) => {
  if (!isOpen) return null;

  const isDailyReport = 'date' in previewData;
  const isWeeklyReport = 'weekStart' in previewData && 'weekEnd' in previewData;
  const isMonthlyReport = 'monthLabel' in previewData;

  const renderTrend = (value: number) => {
    if (value === 0) {
      return (
        <span className="flex items-center gap-1 text-gray-400 text-sm">
          <Minus className="w-4 h-4" />
          No change
        </span>
      );
    }
    return value > 0 ? (
      <span className="flex items-center gap-1 text-green-400 text-sm">
        <TrendingUp className="w-4 h-4" />
        +{value}%
      </span>
    ) : (
      <span className="flex items-center gap-1 text-red-400 text-sm">
        <TrendingDown className="w-4 h-4" />
        {value}%
      </span>
    );
  };

  const renderDailyReport = (data: DailyReportPreview) => (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <h3 className="text-2xl font-bold text-white mb-1">{data.shopName}</h3>
        <p className="text-gray-400">{data.date}</p>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-900/50 rounded-lg p-4">
          <p className="text-gray-400 text-sm mb-1">New Bookings</p>
          <p className="text-2xl font-bold text-white">{data.stats.newBookings}</p>
          {renderTrend(data.stats.bookingsTrend)}
        </div>
        <div className="bg-gray-900/50 rounded-lg p-4">
          <p className="text-gray-400 text-sm mb-1">Revenue</p>
          <p className="text-2xl font-bold text-white">${data.stats.revenue.toFixed(2)}</p>
          {renderTrend(data.stats.revenueTrend)}
        </div>
        <div className="bg-gray-900/50 rounded-lg p-4">
          <p className="text-gray-400 text-sm mb-1">New Customers</p>
          <p className="text-2xl font-bold text-white">{data.stats.newCustomers}</p>
          {renderTrend(data.stats.customersTrend)}
        </div>
        <div className="bg-gray-900/50 rounded-lg p-4">
          <p className="text-gray-400 text-sm mb-1">Completed</p>
          <p className="text-2xl font-bold text-white">{data.stats.completedServices}</p>
          {renderTrend(data.stats.completedTrend)}
        </div>
        <div className="bg-gray-900/50 rounded-lg p-4">
          <p className="text-gray-400 text-sm mb-1">Avg Rating</p>
          <p className="text-2xl font-bold text-white">{data.stats.avgRating.toFixed(1)}</p>
          {renderTrend(data.stats.ratingTrend)}
        </div>
        <div className="bg-gray-900/50 rounded-lg p-4">
          <p className="text-gray-400 text-sm mb-1">No-Shows</p>
          <p className="text-2xl font-bold text-white">{data.stats.noShows}</p>
          {renderTrend(data.stats.noShowTrend)}
        </div>
      </div>

      {/* Activity Summary */}
      <div className="bg-gray-900/50 rounded-lg p-4">
        <h4 className="text-lg font-semibold text-white mb-3">Activity Summary</h4>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-gray-400">RCN Issued</p>
            <p className="text-white font-semibold">{data.stats.rcnIssued}</p>
          </div>
          <div>
            <p className="text-gray-400">Reviews Received</p>
            <p className="text-white font-semibold">{data.stats.reviews}</p>
          </div>
          <div>
            <p className="text-gray-400">Cancellations</p>
            <p className="text-white font-semibold">{data.stats.cancellations}</p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderWeeklyReport = (data: WeeklyReportPreview) => (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <h3 className="text-2xl font-bold text-white mb-1">{data.shopName}</h3>
        <p className="text-gray-400">
          {data.weekStart} - {data.weekEnd}
        </p>
      </div>

      {/* Performance Overview */}
      <div className="bg-gray-900/50 rounded-lg p-4 mb-4">
        <h4 className="text-lg font-semibold text-white mb-3">Performance Overview</h4>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-gray-400 text-sm">Bookings</span>
              <span className="text-white font-semibold">{data.stats.bookingsCount}</span>
            </div>
            {renderTrend(data.stats.bookingsTrend)}
          </div>
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-gray-400 text-sm">Revenue</span>
              <span className="text-white font-semibold">${data.stats.revenue.toFixed(2)}</span>
            </div>
            {renderTrend(data.stats.revenueTrend)}
          </div>
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-gray-400 text-sm">Completed</span>
              <span className="text-white font-semibold">{data.stats.completedCount}</span>
            </div>
            {renderTrend(data.stats.completedTrend)}
          </div>
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-gray-400 text-sm">Avg Rating</span>
              <span className="text-white font-semibold">{data.stats.avgRating.toFixed(1)}</span>
            </div>
            {renderTrend(data.stats.ratingTrend)}
          </div>
        </div>
      </div>

      {/* Top Services */}
      {data.topServices && data.topServices.length > 0 && (
        <div className="bg-gray-900/50 rounded-lg p-4 mb-4">
          <h4 className="text-lg font-semibold text-white mb-3">Top Performing Services</h4>
          <div className="space-y-3">
            {data.topServices.map((service, index) => (
              <div key={index} className="flex justify-between items-center">
                <span className="text-gray-300">{service.name}</span>
                <div className="text-right">
                  <p className="text-white font-semibold">{service.bookings} bookings</p>
                  <p className="text-gray-400 text-sm">${service.revenue.toFixed(2)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Customer Insights */}
      <div className="bg-gray-900/50 rounded-lg p-4">
        <h4 className="text-lg font-semibold text-white mb-3">Customer Insights</h4>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-gray-400">New Customers</p>
            <p className="text-white font-semibold">{data.customerInsights.newCustomers}</p>
          </div>
          <div>
            <p className="text-gray-400">Repeat Customers</p>
            <p className="text-white font-semibold">{data.customerInsights.repeatCustomers}</p>
          </div>
          <div>
            <p className="text-gray-400">Avg Satisfaction</p>
            <p className="text-white font-semibold">{data.customerInsights.avgSatisfaction.toFixed(1)}</p>
          </div>
        </div>
      </div>

      {/* Operational Metrics */}
      <div className="bg-gray-900/50 rounded-lg p-4">
        <h4 className="text-lg font-semibold text-white mb-3">Operational Metrics</h4>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-gray-400">Completion Rate</p>
            <p className="text-white font-semibold">{data.stats.completionRate.toFixed(1)}%</p>
          </div>
          <div>
            <p className="text-gray-400">No-Show Rate</p>
            <p className="text-white font-semibold">{data.stats.noShowRate.toFixed(1)}%</p>
          </div>
          <div>
            <p className="text-gray-400">Cancellation Rate</p>
            <p className="text-white font-semibold">{data.stats.cancellationRate.toFixed(1)}%</p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderMonthlyReport = (data: MonthlyReportPreview) => (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <h3 className="text-2xl font-bold text-white mb-1">{data.shopName}</h3>
        <p className="text-gray-400">{data.monthLabel}</p>
      </div>

      {/* Monthly Highlights */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-gray-900/50 rounded-lg p-4">
          <p className="text-gray-400 text-sm mb-1">Total Bookings</p>
          <p className="text-2xl font-bold text-white">{data.stats.bookingsCount}</p>
          {renderTrend(data.stats.bookingsTrend)}
        </div>
        <div className="bg-gray-900/50 rounded-lg p-4">
          <p className="text-gray-400 text-sm mb-1">Total Revenue</p>
          <p className="text-2xl font-bold text-white">${data.stats.revenue.toFixed(2)}</p>
          {renderTrend(data.stats.revenueTrend)}
        </div>
        <div className="bg-gray-900/50 rounded-lg p-4">
          <p className="text-gray-400 text-sm mb-1">Avg Order Value</p>
          <p className="text-2xl font-bold text-white">${data.stats.avgOrderValue.toFixed(2)}</p>
        </div>
        <div className="bg-gray-900/50 rounded-lg p-4">
          <p className="text-gray-400 text-sm mb-1">Customer Retention</p>
          <p className="text-2xl font-bold text-white">{data.stats.customerRetention.toFixed(1)}%</p>
          {renderTrend(data.stats.retentionTrend)}
        </div>
      </div>

      {/* Revenue Breakdown */}
      <div className="bg-gray-900/50 rounded-lg p-4 mb-4">
        <h4 className="text-lg font-semibold text-white mb-3">Revenue Breakdown</h4>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-400">Service Revenue</p>
            <p className="text-white font-semibold">${data.stats.revenue.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-gray-400">RCN Issued</p>
            <p className="text-white font-semibold">{data.stats.rcnIssued} (${data.stats.rcnIssuedUsd.toFixed(2)})</p>
          </div>
          <div>
            <p className="text-gray-400">Peak Days</p>
            <p className="text-white font-semibold">{data.stats.peakDays.join(', ')}</p>
          </div>
          <div>
            <p className="text-gray-400">Avg Response Time</p>
            <p className="text-white font-semibold">{data.stats.avgResponseTime}</p>
          </div>
        </div>
      </div>

      {/* Top Services */}
      {data.topServices && data.topServices.length > 0 && (
        <div className="bg-gray-900/50 rounded-lg p-4 mb-4">
          <h4 className="text-lg font-semibold text-white mb-3">Top 5 Services</h4>
          <div className="space-y-3">
            {data.topServices.map((service) => (
              <div key={service.rank} className="flex items-center gap-3">
                <span className="text-[#FFCC00] font-bold w-6">#{service.rank}</span>
                <div className="flex-1">
                  <p className="text-white">{service.name}</p>
                  <p className="text-gray-400 text-sm">{service.bookings} bookings • ${service.revenue.toFixed(2)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top Customers */}
      {data.topCustomers && data.topCustomers.length > 0 && (
        <div className="bg-gray-900/50 rounded-lg p-4 mb-4">
          <h4 className="text-lg font-semibold text-white mb-3">Top 5 Customers</h4>
          <div className="space-y-3">
            {data.topCustomers.map((customer, index) => (
              <div key={index} className="flex justify-between items-center">
                <span className="text-gray-300">{customer.name}</span>
                <div className="text-right">
                  <p className="text-white font-semibold">{customer.visits} visits</p>
                  <p className="text-gray-400 text-sm">${customer.totalSpent.toFixed(2)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Operational Health */}
      <div className="bg-gray-900/50 rounded-lg p-4">
        <h4 className="text-lg font-semibold text-white mb-3">Operational Health</h4>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-400">Completion Rate</p>
            <p className="text-white font-semibold">{data.stats.completionRate.toFixed(1)}%</p>
          </div>
          <div>
            <p className="text-gray-400">No-Shows</p>
            <p className="text-white font-semibold">{data.stats.noShowRate.toFixed(1)}%</p>
          </div>
          <div>
            <p className="text-gray-400">Cancellations</p>
            <p className="text-white font-semibold">{data.stats.cancellationRate.toFixed(1)}%</p>
          </div>
          <div>
            <p className="text-gray-400">Avg Rating</p>
            <p className="text-white font-semibold">{data.stats.avgRating.toFixed(1)}</p>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-[#1e1f22] rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-[#1e1f22] border-b border-gray-800 p-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white">Report Preview</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-6 h-6 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {isDailyReport && renderDailyReport(previewData as DailyReportPreview)}
          {isWeeklyReport && renderWeeklyReport(previewData as WeeklyReportPreview)}
          {isMonthlyReport && renderMonthlyReport(previewData as MonthlyReportPreview)}
        </div>
      </div>
    </div>
  );
};
