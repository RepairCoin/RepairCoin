"use client";

import React, { useState, useEffect } from "react";
import { FileBarChart, Mail, Send, Eye, Calendar, Clock, Info } from "lucide-react";
import toast from "react-hot-toast";
import {
  getReportSettings,
  updateReportSettings,
  previewReport,
  sendTestReport,
  type ReportSettings,
  type UpdateReportSettings
} from "@/services/api/reports";
import { ReportPreviewModal } from "../ReportPreviewModal";

interface ReportsTabProps {
  shopId: string;
}

export const ReportsTab: React.FC<ReportsTabProps> = ({ shopId }) => {
  const [settings, setSettings] = useState<ReportSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingReport, setTestingReport] = useState<string | null>(null);
  const [previewingReport, setPreviewingReport] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<Record<string, unknown> | null>(null);
  const [testEmail, setTestEmail] = useState("");
  const [showTestEmailInput, setShowTestEmailInput] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
  }, [shopId]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const data = await getReportSettings();
      setSettings(data);
    } catch (error) {
      console.error("Error loading report settings:", error);
      toast.error("Failed to load report settings");
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (
    reportType: keyof ReportSettings,
    enabled: boolean
  ) => {
    if (!settings) return;

    try {
      setSaving(true);
      const updates: UpdateReportSettings = {
        [reportType]: { enabled },
      };
      await updateReportSettings(updates);

      // Update local state
      setSettings({
        ...settings,
        [reportType]: {
          ...settings[reportType],
          enabled,
        },
      });

      toast.success(`${getReportTitle(reportType)} ${enabled ? "enabled" : "disabled"}`);
    } catch (error) {
      console.error("Error updating settings:", error);
      toast.error("Failed to update settings");
    } finally {
      setSaving(false);
    }
  };

  const handleDayChange = async (
    reportType: 'weeklyReport' | 'monthlyReport',
    value: string | number
  ) => {
    if (!settings) return;

    try {
      setSaving(true);
      const updates: UpdateReportSettings = {
        [reportType]: reportType === 'weeklyReport'
          ? { dayOfWeek: value as string }
          : { dayOfMonth: value as number },
      };
      await updateReportSettings(updates);

      // Update local state
      setSettings({
        ...settings,
        [reportType]: {
          ...settings[reportType],
          [reportType === 'weeklyReport' ? 'dayOfWeek' : 'dayOfMonth']: value,
        },
      });

      toast.success("Schedule updated successfully");
    } catch (error) {
      console.error("Error updating schedule:", error);
      toast.error("Failed to update schedule");
    } finally {
      setSaving(false);
    }
  };

  const handlePreview = async (reportType: 'daily' | 'weekly' | 'monthly') => {
    try {
      setPreviewingReport(reportType);
      const data = await previewReport(reportType);
      setPreviewData(data);
    } catch (error) {
      console.error("Error generating preview:", error);
      toast.error("Failed to generate preview");
    } finally {
      setPreviewingReport(null);
    }
  };

  const handleSendTest = async (reportType: 'daily' | 'weekly' | 'monthly') => {
    if (!testEmail) {
      toast.error("Please enter an email address");
      return;
    }

    try {
      setTestingReport(reportType);
      await sendTestReport(reportType, testEmail);
      toast.success(`Test ${reportType} report sent to ${testEmail}`);
      setShowTestEmailInput(null);
      setTestEmail("");
    } catch (error) {
      console.error("Error sending test report:", error);
      toast.error("Failed to send test report");
    } finally {
      setTestingReport(null);
    }
  };

  const getReportTitle = (reportType: string): string => {
    const titles: Record<string, string> = {
      dailyDigest: "Daily Digest",
      weeklyReport: "Weekly Report",
      monthlyReport: "Monthly Report",
    };
    return titles[reportType] || reportType;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#FFCC00] mx-auto mb-4"></div>
          <p className="text-gray-400">Loading report settings...</p>
        </div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-400">Failed to load report settings</p>
      </div>
    );
  }

  const daysOfWeek = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const daysOfMonth = Array.from({ length: 28 }, (_, i) => i + 1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#1e1f22] to-[#2a2b2f] rounded-xl p-6 border border-gray-800">
        <div className="flex items-center gap-3 mb-2">
          <FileBarChart className="w-8 h-8 text-[#FFCC00]" />
          <h1 className="text-2xl font-bold text-white">Automated Reports</h1>
        </div>
        <p className="text-gray-400">
          Stay informed with automated email reports about your shop's performance.
          Choose which reports you want to receive and when.
        </p>
      </div>

      {/* Daily Digest Card */}
      <div className="bg-[#1e1f22] rounded-xl p-6 border border-gray-800">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <Mail className="w-6 h-6 text-blue-400" />
              <h3 className="text-xl font-bold text-white">Daily Digest</h3>
            </div>
            <p className="text-gray-400 text-sm">
              Get a daily summary of your shop's performance sent to your email every evening.
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={settings.dailyDigest.enabled}
              onChange={(e) => handleToggle('dailyDigest', e.target.checked)}
              disabled={saving}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[#FFCC00]/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#FFCC00]"></div>
          </label>
        </div>

        {/* Schedule Info */}
        <div className="bg-gray-900/50 rounded-lg p-4 mb-4">
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Clock className="w-4 h-4" />
            <span>Sent daily at {settings.dailyDigest.sendTime} UTC (6 PM UTC)</span>
          </div>
          <div className="flex items-start gap-2 mt-2 text-xs text-gray-500">
            <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>Includes: New bookings, revenue, customers, ratings, and activity summary</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={() => handlePreview('daily')}
            disabled={previewingReport === 'daily'}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            <Eye className="w-4 h-4" />
            {previewingReport === 'daily' ? 'Loading...' : 'Preview'}
          </button>
          {showTestEmailInput === 'daily' ? (
            <div className="flex gap-2 flex-1">
              <input
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="Enter email address"
                className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#FFCC00]"
              />
              <button
                onClick={() => handleSendTest('daily')}
                disabled={testingReport === 'daily' || !testEmail}
                className="px-4 py-2 bg-[#FFCC00] hover:bg-[#e6b800] text-black font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                {testingReport === 'daily' ? 'Sending...' : 'Send'}
              </button>
              <button
                onClick={() => {
                  setShowTestEmailInput(null);
                  setTestEmail("");
                }}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowTestEmailInput('daily')}
              className="flex items-center gap-2 px-4 py-2 bg-[#FFCC00] hover:bg-[#e6b800] text-black font-medium rounded-lg transition-colors"
            >
              <Send className="w-4 h-4" />
              Send Test
            </button>
          )}
        </div>
      </div>

      {/* Weekly Report Card */}
      <div className="bg-[#1e1f22] rounded-xl p-6 border border-gray-800">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <Calendar className="w-6 h-6 text-green-400" />
              <h3 className="text-xl font-bold text-white">Weekly Report</h3>
            </div>
            <p className="text-gray-400 text-sm">
              Receive a comprehensive weekly performance report with trends and insights.
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={settings.weeklyReport.enabled}
              onChange={(e) => handleToggle('weeklyReport', e.target.checked)}
              disabled={saving}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[#FFCC00]/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#FFCC00]"></div>
          </label>
        </div>

        {/* Schedule Selector */}
        <div className="bg-gray-900/50 rounded-lg p-4 mb-4">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Delivery Day
          </label>
          <select
            value={settings.weeklyReport.dayOfWeek}
            onChange={(e) => handleDayChange('weeklyReport', e.target.value)}
            disabled={saving}
            className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-[#FFCC00] disabled:opacity-50"
          >
            {daysOfWeek.map((day) => (
              <option key={day} value={day}>
                Every {day.charAt(0).toUpperCase() + day.slice(1)}
              </option>
            ))}
          </select>
          <div className="flex items-start gap-2 mt-2 text-xs text-gray-500">
            <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>Includes: Week-over-week comparison, top services, customer insights, and operational metrics</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={() => handlePreview('weekly')}
            disabled={previewingReport === 'weekly'}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            <Eye className="w-4 h-4" />
            {previewingReport === 'weekly' ? 'Loading...' : 'Preview'}
          </button>
          {showTestEmailInput === 'weekly' ? (
            <div className="flex gap-2 flex-1">
              <input
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="Enter email address"
                className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#FFCC00]"
              />
              <button
                onClick={() => handleSendTest('weekly')}
                disabled={testingReport === 'weekly' || !testEmail}
                className="px-4 py-2 bg-[#FFCC00] hover:bg-[#e6b800] text-black font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                {testingReport === 'weekly' ? 'Sending...' : 'Send'}
              </button>
              <button
                onClick={() => {
                  setShowTestEmailInput(null);
                  setTestEmail("");
                }}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowTestEmailInput('weekly')}
              className="flex items-center gap-2 px-4 py-2 bg-[#FFCC00] hover:bg-[#e6b800] text-black font-medium rounded-lg transition-colors"
            >
              <Send className="w-4 h-4" />
              Send Test
            </button>
          )}
        </div>
      </div>

      {/* Monthly Report Card */}
      <div className="bg-[#1e1f22] rounded-xl p-6 border border-gray-800">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <FileBarChart className="w-6 h-6 text-purple-400" />
              <h3 className="text-xl font-bold text-white">Monthly Report</h3>
            </div>
            <p className="text-gray-400 text-sm">
              Get a detailed monthly analysis with comprehensive metrics and trends.
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={settings.monthlyReport.enabled}
              onChange={(e) => handleToggle('monthlyReport', e.target.checked)}
              disabled={saving}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[#FFCC00]/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#FFCC00]"></div>
          </label>
        </div>

        {/* Schedule Selector */}
        <div className="bg-gray-900/50 rounded-lg p-4 mb-4">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Delivery Day (1-28)
          </label>
          <select
            value={settings.monthlyReport.dayOfMonth}
            onChange={(e) => handleDayChange('monthlyReport', parseInt(e.target.value))}
            disabled={saving}
            className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-[#FFCC00] disabled:opacity-50"
          >
            {daysOfMonth.map((day) => (
              <option key={day} value={day}>
                Day {day} of every month
              </option>
            ))}
          </select>
          <div className="flex items-start gap-2 mt-2 text-xs text-gray-500">
            <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>Includes: Comprehensive monthly analytics, top services & customers, revenue breakdown, and retention metrics</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={() => handlePreview('monthly')}
            disabled={previewingReport === 'monthly'}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            <Eye className="w-4 h-4" />
            {previewingReport === 'monthly' ? 'Loading...' : 'Preview'}
          </button>
          {showTestEmailInput === 'monthly' ? (
            <div className="flex gap-2 flex-1">
              <input
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="Enter email address"
                className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#FFCC00]"
              />
              <button
                onClick={() => handleSendTest('monthly')}
                disabled={testingReport === 'monthly' || !testEmail}
                className="px-4 py-2 bg-[#FFCC00] hover:bg-[#e6b800] text-black font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                {testingReport === 'monthly' ? 'Sending...' : 'Send'}
              </button>
              <button
                onClick={() => {
                  setShowTestEmailInput(null);
                  setTestEmail("");
                }}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowTestEmailInput('monthly')}
              className="flex items-center gap-2 px-4 py-2 bg-[#FFCC00] hover:bg-[#e6b800] text-black font-medium rounded-lg transition-colors"
            >
              <Send className="w-4 h-4" />
              Send Test
            </button>
          )}
        </div>
      </div>

      {/* Preview Modal */}
      {previewData && (
        <ReportPreviewModal
          isOpen={!!previewData}
          onClose={() => setPreviewData(null)}
          previewData={previewData}
        />
      )}
    </div>
  );
};
