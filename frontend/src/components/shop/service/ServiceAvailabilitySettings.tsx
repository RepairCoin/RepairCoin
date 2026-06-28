"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Clock, Save, Loader2, AlertCircle, Check, Calendar, ArrowRight } from 'lucide-react';
import { appointmentsApi } from '@/services/api/appointments';
import { ShopService } from '@/services/api/services';
import { toast } from 'react-hot-toast';

interface ServiceAvailabilitySettingsProps {
  serviceId: string;
  service: ShopService;
}

export const ServiceAvailabilitySettings: React.FC<ServiceAvailabilitySettingsProps> = ({
  serviceId,
  service
}) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [customDuration, setCustomDuration] = useState<number>(service.durationMinutes || 60);
  const [savedDuration, setSavedDuration] = useState<number | null>(null);
  const [durationSaved, setDurationSaved] = useState(false);

  useEffect(() => {
    loadServiceDuration();
  }, [serviceId]);

  const loadServiceDuration = async () => {
    try {
      setLoading(true);
      const duration = await appointmentsApi.getServiceDuration(serviceId);
      if (duration) {
        setCustomDuration(duration.durationMinutes);
        setSavedDuration(duration.durationMinutes);
      } else {
        setSavedDuration(null);
      }
    } catch (error) {
      console.error('Error loading service duration:', error);
      setSavedDuration(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDuration = async () => {
    try {
      setSaving(true);
      await appointmentsApi.updateServiceDuration(serviceId, customDuration);
      setSavedDuration(customDuration);
      setDurationSaved(true);
      toast.success('Service duration updated successfully');
      setTimeout(() => setDurationSaved(false), 2000);
    } catch (error) {
      console.error('Error updating service duration:', error);
      toast.error('Failed to update service duration');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-[#FFCC00]" />
        <span className="ml-3 text-gray-400">Loading availability settings...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Service-Specific Duration */}
      <div className="bg-[#1A1A1A] border border-gray-800 rounded-2xl p-6">
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <Clock className="w-6 h-6 text-[#FFCC00]" />
          Service Duration
        </h2>

        <div className="bg-[#FFCC00]/10 border border-[#FFCC00]/30 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-[#FFCC00] mt-0.5" />
            <div className="text-sm text-gray-300">
              <p className="font-semibold text-white mb-1">Custom Duration for This Service</p>
              <p>Set a specific duration for <span className="text-[#FFCC00]">{service.serviceName}</span>. This will override the shop&apos;s default time slot duration.</p>
            </div>
          </div>
        </div>

        <div className="max-w-md">
          <label className="block text-sm font-medium text-gray-400 mb-2">
            Duration (minutes)
          </label>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
            <input
              type="number"
              value={customDuration}
              onChange={(e) => setCustomDuration(parseInt(e.target.value) || 60)}
              min={15}
              step={15}
              className="w-full sm:flex-1 px-4 py-3 bg-[#0D0D0D] border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-[#FFCC00] focus:border-transparent"
            />
            <button
              onClick={handleSaveDuration}
              disabled={saving || customDuration === (savedDuration ?? service.durationMinutes ?? 60)}
              className="w-full sm:w-auto px-6 py-3 bg-[#FFCC00] text-black rounded-lg font-semibold hover:bg-[#FFD700] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Saving...
                </>
              ) : durationSaved ? (
                <>
                  <Check className="w-5 h-5" />
                  Saved!
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Save
                </>
              )}
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Current: {customDuration} minutes (increments of 15 minutes)
          </p>
        </div>
      </div>

      {/* Shop-wide hours & holidays live on a dedicated page (shared by all services) */}
      <div className="bg-[#1A1A1A] border border-gray-800 rounded-2xl p-6">
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <Calendar className="w-6 h-6 text-[#FFCC00]" />
          Operating Hours &amp; Holidays
        </h2>

        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-blue-400 mt-0.5" />
            <div className="text-sm text-gray-300">
              <p className="font-semibold text-white mb-1">Shop-Wide Settings</p>
              <p>Operating hours, booking rules, and holiday closures are shared by all your services. Manage them on the Availability Settings page.</p>
            </div>
          </div>
        </div>

        <Link
          href="/shop/availability"
          className="inline-flex items-center gap-2 px-6 py-3 bg-[#FFCC00] text-black rounded-lg font-semibold hover:bg-[#FFD700] transition-colors"
        >
          Manage Availability Settings
          <ArrowRight className="w-5 h-5" />
        </Link>
      </div>
    </div>
  );
};
