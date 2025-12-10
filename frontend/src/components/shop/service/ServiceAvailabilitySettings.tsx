"use client";

import React, { useState, useEffect } from 'react';
import { Clock, Save, Loader2, AlertCircle, Check, Settings } from 'lucide-react';
import { appointmentsApi, ShopAvailability, TimeSlotConfig } from '@/services/api/appointments';
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
  const [timeSlotConfig, setTimeSlotConfig] = useState<TimeSlotConfig | null>(null);
  const [customDuration, setCustomDuration] = useState<number>(service.durationMinutes || 60);
  const [durationSaved, setDurationSaved] = useState(false);
  const [editingDay, setEditingDay] = useState<number | null>(null);
  const [configSaved, setConfigSaved] = useState(false);
  const [editingValues, setEditingValues] = useState<{
    openTime: string;
    closeTime: string;
    breakStartTime: string;
    breakEndTime: string;
  }>({
    openTime: '09:00',
    closeTime: '18:00',
    breakStartTime: '',
    breakEndTime: ''
  });

  useEffect(() => {
    loadShopAvailability();
    loadTimeSlotConfig();
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

  const loadTimeSlotConfig = async () => {
    try {
      const config = await appointmentsApi.getTimeSlotConfig();
      setTimeSlotConfig(config);
    } catch (error: any) {
      console.error('Error loading time slot config:', error);
      if (error.response?.status === 401) {
        toast.error('Please log in as a shop owner to manage settings');
      } else {
        toast.error('Failed to load time slot configuration');
      }
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

  const handleSaveTimeSlotConfig = async () => {
    if (!timeSlotConfig) return;

    try {
      setSaving(true);
      await appointmentsApi.updateTimeSlotConfig({
        bufferTimeMinutes: timeSlotConfig.bufferTimeMinutes,
        maxConcurrentBookings: timeSlotConfig.maxConcurrentBookings,
        bookingAdvanceDays: timeSlotConfig.bookingAdvanceDays,
        minBookingHours: timeSlotConfig.minBookingHours,
        allowWeekendBooking: timeSlotConfig.allowWeekendBooking
      });
      setConfigSaved(true);
      toast.success('Time slot configuration updated successfully');

      setTimeout(() => setConfigSaved(false), 2000);
      loadTimeSlotConfig();
    } catch (error) {
      console.error('Error updating time slot config:', error);
      toast.error('Failed to update time slot configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateAvailability = async (dayOfWeek: number, data: Partial<ShopAvailability>) => {
    try {
      setSaving(true);
      await appointmentsApi.updateShopAvailability({
        dayOfWeek,
        isOpen: data.isOpen ?? true,
        openTime: data.openTime || undefined,
        closeTime: data.closeTime || undefined,
        breakStartTime: data.breakStartTime || undefined,
        breakEndTime: data.breakEndTime || undefined
      });

      await loadShopAvailability();
      setEditingDay(null);
      toast.success('Operating hours updated successfully');
    } catch (error) {
      console.error('Error updating availability:', error);
      toast.error('Failed to update operating hours');
    } finally {
      setSaving(false);
    }
  };

  const getAvailabilityForDay = (dayOfWeek: number): ShopAvailability | undefined => {
    return shopAvailability.find(a => a.dayOfWeek === dayOfWeek);
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

      {/* Time Slot Configuration */}
      {timeSlotConfig && (
        <div className="bg-[#1A1A1A] border border-gray-800 rounded-2xl p-6">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <Settings className="w-6 h-6 text-[#FFCC00]" />
            Time Slot Configuration
          </h2>

          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-blue-400 mt-0.5" />
              <div className="text-sm text-gray-300">
                <p className="font-semibold text-white mb-1">Booking Settings</p>
                <p>Configure how customers can book appointments. Buffer time is added between appointments to allow for preparation and cleanup.</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Buffer Time */}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Buffer Time (minutes)
              </label>
              <input
                type="number"
                value={timeSlotConfig.bufferTimeMinutes}
                onChange={(e) => setTimeSlotConfig({ ...timeSlotConfig, bufferTimeMinutes: parseInt(e.target.value) || 0 })}
                min={0}
                step={5}
                className="w-full px-4 py-3 bg-[#0D0D0D] border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-[#FFCC00] focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-2">
                Time added between appointments (e.g., 0, 5, 10, 15 minutes)
              </p>
            </div>

            {/* Max Concurrent Bookings */}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Max Concurrent Bookings
              </label>
              <input
                type="number"
                value={timeSlotConfig.maxConcurrentBookings}
                onChange={(e) => setTimeSlotConfig({ ...timeSlotConfig, maxConcurrentBookings: parseInt(e.target.value) || 1 })}
                min={1}
                max={10}
                className="w-full px-4 py-3 bg-[#0D0D0D] border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-[#FFCC00] focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-2">
                How many appointments can overlap at the same time
              </p>
            </div>

            {/* Booking Advance Days */}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Booking Advance (days)
              </label>
              <input
                type="number"
                value={timeSlotConfig.bookingAdvanceDays}
                onChange={(e) => setTimeSlotConfig({ ...timeSlotConfig, bookingAdvanceDays: parseInt(e.target.value) || 30 })}
                min={1}
                max={90}
                className="w-full px-4 py-3 bg-[#0D0D0D] border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-[#FFCC00] focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-2">
                How far in advance customers can book (e.g., 30, 60, 90 days)
              </p>
            </div>

            {/* Min Booking Hours */}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Minimum Notice (hours)
              </label>
              <input
                type="number"
                value={timeSlotConfig.minBookingHours}
                onChange={(e) => setTimeSlotConfig({ ...timeSlotConfig, minBookingHours: parseInt(e.target.value) || 2 })}
                min={0}
                max={48}
                className="w-full px-4 py-3 bg-[#0D0D0D] border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-[#FFCC00] focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-2">
                Minimum hours before appointment can be booked (e.g., 2, 4, 24 hours)
              </p>
            </div>
          </div>

          {/* Weekend Booking Toggle */}
          <div className="mt-6">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={timeSlotConfig.allowWeekendBooking}
                onChange={(e) => setTimeSlotConfig({ ...timeSlotConfig, allowWeekendBooking: e.target.checked })}
                className="w-5 h-5 rounded border-gray-600 text-[#FFCC00] focus:ring-[#FFCC00] focus:ring-offset-0 bg-[#1A1A1A]"
              />
              <span className="text-sm text-gray-300">Allow weekend bookings (Saturday & Sunday)</span>
            </label>
          </div>

          {/* Save Button */}
          <div className="mt-6 flex justify-end">
            <button
              onClick={handleSaveTimeSlotConfig}
              disabled={saving}
              className="px-6 py-3 bg-[#FFCC00] text-black rounded-lg font-semibold hover:bg-[#FFD700] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {saving ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Saving...
                </>
              ) : configSaved ? (
                <>
                  <Check className="w-5 h-5" />
                  Saved!
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Save Configuration
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Shop-Wide Availability (Editable) */}
      <div className="bg-[#1A1A1A] border border-gray-800 rounded-2xl p-6">
        <h2 className="text-xl font-bold text-white mb-4">Shop Operating Hours</h2>

        <div className="bg-[#FFCC00]/10 border border-[#FFCC00]/30 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-[#FFCC00] mt-0.5" />
            <div className="text-sm text-gray-300">
              <p className="font-semibold text-white mb-1">Shop-Wide Hours</p>
              <p>These are your shop's overall operating hours. All services will follow these hours. Changes here affect all your services.</p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {DAYS_OF_WEEK.map(day => {
            const dayAvail = getAvailabilityForDay(day.value);
            const isEditing = editingDay === day.value;
            const isOpen = dayAvail?.isOpen ?? true;

            return (
              <div key={day.value} className="bg-[#0D0D0D] border border-gray-800 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-white font-semibold w-24">{day.label}</span>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isOpen}
                        onChange={(e) => handleUpdateAvailability(day.value, { isOpen: e.target.checked })}
                        disabled={saving}
                        className="w-4 h-4 rounded border-gray-600 text-[#FFCC00] focus:ring-[#FFCC00] focus:ring-offset-0 bg-[#1A1A1A]"
                      />
                      <span className="text-sm text-gray-400">Open</span>
                    </label>
                  </div>
                  {isOpen && (
                    <button
                      onClick={() => {
                        if (isEditing) {
                          setEditingDay(null);
                        } else {
                          setEditingDay(day.value);
                          setEditingValues({
                            openTime: dayAvail?.openTime || '09:00',
                            closeTime: dayAvail?.closeTime || '18:00',
                            breakStartTime: dayAvail?.breakStartTime || '',
                            breakEndTime: dayAvail?.breakEndTime || ''
                          });
                        }
                      }}
                      disabled={saving}
                      className="text-sm text-[#FFCC00] hover:text-[#FFD700] transition-colors disabled:opacity-50"
                    >
                      {isEditing ? 'Cancel' : 'Edit'}
                    </button>
                  )}
                </div>

                {isOpen && (
                  <>
                    {isEditing ? (
                      <div className="space-y-4">
                        {/* Operating Hours */}
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs text-gray-400 mb-1">Open Time</label>
                            <input
                              type="time"
                              value={editingValues.openTime}
                              onChange={(e) => setEditingValues({ ...editingValues, openTime: e.target.value })}
                              className="w-full px-3 py-2 bg-[#1A1A1A] border border-gray-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-[#FFCC00] focus:border-transparent"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-400 mb-1">Close Time</label>
                            <input
                              type="time"
                              value={editingValues.closeTime}
                              onChange={(e) => setEditingValues({ ...editingValues, closeTime: e.target.value })}
                              className="w-full px-3 py-2 bg-[#1A1A1A] border border-gray-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-[#FFCC00] focus:border-transparent"
                            />
                          </div>
                        </div>

                        {/* Break Times */}
                        <div>
                          <label className="block text-xs text-gray-400 mb-2">Break Time (Optional)</label>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <input
                                type="time"
                                value={editingValues.breakStartTime}
                                onChange={(e) => setEditingValues({ ...editingValues, breakStartTime: e.target.value })}
                                placeholder="Start"
                                className="w-full px-3 py-2 bg-[#1A1A1A] border border-gray-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-[#FFCC00] focus:border-transparent"
                              />
                            </div>
                            <div>
                              <input
                                type="time"
                                value={editingValues.breakEndTime}
                                onChange={(e) => setEditingValues({ ...editingValues, breakEndTime: e.target.value })}
                                placeholder="End"
                                className="w-full px-3 py-2 bg-[#1A1A1A] border border-gray-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-[#FFCC00] focus:border-transparent"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Save Button */}
                        <div className="flex justify-end">
                          <button
                            onClick={() => handleUpdateAvailability(day.value, {
                              isOpen: true,
                              openTime: editingValues.openTime,
                              closeTime: editingValues.closeTime,
                              breakStartTime: editingValues.breakStartTime || undefined,
                              breakEndTime: editingValues.breakEndTime || undefined
                            })}
                            disabled={saving}
                            className="px-4 py-2 bg-[#FFCC00] text-black rounded-lg font-semibold hover:bg-[#FFD700] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                          >
                            {saving ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Saving...
                              </>
                            ) : (
                              <>
                                <Save className="w-4 h-4" />
                                Save Changes
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    ) : (
                      dayAvail && dayAvail.openTime && dayAvail.closeTime && (
                        <div className="text-sm text-gray-400">
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-gray-500" />
                            <span>{dayAvail.openTime} - {dayAvail.closeTime}</span>
                          </div>
                          {dayAvail.breakStartTime && dayAvail.breakEndTime && (
                            <div className="flex items-center gap-2 mt-1 ml-6 text-xs">
                              <span className="text-gray-500">Break:</span>
                              <span>{dayAvail.breakStartTime} - {dayAvail.breakEndTime}</span>
                            </div>
                          )}
                        </div>
                      )
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
