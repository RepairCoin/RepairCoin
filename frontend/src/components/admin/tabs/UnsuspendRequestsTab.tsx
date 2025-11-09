import { useState, useEffect } from 'react';

interface UnsuspendRequest {
  id: string;
  entityType: 'customer' | 'shop';
  entityId: string;
  entityDetails?: {
    name?: string;
    address?: string;
    shopId?: string;
    email?: string;
  };
  requestReason: string;
  createdAt: string;
  status: 'pending' | 'approved' | 'rejected';
}

interface UnsuspendRequestsTabProps {
  generateAdminToken: () => Promise<string | null>;
  onError: (error: string) => void;
}

export function UnsuspendRequestsTab({ generateAdminToken, onError }: UnsuspendRequestsTabProps) {
  const [requests, setRequests] = useState<UnsuspendRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<UnsuspendRequest | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [actionType, setActionType] = useState<'approve' | 'reject'>('approve');

  useEffect(() => {
    fetchUnsuspendRequests();
  }, []);

  const fetchUnsuspendRequests = async () => {
    setLoading(true);
    
    try {
      const adminToken = await generateAdminToken();
      if (!adminToken) {
        onError('Failed to authenticate as admin');
        return;
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/unsuspend-requests?status=pending`, {
        headers: {
          'Authorization': `Bearer ${adminToken}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch unsuspend requests');
      }

      const data = await response.json();
      setRequests(data.data?.requests || []);
    } catch (err) {
      onError('Failed to load unsuspend requests');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleReview = (request: UnsuspendRequest, type: 'approve' | 'reject') => {
    setSelectedRequest(request);
    setActionType(type);
    setReviewNotes('');
    setShowReviewModal(true);
  };

  const processRequest = async () => {
    if (!selectedRequest) return;

    try {
      const adminToken = await generateAdminToken();
      if (!adminToken) {
        onError('Failed to authenticate as admin');
        return;
      }

      const endpoint = actionType === 'approve' 
        ? `/admin/unsuspend-requests/${selectedRequest.id}/approve`
        : `/admin/unsuspend-requests/${selectedRequest.id}/reject`;

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({ notes: reviewNotes })
      });

      if (!response.ok) {
        throw new Error(`Failed to ${actionType} request`);
      }

      setShowReviewModal(false);
      setSelectedRequest(null);
      fetchUnsuspendRequests();
      alert(`Request ${actionType}d successfully`);
    } catch (err) {
      onError(`Failed to ${actionType} request`);
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          <p className="mt-4 text-gray-600">Loading unsuspend requests...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-gray-100">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-2xl font-bold text-gray-900">Unsuspend Requests</h2>
        <p className="text-gray-600 mt-1">Review and manage customer/shop unsuspension requests</p>
      </div>

      {requests.length === 0 ? (
        <div className="p-8 text-center text-gray-500">
          No pending unsuspend requests
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Entity Details
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Request Reason
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Submitted
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {requests.map((request) => (
                <tr key={request.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      request.entityType === 'customer' 
                        ? 'bg-blue-100 text-blue-800' 
                        : 'bg-purple-100 text-purple-800'
                    }`}>
                      {request.entityType}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {request.entityDetails ? (
                        <>
                          <div className="font-medium">{request.entityDetails.name || 'N/A'}</div>
                          <div className="text-gray-500">
                            {request.entityType === 'customer' 
                              ? request.entityDetails.address 
                              : request.entityDetails.shopId}
                          </div>
                          {request.entityDetails.email && (
                            <div className="text-gray-500">{request.entityDetails.email}</div>
                          )}
                        </>
                      ) : (
                        <div className="text-gray-500">No details available</div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900 max-w-xs">
                      {request.requestReason}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(request.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={() => handleReview(request, 'approve')}
                      className="text-green-600 hover:text-green-900 mr-4"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleReview(request, 'reject')}
                      className="text-red-600 hover:text-red-900"
                    >
                      Reject
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Review Modal */}
      {showReviewModal && selectedRequest && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <h3 className="text-lg font-bold text-gray-900 mb-4">
              {actionType === 'approve' ? 'Approve' : 'Reject'} Unsuspend Request
            </h3>
            
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">
                {selectedRequest.entityType === 'customer' ? 'Customer' : 'Shop'}: 
                {selectedRequest.entityDetails?.name || selectedRequest.entityId}
              </p>
              <p className="text-sm text-gray-600">
                Reason: {selectedRequest.requestReason}
              </p>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Review Notes (optional)
              </label>
              <textarea
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                rows={3}
                placeholder="Add any notes about this decision..."
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowReviewModal(false)}
                className="px-4 py-2 bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400"
              >
                Cancel
              </button>
              <button
                onClick={processRequest}
                className={`px-4 py-2 rounded-md text-white ${
                  actionType === 'approve' 
                    ? 'bg-green-600 hover:bg-green-700' 
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {actionType === 'approve' ? 'Approve' : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}