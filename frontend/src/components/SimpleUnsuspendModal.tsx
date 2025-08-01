'use client';

import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';

interface SimpleUnsuspendModalProps {
  isOpen: boolean;
  onClose: () => void;
  customerAddress: string;
  onSuccess: () => void;
}

export const SimpleUnsuspendModal: React.FC<SimpleUnsuspendModalProps> = ({
  isOpen,
  onClose,
  customerAddress,
  onSuccess
}) => {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const handleSubmit = async () => {
    if (!reason.trim()) {
      setError('Please provide a reason for your unsuspend request');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // Make the request without authentication (temporarily until customer auth is implemented)
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/customers/${customerAddress}/request-unsuspend`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
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

  if (!isOpen || !mounted) return null;

  return ReactDOM.createPortal(
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-50"
        onClick={handleClose}
      />
      
      {/* Modal */}
      <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
        <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4 pointer-events-auto">
          <h2 className="text-xl font-bold text-gray-900 mb-2">Request Account Unsuspension</h2>
          <p className="text-gray-600 text-sm mb-4">
            Please provide a detailed reason for your unsuspend request. An admin will review your request and make a decision.
          </p>
          
          <div className="space-y-4">
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

          <div className="flex justify-end space-x-3 mt-6">
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
        </div>
      </div>
    </>,
    document.body
  );
};