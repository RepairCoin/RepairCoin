// frontend/src/components/shop/AvailabilitySettings.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { Clock, Calendar, Settings, Plus, Trash2, Loader2, Save, Check, AlertCircle } from 'lucide-react';
import { appointmentsApi, ShopAvailability, TimeSlotConfig, DateOverride } from '@/services/api/appointments';
import { toast } from 'react-hot-toast';

type TabType = 'hours' | 'settings' | 'overrides';

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' }
];

interface AvailabilitySettingsProps {
  shopId?: string;
}

export const AvailabilitySettings: React.FC<AvailabilitySettingsProps> = ({ shopId }) => {
  const [activeTab, setActiveTab] = useState<TabType>('hours');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Operating Hours State
  const [availability, setAvailability] = useState<ShopAvailability[]>([]);
  const [editingDay, setEditingDay] = useState<number | null>(null);

  // Booking Settings State
  const [config, setConfig] = useState<TimeSlotConfig | null>(null);
  const [configEditing, setConfigEditing] = useState(false);

  // Date Overrides State
  const [overrides, setOverrides] = useState<DateOverride[]>([]);
  const [newOverride, setNewOverride] = useState({
    overrideDate: '',
    isClosed: true,
    customOpenTime: '',
    customCloseTime: '',
    reason: ''
  });

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    if (!shopId) {
      console.error('No shopId provided to AvailabilitySettings');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const [availData, configData, overridesData] = await Promise.all([
        appointmentsApi.getShopAvailability(shopId),
        appointmentsApi.getTimeSlotConfig(),
        appointmentsApi.getDateOverrides()
      ]);
      setAvailability(availData);
      setConfig(configData);
      setOverrides(overridesData);
    } catch (error) {
      console.error('Error loading availability data:', error);
      toast.error('Failed to load availability settings');
    } finally {
      setLoading(false);
    }
  };

  // ==================== OPERATING HOURS HANDLERS ====================

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

      await loadAllData();
      setEditingDay(null);
      toast.success('Operating hours updated successfully');
    } catch (error: unknown) {
      console.error('Error updating availability:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Failed to update operating hours: ${errorMessage}`);
    } finally {
      setSaving(false);
    }
  };

  const getAvailabilityForDay = (dayOfWeek: number): ShopAvailability | undefined => {
    return availability.find(a => a.dayOfWeek === dayOfWeek);
  };

  // ==================== BOOKING SETTINGS HANDLERS ====================

  const handleUpdateConfig = async () => {
    if (!config) return;

    try {
      setSaving(true);
      await appointmentsApi.updateTimeSlotConfig({
        slotDurationMinutes: config.slotDurationMinutes,
        bufferTimeMinutes: config.bufferTimeMinutes,
        maxConcurrentBookings: config.maxConcurrentBookings,
        bookingAdvanceDays: config.bookingAdvanceDays,
        minBookingHours: config.minBookingHours,
        allowWeekendBooking: config.allowWeekendBooking
      });

      await loadAllData();
      setConfigEditing(false);
      toast.success('Booking settings updated successfully');
    } catch (error) {
      console.error('Error updating config:', error);
      toast.error('Failed to update booking settings');
    } finally {
      setSaving(false);
    }
  };

  // ==================== DATE OVERRIDES HANDLERS ====================

  const handleCreateOverride = async () => {
    if (!newOverride.overrideDate) {
      toast.error('Please select a date');
      return;
    }

    try {
      setSaving(true);
      await appointmentsApi.createDateOverride({
        overrideDate: newOverride.overrideDate,
        isClosed: newOverride.isClosed,
        customOpenTime: newOverride.customOpenTime || undefined,
        customCloseTime: newOverride.customCloseTime || undefined,
        reason: newOverride.reason || undefined
      });

      await loadAllData();
      setNewOverride({
        overrideDate: '',
        isClosed: true,
        customOpenTime: '',
        customCloseTime: '',
        reason: ''
      });
      toast.success('Date override added successfully');
    } catch (error) {
      console.error('Error creating override:', error);
      toast.error('Failed to create date override');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteOverride = async (date: string) => {
    if (!confirm('Are you sure you want to delete this date override?')) return;

    try {
      setSaving(true);
      await appointmentsApi.deleteDateOverride(date);
      await loadAllData();
      toast.success('Date override deleted successfully');
    } catch (error) {
      console.error('Error deleting override:', error);
      toast.error('Failed to delete date override');
    } finally {
      setSaving(false);
    }
  };

  // ==================== RENDER TABS ====================

  const renderOperatingHours = () => (
    <div className="space-y-4">
      <div className="bg-[#FFCC00]/10 border border-[#FFCC00]/30 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-[#FFCC00] mt-0.5" />
          <div className="text-sm text-gray-300">
            <p className="font-semibold text-white mb-1">Set your operating hours</p>
            <p>Configure when customers can book appointments. Break times help you schedule lunch or other breaks.</p>
          </div>
        </div>
      </div>

      {DAYS_OF_WEEK.map(day => {
        const dayAvailability = getAvailabilityForDay(day.value);
        const isEditing = editingDay === day.value;
        const isOpen = dayAvailability?.isOpen ?? true;

        // Check if this is a weekend day that's blocked by the master switch
        const isWeekend = day.value === 0 || day.value === 6;
        const weekendBlocked = isWeekend && !config?.allowWeekendBooking;

        return (
          <div key={day.value} className={`bg-[#1A1A1A] border border-gray-800 rounded-lg p-4 ${weekendBlocked ? 'opacity-60' : ''}`}>
            {/* Warning banner if weekend is blocked by master switch */}
            {weekendBlocked && isOpen && (
              <div className="mb-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-2 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-yellow-400 flex-shrink-0" />
                <span className="text-xs text-yellow-400">
                  Weekend bookings disabled. Enable &quot;Allow weekend bookings&quot; in Booking Settings to accept appointments.
                </span>
              </div>
            )}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <span className="text-white font-semibold w-24">{day.label}</span>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isOpen}
                    onChange={(e) => {
                      // Preserve existing time values when toggling the checkbox
                      const existingData = dayAvailability || {};
                      handleUpdateAvailability(day.value, {
                        ...existingData,
                        isOpen: e.target.checked
                      });
                    }}
                    className="w-4 h-4 text-[#FFCC00] bg-[#0D0D0D] border-gray-700 rounded focus:ring-[#FFCC00]"
                  />
                  <span className="text-sm text-gray-400">Open</span>
                </label>
              </div>
              {isOpen && (
                <button
                  onClick={() => setEditingDay(isEditing ? null : day.value)}
                  className="text-sm text-[#FFCC00] hover:text-[#FFD700] transition-colors"
                >
                  {isEditing ? 'Cancel' : 'Edit'}
                </button>
              )}
            </div>

            {isOpen && dayAvailability && (
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <label className="block text-gray-400 mb-1">Open Time</label>
                  {isEditing ? (
                    <input
                      type="time"
                      value={dayAvailability.openTime || ''}
                      onChange={(e) => {
                        const updated = availability.map(a =>
                          a.dayOfWeek === day.value ? { ...a, openTime: e.target.value } : a
                        );
                        setAvailability(updated);
                      }}
                      className="w-full px-3 py-2 bg-[#0D0D0D] border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-[#FFCC00]"
                    />
                  ) : (
                    <p className="text-white">{dayAvailability.openTime || 'Not set'}</p>
                  )}
                </div>
                <div>
                  <label className="block text-gray-400 mb-1">Close Time</label>
                  {isEditing ? (
                    <input
                      type="time"
                      value={dayAvailability.closeTime || ''}
                      onChange={(e) => {
                        const updated = availability.map(a =>
                          a.dayOfWeek === day.value ? { ...a, closeTime: e.target.value } : a
                        );
                        setAvailability(updated);
                      }}
                      className="w-full px-3 py-2 bg-[#0D0D0D] border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-[#FFCC00]"
                    />
                  ) : (
                    <p className="text-white">{dayAvailability.closeTime || 'Not set'}</p>
                  )}
                </div>
                <div>
                  <label className="block text-gray-400 mb-1">Break Start</label>
                  {isEditing ? (
                    <input
                      type="time"
                      value={dayAvailability.breakStartTime || ''}
                      onChange={(e) => {
                        const updated = availability.map(a =>
                          a.dayOfWeek === day.value ? { ...a, breakStartTime: e.target.value } : a
                        );
                        setAvailability(updated);
                      }}
                      className="w-full px-3 py-2 bg-[#0D0D0D] border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-[#FFCC00]"
                    />
                  ) : (
                    <p className="text-white">{dayAvailability.breakStartTime || 'No break'}</p>
                  )}
                </div>
                <div>
                  <label className="block text-gray-400 mb-1">Break End</label>
                  {isEditing ? (
                    <input
                      type="time"
                      value={dayAvailability.breakEndTime || ''}
                      onChange={(e) => {
                        const updated = availability.map(a =>
                          a.dayOfWeek === day.value ? { ...a, breakEndTime: e.target.value } : a
                        );
                        setAvailability(updated);
                      }}
                      className="w-full px-3 py-2 bg-[#0D0D0D] border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-[#FFCC00]"
                    />
                  ) : (
                    <p className="text-white">{dayAvailability.breakEndTime || 'No break'}</p>
                  )}
                </div>
              </div>
            )}

            {isEditing && (
              <div className="mt-4 flex justify-end">
                <button
                  onClick={() => handleUpdateAvailability(day.value, dayAvailability)}
                  disabled={saving}
                  className="px-4 py-2 bg-[#FFCC00] text-black rounded-lg font-semibold hover:bg-[#FFD700] transition-colors disabled:opacity-50 flex items-center gap-2"
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
            )}
          </div>
        );
      })}
    </div>
  );

  const renderBookingSettings = () => {
    if (!config) {
      return (
        <div className="text-center py-12 text-gray-400">
          <Settings className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No booking configuration found</p>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div className="bg-[#FFCC00]/10 border border-[#FFCC00]/30 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-[#FFCC00] mt-0.5" />
            <div className="text-sm text-gray-300">
              <p className="font-semibold text-white mb-1">Booking configuration</p>
              <p>These settings control how customers book appointments at your shop.</p>
            </div>
          </div>
        </div>

        <div className="bg-[#1A1A1A] border border-gray-800 rounded-lg p-6 space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">Time Slot Settings</h3>
            <button
              onClick={() => configEditing ? handleUpdateConfig() : setConfigEditing(true)}
              disabled={saving}
              className="px-4 py-2 bg-[#FFCC00] text-black rounded-lg font-semibold hover:bg-[#FFD700] transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : configEditing ? (
                <>
                  <Check className="w-4 h-4" />
                  Save Changes
                </>
              ) : (
                'Edit Settings'
              )}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Slot Duration (minutes)
              </label>
              {configEditing ? (
                <input
                  type="number"
                  value={config.slotDurationMinutes}
                  onChange={(e) => {
                    const value = parseInt(e.target.value) || 60;
                    setConfig({ ...config, slotDurationMinutes: Math.max(15, Math.min(480, value)) });
                  }}
                  min={15}
                  max={480}
                  step={15}
                  className="w-full px-4 py-2 bg-[#0D0D0D] border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-[#FFCC00]"
                />
              ) : (
                <p className="text-white text-lg">{config.slotDurationMinutes} minutes</p>
              )}
              <p className="text-xs text-gray-500 mt-1">Default appointment length (15-480 min)</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Buffer Time (minutes)
              </label>
              {configEditing ? (
                <input
                  type="number"
                  value={config.bufferTimeMinutes}
                  onChange={(e) => {
                    const value = parseInt(e.target.value) || 0;
                    setConfig({ ...config, bufferTimeMinutes: Math.max(0, Math.min(120, value)) });
                  }}
                  min={0}
                  max={120}
                  step={5}
                  className="w-full px-4 py-2 bg-[#0D0D0D] border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-[#FFCC00]"
                />
              ) : (
                <p className="text-white text-lg">{config.bufferTimeMinutes} minutes</p>
              )}
              <p className="text-xs text-gray-500 mt-1">Time between appointments (0-120 min)</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Max Concurrent Bookings
              </label>
              {configEditing ? (
                <input
                  type="number"
                  value={config.maxConcurrentBookings}
                  onChange={(e) => {
                    const value = parseInt(e.target.value) || 1;
                    setConfig({ ...config, maxConcurrentBookings: Math.max(1, Math.min(50, value)) });
                  }}
                  min={1}
                  max={50}
                  className="w-full px-4 py-2 bg-[#0D0D0D] border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-[#FFCC00]"
                />
              ) : (
                <p className="text-white text-lg">{config.maxConcurrentBookings} bookings</p>
              )}
              <p className="text-xs text-gray-500 mt-1">Appointments at same time (1-50)</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Booking Advance (days)
              </label>
              {configEditing ? (
                <input
                  type="number"
                  value={config.bookingAdvanceDays}
                  onChange={(e) => {
                    const value = parseInt(e.target.value) || 30;
                    setConfig({ ...config, bookingAdvanceDays: Math.max(1, Math.min(365, value)) });
                  }}
                  min={1}
                  max={365}
                  className="w-full px-4 py-2 bg-[#0D0D0D] border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-[#FFCC00]"
                />
              ) : (
                <p className="text-white text-lg">{config.bookingAdvanceDays} days</p>
              )}
              <p className="text-xs text-gray-500 mt-1">Max days customers can book ahead (1-365)</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Min Booking Notice (hours)
              </label>
              {configEditing ? (
                <input
                  type="number"
                  value={config.minBookingHours}
                  onChange={(e) => {
                    const value = parseInt(e.target.value) || 0;
                    setConfig({ ...config, minBookingHours: Math.max(0, Math.min(168, value)) });
                  }}
                  min={0}
                  max={168}
                  className="w-full px-4 py-2 bg-[#0D0D0D] border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-[#FFCC00]"
                />
              ) : (
                <p className="text-white text-lg">{config.minBookingHours} hours</p>
              )}
              <p className="text-xs text-gray-500 mt-1">Min advance notice required (0-168 hours)</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Weekend Bookings
              </label>
              {configEditing ? (
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.allowWeekendBooking}
                    onChange={(e) => setConfig({ ...config, allowWeekendBooking: e.target.checked })}
                    className="w-5 h-5 text-[#FFCC00] bg-[#0D0D0D] border-gray-700 rounded focus:ring-[#FFCC00]"
                  />
                  <span className="text-white">Allow weekend bookings</span>
                </label>
              ) : (
                <p className="text-white text-lg">
                  {config.allowWeekendBooking ? 'Enabled' : 'Disabled'}
                </p>
              )}
              <p className="text-xs text-gray-500 mt-1">Saturday and Sunday bookings</p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderDateOverrides = () => (
    <div className="space-y-6">
      <div className="bg-[#FFCC00]/10 border border-[#FFCC00]/30 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-[#FFCC00] mt-0.5" />
          <div className="text-sm text-gray-300">
            <p className="font-semibold text-white mb-1">Special dates and closures</p>
            <p>Override regular hours for holidays or special events. You can close completely or set custom hours.</p>
          </div>
        </div>
      </div>

      {/* Add New Override */}
      <div className="bg-[#1A1A1A] border border-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Plus className="w-5 h-5 text-[#FFCC00]" />
          Add Date Override
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Date</label>
            <input
              type="date"
              value={newOverride.overrideDate}
              onChange={(e) => setNewOverride({ ...newOverride, overrideDate: e.target.value })}
              min={new Date().toISOString().split('T')[0]}
              className="w-full px-4 py-2 bg-[#0D0D0D] border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-[#FFCC00]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Reason (optional)</label>
            <input
              type="text"
              value={newOverride.reason}
              onChange={(e) => setNewOverride({ ...newOverride, reason: e.target.value })}
              placeholder="e.g., Christmas Holiday"
              className="w-full px-4 py-2 bg-[#0D0D0D] border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-[#FFCC00]"
            />
          </div>
        </div>

        <div className="mb-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={newOverride.isClosed}
              onChange={(e) => setNewOverride({ ...newOverride, isClosed: e.target.checked })}
              className="w-4 h-4 text-[#FFCC00] bg-[#0D0D0D] border-gray-700 rounded focus:ring-[#FFCC00]"
            />
            <span className="text-white">Closed all day</span>
          </label>
        </div>

        {!newOverride.isClosed && (
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Custom Open Time</label>
              <input
                type="time"
                value={newOverride.customOpenTime}
                onChange={(e) => setNewOverride({ ...newOverride, customOpenTime: e.target.value })}
                className="w-full px-4 py-2 bg-[#0D0D0D] border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-[#FFCC00]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Custom Close Time</label>
              <input
                type="time"
                value={newOverride.customCloseTime}
                onChange={(e) => setNewOverride({ ...newOverride, customCloseTime: e.target.value })}
                className="w-full px-4 py-2 bg-[#0D0D0D] border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-[#FFCC00]"
              />
            </div>
          </div>
        )}

        <button
          onClick={handleCreateOverride}
          disabled={saving || !newOverride.overrideDate}
          className="w-full px-4 py-3 bg-[#FFCC00] text-black rounded-lg font-semibold hover:bg-[#FFD700] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {saving ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Adding...
            </>
          ) : (
            <>
              <Plus className="w-5 h-5" />
              Add Override
            </>
          )}
        </button>
      </div>

      {/* Existing Overrides */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-white">Current Overrides</h3>
        {overrides.length === 0 ? (
          <div className="text-center py-12 bg-[#1A1A1A] border border-gray-800 rounded-lg">
            <Calendar className="w-12 h-12 mx-auto mb-3 text-gray-600" />
            <p className="text-gray-400">No date overrides configured</p>
          </div>
        ) : (
          overrides.map((override) => (
            <div
              key={override.overrideId}
              className="bg-[#1A1A1A] border border-gray-800 rounded-lg p-4 flex items-center justify-between"
            >
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-white font-semibold">
                    {new Date(override.overrideDate).toLocaleDateString('en-US', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </span>
                  {override.isClosed ? (
                    <span className="px-2 py-1 bg-red-500/20 text-red-400 text-xs font-semibold rounded">
                      CLOSED
                    </span>
                  ) : (
                    <span className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs font-semibold rounded">
                      CUSTOM HOURS
                    </span>
                  )}
                </div>
                {override.reason && (
                  <p className="text-sm text-gray-400">{override.reason}</p>
                )}
                {!override.isClosed && (
                  <p className="text-sm text-gray-400 mt-1">
                    {override.customOpenTime} - {override.customCloseTime}
                  </p>
                )}
              </div>
              <button
                onClick={() => handleDeleteOverride(override.overrideDate)}
                disabled={saving}
                className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );

  // ==================== MAIN RENDER ====================

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-[#FFCC00]" />
        <span className="ml-3 text-gray-400">Loading availability settings...</span>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-2">Appointment Scheduling</h1>
        <p className="text-gray-400">Configure your availability and booking settings</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-800">
        <button
          onClick={() => setActiveTab('hours')}
          className={`px-4 py-3 font-semibold transition-colors relative ${
            activeTab === 'hours'
              ? 'text-[#FFCC00]'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Operating Hours
          </div>
          {activeTab === 'hours' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#FFCC00]" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`px-4 py-3 font-semibold transition-colors relative ${
            activeTab === 'settings'
              ? 'text-[#FFCC00]'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Booking Settings
          </div>
          {activeTab === 'settings' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#FFCC00]" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('overrides')}
          className={`px-4 py-3 font-semibold transition-colors relative ${
            activeTab === 'overrides'
              ? 'text-[#FFCC00]'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Date Overrides
          </div>
          {activeTab === 'overrides' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#FFCC00]" />
          )}
        </button>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'hours' && renderOperatingHours()}
        {activeTab === 'settings' && renderBookingSettings()}
        {activeTab === 'overrides' && renderDateOverrides()}
      </div>
    </div>
  );
};
