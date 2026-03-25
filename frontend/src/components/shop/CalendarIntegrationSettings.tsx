'use client';

import { useState, useEffect } from 'react';
import { calendarApi } from '@/services/api/calendar';
import toast from 'react-hot-toast';
import { Calendar, CheckCircle, X, AlertCircle } from 'lucide-react';

interface ConnectionStatus {
  connected: boolean;
  provider: string | null;
  email: string | null;
  lastSync: string | null;
  syncStatus: string | null;
  syncError: string | null;
  calendarId: string | null;
}

export default function CalendarIntegrationSettings() {
  const [status, setStatus] = useState<ConnectionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    loadConnectionStatus();
  }, []);

  const loadConnectionStatus = async () => {
    try {
      setLoading(true);
      const data = await calendarApi.getConnectionStatus();
      setStatus(data.data);
    } catch (error) {
      console.error('Failed to load calendar status:', error);
      toast.error('Failed to load calendar connection status');
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    try {
      setConnecting(true);
      // calendarApi already returns response.data, so 'data' is the backend response
      const data = await calendarApi.connectGoogle();

      if (data.success && data.data?.authUrl) {
        // Redirect to Google OAuth
        window.location.href = data.data.authUrl;
      } else {
        throw new Error('Failed to get authorization URL');
      }
    } catch (error) {
      console.error('Failed to initiate connection:', error);
      toast.error('Failed to connect Google Calendar');
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect your Google Calendar? Future appointments will not be synced.')) {
      return;
    }

    try {
      await calendarApi.disconnect('google');
      toast.success('Google Calendar disconnected successfully');
      await loadConnectionStatus();
    } catch (error) {
      console.error('Failed to disconnect:', error);
      toast.error('Failed to disconnect calendar');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-400"></div>
      </div>
    );
  }

  return (
    <div className="bg-[#0D0D0D] border border-gray-800 rounded-xl p-6">
      <h2 className="text-2xl font-bold text-white mb-6">Calendar Integration</h2>

      {status?.connected ? (
        // Connected State
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-green-900/20 border border-green-500 rounded-lg">
            <div className="flex items-center space-x-3">
              <svg className="w-6 h-6 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <div>
                <p className="text-white font-medium">Google Calendar Connected</p>
                <p className="text-gray-400 text-sm">{status.email}</p>
              </div>
            </div>
          </div>

          {/* Last Sync Status */}
          {status.lastSync && (
            <div className="p-4 bg-gray-800 rounded-lg">
              <p className="text-sm text-gray-400">Last Sync</p>
              <p className="text-white">
                {new Date(status.lastSync).toLocaleString()}
              </p>
              <p className={`text-sm mt-1 ${
                status.syncStatus === 'success' ? 'text-green-500' : 'text-red-500'
              }`}>
                Status: {status.syncStatus}
              </p>
              {status.syncError && (
                <p className="text-sm text-red-400 mt-1">{status.syncError}</p>
              )}
            </div>
          )}

          {/* Info Box */}
          <div className="p-4 bg-blue-900/20 border border-blue-500 rounded-lg">
            <p className="text-blue-400 text-sm">
              ✓ New appointments are automatically added to your Google Calendar
              <br />
              ✓ Rescheduled appointments update your calendar
              <br />
              ✓ Cancelled appointments are removed from your calendar
            </p>
          </div>

          {/* Disconnect Button */}
          <button
            onClick={handleDisconnect}
            className="w-full py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
          >
            Disconnect Google Calendar
          </button>
        </div>
      ) : (
        // Disconnected State
        <div className="space-y-4">
          <div className="p-4 bg-gray-800 rounded-lg">
            <h3 className="text-white font-medium mb-2">Why Connect Google Calendar?</h3>
            <ul className="space-y-2 text-gray-300 text-sm">
              <li className="flex items-start">
                <span className="text-yellow-400 mr-2">•</span>
                Automatically sync appointment bookings
              </li>
              <li className="flex items-start">
                <span className="text-yellow-400 mr-2">•</span>
                Get mobile notifications for upcoming appointments
              </li>
              <li className="flex items-start">
                <span className="text-yellow-400 mr-2">•</span>
                View appointments across all your devices
              </li>
              <li className="flex items-start">
                <span className="text-yellow-400 mr-2">•</span>
                Never miss an appointment with Google Calendar reminders
              </li>
            </ul>
          </div>

          <button
            onClick={handleConnect}
            disabled={connecting}
            className="w-full py-3 bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
          >
            {connecting ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-900"></div>
                <span>Connecting...</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19.5 3.09L15 5.92V7h5a1 1 0 011 1v10a1 1 0 01-1 1H4a1 1 0 01-1-1V8a1 1 0 011-1h5V5.92L4.5 3.09A.5.5 0 014 3V2a.5.5 0 01.5-.5h15a.5.5 0 01.5.5v1a.5.5 0 01-.5.5zM7 9H5v2h2V9zm10 0h2v2h-2V9zm-5 0h2v2h-2V9zM7 13H5v2h2v-2zm10 0h2v2h-2v-2zm-5 0h2v2h-2v-2z"/>
                </svg>
                <span>Connect Google Calendar</span>
              </>
            )}
          </button>

          <p className="text-gray-400 text-xs text-center">
            You'll be redirected to Google to authorize RepairCoin
          </p>
        </div>
      )}
    </div>
  );
}
