"use client";

import React, { useState, useEffect } from 'react';
import { Clock, Save, Loader2, AlertCircle, Check } from 'lucide-react';
import { appointmentsApi, ShopAvailability } from '@/services/api/appointments';
import { ShopService } from '@/services/api/services';
import { toast } from 'react-hot-toast';

interface ServiceAvailabilitySettingsProps {
  serviceId: string;
  service: ShopService;
}

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' }
];

export const ServiceAvailabilitySettings: React.FC<ServiceAvailabilitySettingsProps> = ({
  serviceId,
  service
}) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [shopAvailability, setShopAvailability] = useState<ShopAvailability[]>([]);
  const [customDuration, setCustomDuration] = useState<number>(service.durationMinutes || 60);
  const [durationSaved, setDurationSaved] = useState(false);

  useEffect(() => {
    loadShopAvailability();
  }, [service.shopId]);

  const loadShopAvailability = async () => {
    try {
      setLoading(true);
      const availability = await appointmentsApi.getShopAvailability(service.shopId);
      setShopAvailability(availability);
    } catch (error) {
      console.error('Error loading shop availability:', error);
      toast.error('Failed to load shop availability');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDuration = async () => {
    try {
      setSaving(true);
      await appointmentsApi.updateServiceDuration(serviceId, customDuration);
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
              <p>Set a specific duration for <span className="text-[#FFCC00]">{service.serviceName}</span>. This will override the shop's default time slot duration.</p>
            </div>
          </div>
        </div>

        <div className="max-w-md">
          <label className="block text-sm font-medium text-gray-400 mb-2">
            Duration (minutes)
          </label>
          <div className="flex items-center gap-4">
            <input
              type="number"
              value={customDuration}
              onChange={(e) => setCustomDuration(parseInt(e.target.value) || 60)}
              min={15}
              step={15}
              className="flex-1 px-4 py-3 bg-[#0D0D0D] border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-[#FFCC00] focus:border-transparent"
            />
            <button
              onClick={handleSaveDuration}
              disabled={saving || customDuration === (service.durationMinutes || 60)}
              className="px-6 py-3 bg-[#FFCC00] text-black rounded-lg font-semibold hover:bg-[#FFD700] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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

      {/* Shop-Wide Availability (Read-Only for Context) */}
      <div className="bg-[#1A1A1A] border border-gray-800 rounded-2xl p-6">
        <h2 className="text-xl font-bold text-white mb-4">Shop Operating Hours</h2>

        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-blue-400 mt-0.5" />
            <div className="text-sm text-gray-300">
              <p className="font-semibold text-white mb-1">Reference Only</p>
              <p>These are your shop's overall operating hours. This service will follow these hours. To change them, go to the shop-wide Availability Settings in the sidebar.</p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {DAYS_OF_WEEK.map(day => {
            const dayAvail = shopAvailability.find(a => a.dayOfWeek === day.value);

            return (
              <div key={day.value} className="bg-[#0D0D0D] border border-gray-800 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-white font-semibold w-28">{day.label}</span>
                    {dayAvail?.isOpen ? (
                      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-500/20 text-green-400 border border-green-500/30">
                        Open
                      </span>
                    ) : (
                      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-gray-500/20 text-gray-400 border border-gray-500/30">
                        Closed
                      </span>
                    )}
                  </div>
                  {dayAvail?.isOpen && dayAvail.openTime && dayAvail.closeTime && (
                    <div className="text-sm text-gray-400">
                      {dayAvail.openTime} - {dayAvail.closeTime}
                      {dayAvail.breakStartTime && dayAvail.breakEndTime && (
                        <span className="ml-2 text-xs">
                          (Break: {dayAvail.breakStartTime} - {dayAvail.breakEndTime})
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
