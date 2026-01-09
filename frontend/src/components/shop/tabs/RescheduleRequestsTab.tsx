// frontend/src/components/shop/tabs/RescheduleRequestsTab.tsx
'use client';

import React, { useState, useEffect } from 'react';
import {
  RefreshCw,
  Calendar,
  Clock,
  User,
  CheckCircle,
  XCircle,
  Loader2,
  AlertCircle,
  Filter,
  ChevronRight,
  MessageSquare
} from 'lucide-react';
import { appointmentsApi, RescheduleRequestWithDetails } from '@/services/api/appointments';
import { toast } from 'react-hot-toast';

type FilterStatus = 'pending' | 'approved' | 'rejected' | 'expired' | 'cancelled' | 'all';

export const RescheduleRequestsTab: React.FC = () => {
  const [requests, setRequests] = useState<RescheduleRequestWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('pending');
  const [pendingCount, setPendingCount] = useState(0);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState<string | null>(null);

  useEffect(() => {
    loadRequests();
    loadPendingCount();
  }, [filterStatus]);

  const loadRequests = async () => {
    try {
      setLoading(true);
      const data = await appointmentsApi.getShopRescheduleRequests(filterStatus);
      setRequests(data);
    } catch (error) {
      console.error('Error loading reschedule requests:', error);
      toast.error('Failed to load reschedule requests');
    } finally {
      setLoading(false);
    }
  };

  const loadPendingCount = async () => {
    try {
      const count = await appointmentsApi.getShopRescheduleRequestCount();
      setPendingCount(count);
    } catch (error) {
      console.error('Error loading pending count:', error);
    }
  };

  const handleApprove = async (requestId: string) => {
    if (!confirm('Are you sure you want to approve this reschedule request? The appointment will be updated immediately.')) {
      return;
    }

    try {
      setProcessingId(requestId);
      await appointmentsApi.approveRescheduleRequest(requestId);
      toast.success('Reschedule request approved!');
      loadRequests();
      loadPendingCount();
    } catch (error: unknown) {
      console.error('Error approving request:', error);
      const axiosError = error as { response?: { data?: { error?: string } } };
      const message = axiosError.response?.data?.error || 'Failed to approve request';
      toast.error(message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (requestId: string) => {
    try {
      setProcessingId(requestId);
      await appointmentsApi.rejectRescheduleRequest(requestId, rejectReason || undefined);
      toast.success('Reschedule request rejected');
      setShowRejectModal(null);
      setRejectReason('');
      loadRequests();
      loadPendingCount();
    } catch (error: unknown) {
      console.error('Error rejecting request:', error);
      const axiosError = error as { response?: { data?: { error?: string } } };
      const message = axiosError.response?.data?.error || 'Failed to reject request';
      toast.error(message);
    } finally {
      setProcessingId(null);
    }
  };

  const formatTime = (time: string): string => {
    if (!time) return '';
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const STATUS_COLORS = {
    pending: { bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500/30' },
    approved: { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/30' },
    rejected: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30' },
    expired: { bg: 'bg-gray-500/20', text: 'text-gray-400', border: 'border-gray-500/30' },
    cancelled: { bg: 'bg-gray-500/20', text: 'text-gray-400', border: 'border-gray-500/30' }
  };

  const FILTER_OPTIONS: { value: FilterStatus; label: string }[] = [
    { value: 'pending', label: 'Pending' },
    { value: 'approved', label: 'Approved' },
    { value: 'rejected', label: 'Rejected' },
    { value: 'expired', label: 'Expired' },
    { value: 'cancelled', label: 'Cancelled' },
    { value: 'all', label: 'All' }
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Reschedule Requests</h1>
          <p className="text-gray-400">Manage customer requests to change appointment times</p>
        </div>
        {pendingCount > 0 && (
          <div className="bg-orange-500/20 border border-orange-500/30 rounded-xl px-4 py-2 flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-orange-400" />
            <span className="text-orange-400 font-semibold">{pendingCount} Pending</span>
          </div>
        )}
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2">
        <Filter className="w-4 h-4 text-gray-400" />
        <span className="text-sm text-gray-400">Filter:</span>
        <div className="flex gap-2 flex-wrap">
          {FILTER_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => setFilterStatus(option.value)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filterStatus === option.value
                  ? 'bg-[#FFCC00] text-black'
                  : 'bg-[#1A1A1A] text-gray-400 hover:text-white border border-gray-800 hover:border-gray-700'
              }`}
            >
              {option.label}
              {option.value === 'pending' && pendingCount > 0 && (
                <span className="ml-1.5 bg-orange-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                  {pendingCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Requests List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-[#FFCC00]" />
          <span className="ml-3 text-gray-400">Loading requests...</span>
        </div>
      ) : requests.length === 0 ? (
        <div className="bg-[#1A1A1A] border border-gray-800 rounded-2xl p-12 text-center">
          <RefreshCw className="w-16 h-16 mx-auto mb-4 text-gray-600" />
          <h3 className="text-xl font-semibold text-white mb-2">No Requests Found</h3>
          <p className="text-gray-400">
            {filterStatus === 'pending'
              ? 'No pending reschedule requests at the moment'
              : `No ${filterStatus} reschedule requests`}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((request) => {
            const statusColors = STATUS_COLORS[request.status];

            return (
              <div
                key={request.requestId}
                className="bg-[#1A1A1A] border border-gray-800 rounded-2xl p-6 hover:border-[#FFCC00]/30 transition-all duration-200"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-white mb-1">{request.serviceName}</h3>
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                      <User className="w-4 h-4" />
                      <span>{request.customerName || 'Customer'}</span>
                      {request.customerEmail && (
                        <span className="text-gray-500">({request.customerEmail})</span>
                      )}
                    </div>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusColors.bg} ${statusColors.text} border ${statusColors.border}`}>
                    {request.status.toUpperCase()}
                  </span>
                </div>

                {/* Time Change Display */}
                <div className="flex flex-col md:flex-row gap-4 mb-4 items-stretch">
                  {/* Original Time */}
                  <div className="flex-1 bg-[#0D0D0D] border border-gray-800 rounded-xl p-4">
                    <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Original Appointment</h4>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-white">
                        <Calendar className="w-4 h-4 text-gray-500" />
                        <span className="text-sm">{formatDate(request.originalDate)}</span>
                      </div>
                      <div className="flex items-center gap-2 text-white">
                        <Clock className="w-4 h-4 text-gray-500" />
                        <span className="text-sm">{formatTime(request.originalTimeSlot)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Arrow - centered vertically */}
                  <div className="hidden md:flex items-center justify-center px-2">
                    <ChevronRight className="w-6 h-6 text-[#FFCC00]" />
                  </div>

                  {/* Requested Time */}
                  <div className="flex-1 bg-[#FFCC00]/10 border border-[#FFCC00]/30 rounded-xl p-4">
                    <h4 className="text-xs font-semibold text-[#FFCC00] uppercase mb-2">Requested New Time</h4>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-white">
                        <Calendar className="w-4 h-4 text-[#FFCC00]" />
                        <span className="text-sm">{formatDate(request.requestedDate)}</span>
                      </div>
                      <div className="flex items-center gap-2 text-white">
                        <Clock className="w-4 h-4 text-[#FFCC00]" />
                        <span className="text-sm">{formatTime(request.requestedTimeSlot)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Customer Reason */}
                {request.customerReason && (
                  <div className="bg-[#0D0D0D] border border-gray-800 rounded-lg p-3 mb-4">
                    <div className="flex items-start gap-2">
                      <MessageSquare className="w-4 h-4 text-gray-500 mt-0.5" />
                      <div>
                        <span className="text-xs text-gray-500 font-semibold">Customer&apos;s Reason:</span>
                        <p className="text-sm text-gray-300">{request.customerReason}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Shop Response (for non-pending) */}
                {request.shopResponseReason && (
                  <div className="bg-[#0D0D0D] border border-gray-800 rounded-lg p-3 mb-4">
                    <div className="flex items-start gap-2">
                      <MessageSquare className="w-4 h-4 text-gray-500 mt-0.5" />
                      <div>
                        <span className="text-xs text-gray-500 font-semibold">Your Response:</span>
                        <p className="text-sm text-gray-300">{request.shopResponseReason}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Expiry Warning */}
                {request.status === 'pending' && request.hoursUntilExpiry && request.hoursUntilExpiry < 12 && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-red-400" />
                      <span className="text-sm text-red-400">
                        Expires in {Math.round(request.hoursUntilExpiry)} hours
                      </span>
                    </div>
                  </div>
                )}

                {/* Actions */}
                {request.status === 'pending' && (
                  <div className="flex gap-3 pt-4 border-t border-gray-800">
                    <button
                      onClick={() => handleApprove(request.requestId)}
                      disabled={processingId === request.requestId}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-green-600/20 text-green-400 border border-green-600/30 rounded-xl hover:bg-green-600/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
                    >
                      {processingId === request.requestId ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <CheckCircle className="w-4 h-4" />
                      )}
                      Approve
                    </button>
                    <button
                      onClick={() => setShowRejectModal(request.requestId)}
                      disabled={processingId === request.requestId}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-red-600/20 text-red-400 border border-red-600/30 rounded-xl hover:bg-red-600/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
                    >
                      <XCircle className="w-4 h-4" />
                      Reject
                    </button>
                  </div>
                )}

                {/* Timestamp */}
                <div className="text-xs text-gray-500 mt-4">
                  Requested: {new Date(request.createdAt).toLocaleString()}
                  {request.respondedAt && (
                    <> | Responded: {new Date(request.respondedAt).toLocaleString()}</>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#0D0D0D] border border-gray-800 rounded-2xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-white mb-4">Reject Reschedule Request</h3>
            <p className="text-gray-400 mb-4">
              Optionally provide a reason for rejecting this request. The customer will be notified.
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Enter reason (optional)..."
              rows={3}
              className="w-full bg-[#1A1A1A] border border-gray-800 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:border-[#FFCC00] focus:outline-none transition-colors resize-none mb-4"
            />
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowRejectModal(null);
                  setRejectReason('');
                }}
                disabled={processingId !== null}
                className="flex-1 px-4 py-3 bg-gray-700/20 text-white border border-gray-700/30 rounded-xl hover:bg-gray-700/30 transition-colors font-semibold disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleReject(showRejectModal)}
                disabled={processingId !== null}
                className="flex-1 px-4 py-3 bg-red-600/20 text-red-400 border border-red-600/30 rounded-xl hover:bg-red-600/30 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {processingId === showRejectModal ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <XCircle className="w-4 h-4" />
                )}
                Reject Request
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
