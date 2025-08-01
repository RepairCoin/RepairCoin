'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

interface UnsuspendRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  customerAddress: string;
  onSuccess: () => void;
}

export const UnsuspendRequestModal: React.FC<UnsuspendRequestModalProps> = ({
  isOpen,
  onClose,
  customerAddress,
  onSuccess
}) => {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!reason.trim()) {
      setError('Please provide a reason for your unsuspend request');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // Get auth token from localStorage or session
      const authToken = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/customers/${customerAddress}/request-unsuspend`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ reason: reason.trim() })
      });

      const data = await response.json();
      
      if (response.ok) {
        onSuccess();
        onClose();
        // Show success message
        alert('Your unsuspend request has been submitted successfully. An admin will review it soon.');
      } else {
        setError(data.error || 'Failed to submit unsuspend request');
      }
    } catch (error) {
      console.error('Error submitting unsuspend request:', error);
      setError('Failed to submit request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!submitting) {
      setReason('');
      setError(null);
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Request Account Unsuspension</DialogTitle>
          <DialogDescription>
            Please provide a detailed reason for your unsuspend request. An admin will review your request and make a decision.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div>
            <label htmlFor="reason" className="block text-sm font-medium text-gray-700 mb-2">
              Reason for Request
            </label>
            <textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              placeholder="Please explain why you believe your account should be unsuspended..."
              disabled={submitting}
            />
          </div>
          
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}
        </div>

        <div className="flex justify-end space-x-3">
          <button
            onClick={handleClose}
            disabled={submitting}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !reason.trim()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Submitting...' : 'Submit Request'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};