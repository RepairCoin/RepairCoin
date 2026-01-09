'use client';

/**
 * Token Debug Panel
 *
 * Add this component temporarily to any page to visualize token refresh behavior.
 *
 * Usage: Import and add <TokenDebugPanel /> to any page
 *
 * Remove after testing!
 */

import React, { useState, useEffect } from 'react';

export const TokenDebugPanel: React.FC = () => {
  const [events, setEvents] = useState<Array<{ time: string; type: string; message: string }>>([]);
  const [isMinimized, setIsMinimized] = useState(false);
  const [secondsSinceLogin, setSecondsSinceLogin] = useState(0);

  useEffect(() => {
    // Timer to track seconds since component mounted (simulating login)
    const timer = setInterval(() => {
      setSecondsSinceLogin(prev => prev + 1);
    }, 1000);

    // Listen for token refresh events
    const handleTokenRefresh = (e: CustomEvent) => {
      const newEvent = {
        time: new Date().toLocaleTimeString(),
        type: e.detail?.type || 'unknown',
        message: e.detail?.type === 'sliding-window'
          ? '🔄 Sliding window refresh - token extended!'
          : '🔑 Token refreshed'
      };
      setEvents(prev => [newEvent, ...prev].slice(0, 20));
    };

    const handleSessionRevoked = (e: CustomEvent) => {
      const newEvent = {
        time: new Date().toLocaleTimeString(),
        type: 'session-revoked',
        message: `❌ Session revoked: ${e.detail?.reason}`
      };
      setEvents(prev => [newEvent, ...prev].slice(0, 20));
    };

    window.addEventListener('auth:token-refreshed', handleTokenRefresh as EventListener);
    window.addEventListener('auth:session-revoked', handleSessionRevoked as EventListener);

    // Log initial mount
    setEvents([{
      time: new Date().toLocaleTimeString(),
      type: 'init',
      message: '🚀 Debug panel mounted - watching for token events'
    }]);

    return () => {
      clearInterval(timer);
      window.removeEventListener('auth:token-refreshed', handleTokenRefresh as EventListener);
      window.removeEventListener('auth:session-revoked', handleSessionRevoked as EventListener);
    };
  }, []);

  // Add event when timer reaches certain thresholds
  useEffect(() => {
    if (secondsSinceLogin === 60) {
      setEvents(prev => [{
        time: new Date().toLocaleTimeString(),
        type: 'info',
        message: '⏰ 1 minute elapsed - if threshold is 1m, next request should trigger refresh'
      }, ...prev].slice(0, 20));
    }
    if (secondsSinceLogin === 120) {
      setEvents(prev => [{
        time: new Date().toLocaleTimeString(),
        type: 'warning',
        message: '⚠️ 2 minutes elapsed - if token is 2m, it should be expired now'
      }, ...prev].slice(0, 20));
    }
  }, [secondsSinceLogin]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const triggerTestRequest = async () => {
    setEvents(prev => [{
      time: new Date().toLocaleTimeString(),
      type: 'test',
      message: '🧪 Triggering test API request...'
    }, ...prev].slice(0, 20));

    try {
      // Use XMLHttpRequest to access response headers (fetch doesn't expose custom headers easily)
      const xhr = new XMLHttpRequest();
      xhr.open('GET', `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api'}/auth/session`, false);
      xhr.withCredentials = true;
      xhr.send();

      const refreshed = xhr.getResponseHeader('x-token-refreshed');
      const status = xhr.status;

      console.log('🧪 Test request response:', {
        status,
        refreshed,
        allHeaders: xhr.getAllResponseHeaders()
      });

      if (refreshed === 'true') {
        setEvents(prev => [{
          time: new Date().toLocaleTimeString(),
          type: 'sliding-window',
          message: '🔄 SLIDING WINDOW TRIGGERED! Token refreshed!'
        }, ...prev].slice(0, 20));
      }

      setEvents(prev => [{
        time: new Date().toLocaleTimeString(),
        type: status >= 200 && status < 300 ? 'success' : 'error',
        message: status >= 200 && status < 300
          ? `✅ Request OK (${status})${refreshed === 'true' ? ' 🔄 REFRESHED!' : ''}`
          : `❌ Request failed (${status})`
      }, ...prev].slice(0, 20));
    } catch (err) {
      console.error('Test request error:', err);
      setEvents(prev => [{
        time: new Date().toLocaleTimeString(),
        type: 'error',
        message: `❌ Request error: ${err}`
      }, ...prev].slice(0, 20));
    }
  };

  if (isMinimized) {
    return (
      <button
        onClick={() => setIsMinimized(false)}
        className="fixed bottom-4 right-4 z-[9999] bg-yellow-500 text-black px-3 py-2 rounded-lg shadow-lg font-mono text-sm"
      >
        🔧 Debug ({formatTime(secondsSinceLogin)})
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-[9999] w-96 bg-gray-900 border border-yellow-500 rounded-lg shadow-2xl font-mono text-xs">
      {/* Header */}
      <div className="flex items-center justify-between bg-yellow-500 text-black px-3 py-2 rounded-t-lg">
        <span className="font-bold">🔧 Token Debug Panel</span>
        <div className="flex items-center gap-2">
          <span className="bg-black text-yellow-500 px-2 py-0.5 rounded">
            {formatTime(secondsSinceLogin)}
          </span>
          <button onClick={() => setIsMinimized(true)} className="hover:bg-yellow-600 px-2 rounded">
            _
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="p-2 border-b border-gray-700 flex gap-2">
        <button
          onClick={triggerTestRequest}
          className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-xs"
        >
          🧪 Test Request
        </button>
        <button
          onClick={() => setEvents([])}
          className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-1 rounded text-xs"
        >
          Clear
        </button>
      </div>

      {/* Info */}
      <div className="p-2 bg-gray-800 text-gray-300 text-xs">
        <div>Token expiry: <span className="text-yellow-400">2m</span> (test mode)</div>
        <div>Refresh threshold: <span className="text-yellow-400">1m</span> (test mode)</div>
        <div>Watch for: <span className="text-green-400">🔄 Sliding window</span> or <span className="text-blue-400">🔑 Token refresh</span></div>
      </div>

      {/* Event Log */}
      <div className="max-h-48 overflow-y-auto p-2 space-y-1">
        {events.length === 0 ? (
          <div className="text-gray-500 text-center py-4">No events yet...</div>
        ) : (
          events.map((event, i) => (
            <div
              key={i}
              className={`p-1.5 rounded text-xs ${
                event.type === 'success' || event.type === 'sliding-window'
                  ? 'bg-green-900/50 text-green-300'
                  : event.type === 'error' || event.type === 'session-revoked'
                  ? 'bg-red-900/50 text-red-300'
                  : event.type === 'warning'
                  ? 'bg-yellow-900/50 text-yellow-300'
                  : 'bg-gray-800 text-gray-300'
              }`}
            >
              <span className="text-gray-500">[{event.time}]</span> {event.message}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default TokenDebugPanel;
