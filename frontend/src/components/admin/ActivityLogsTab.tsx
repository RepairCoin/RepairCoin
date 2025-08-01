import { useState, useEffect } from 'react';

interface ActivityLog {
  id: string | number;
  timestamp?: string;
  createdAt?: string;
  adminAddress?: string;
  action: string;
  details?: string;
  description?: string;
  status?: 'success' | 'failed' | 'completed';
}

interface ActivityLogsTabProps {
  generateAdminToken: () => Promise<string | null>;
  onError: (error: string) => void;
}

export function ActivityLogsTab({ generateAdminToken, onError }: ActivityLogsTabProps) {
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadActivityLogs();
  }, []);

  const loadActivityLogs = async () => {
    try {
      setLoading(true);
      const adminToken = await generateAdminToken();
      if (!adminToken) {
        onError('Authentication required');
        return;
      }

      const headers = {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      };

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/analytics/activity-logs?limit=50`, { headers });
      
      if (response.ok) {
        const data = await response.json();
        setActivityLogs(data.data?.logs || data.logs || []);
      } else {
        console.warn('Activity logs API failed:', await response.text());
        setActivityLogs([]);
      }
    } catch (error) {
      console.error('Error loading activity logs:', error);
      onError('Failed to load activity logs');
      setActivityLogs([]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          <p className="mt-4 text-gray-600">Loading activity logs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-gray-100">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-2xl font-bold text-gray-900">Activity Logs</h2>
        <p className="text-gray-600 mt-1">Track admin actions and system events</p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Timestamp</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Admin</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Details</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {activityLogs.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                  <div className="text-4xl mb-2">📋</div>
                  <p>No activity logs available</p>
                </td>
              </tr>
            ) : (
              activityLogs.map((log, index) => (
                <tr key={log.id || index}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {new Date(log.timestamp || log.createdAt || Date.now()).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 font-mono">
                      {log.adminAddress ? `${log.adminAddress.slice(0, 6)}...${log.adminAddress.slice(-4)}` : 'System'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                      {log.action}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900 max-w-md truncate">
                    {log.details || log.description || 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      log.status === 'success' 
                        ? 'bg-green-100 text-green-800' 
                        : log.status === 'failed'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {log.status || 'completed'}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}