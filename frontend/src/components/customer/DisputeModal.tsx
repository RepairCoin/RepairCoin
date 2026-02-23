'use client';

// frontend/src/components/customer/DisputeModal.tsx
import { useState } from 'react';
import { X, AlertTriangle, CheckCircle, Clock, FileText } from 'lucide-react';
import { submitDispute } from '@/services/api/noShow';
import type { NoShowHistoryEntry } from '@/services/api/noShow';

interface DisputeModalProps {
  isOpen: boolean;
  onClose: () => void;
  noShowEntry: NoShowHistoryEntry;
  onDisputeSubmitted: () => void;
}

const DISPUTE_REASONS = [
  'I was present at the scheduled time but no one was available',
  'I called to cancel/reschedule but was still marked as no-show',
  'The appointment was cancelled by the shop',
  'I had an emergency and notified the shop',
  'There was a technical issue with the booking system',
  'Other (please describe below)',
];

export default function DisputeModal({
  isOpen,
  onClose,
  noShowEntry,
  onDisputeSubmitted,
}: DisputeModalProps) {
  const [selectedReason, setSelectedReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    autoApproved: boolean;
    message: string;
  } | null>(null);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const finalReason =
    selectedReason === 'Other (please describe below)'
      ? customReason.trim()
      : selectedReason
        ? `${selectedReason}${customReason.trim() ? ` — ${customReason.trim()}` : ''}`
        : customReason.trim();

  const isValid = finalReason.length >= 10;

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getDaysRemaining = () => {
    const markedAt = new Date(noShowEntry.markedNoShowAt);
    const windowEnd = new Date(markedAt.getTime() + 7 * 24 * 60 * 60 * 1000);
    const now = new Date();
    const daysLeft = Math.ceil((windowEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(0, daysLeft);
  };

  const handleSubmit = async () => {
    if (!isValid) {
      setError('Please provide a reason for your dispute (minimum 10 characters).');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const response = await submitDispute(noShowEntry.orderId, finalReason);
      setResult({
        success: true,
        autoApproved: response.autoApproved,
        message: response.message,
      });
      onDisputeSubmitted();
    } catch (err: unknown) {
      const errorMsg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data?.error ||
            'Failed to submit dispute. Please try again.'
          : 'Failed to submit dispute. Please try again.';
      setError(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const daysRemaining = getDaysRemaining();

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-lg shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-500/10 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Dispute No-Show</h2>
              <p className="text-sm text-zinc-400">Submit a dispute to contest this record</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Success State */}
          {result?.success && (
            <div
              className={`p-4 rounded-xl border ${
                result.autoApproved
                  ? 'bg-green-500/10 border-green-500/30'
                  : 'bg-blue-500/10 border-blue-500/30'
              }`}
            >
              <div className="flex items-start gap-3">
                {result.autoApproved ? (
                  <CheckCircle className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                ) : (
                  <Clock className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
                )}
                <div>
                  <p
                    className={`font-medium ${result.autoApproved ? 'text-green-300' : 'text-blue-300'}`}
                  >
                    {result.autoApproved ? 'Dispute Approved!' : 'Dispute Submitted'}
                  </p>
                  <p className="text-sm text-zinc-300 mt-1">{result.message}</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="mt-4 w-full py-2 bg-zinc-700 hover:bg-zinc-600 text-white text-sm rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          )}

          {!result?.success && (
            <>
              {/* No-Show Details */}
              <div className="bg-zinc-800 rounded-xl p-4 space-y-2">
                <h3 className="text-sm font-medium text-zinc-300 mb-3 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  No-Show Record
                </h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-zinc-500">Date</span>
                    <p className="text-zinc-200">{formatDate(noShowEntry.scheduledTime)}</p>
                  </div>
                  <div>
                    <span className="text-zinc-500">Marked On</span>
                    <p className="text-zinc-200">{formatDate(noShowEntry.markedNoShowAt)}</p>
                  </div>
                </div>
                {daysRemaining > 0 ? (
                  <p className="text-xs text-amber-400 mt-2">
                    ⏰ Dispute window closes in {daysRemaining} day{daysRemaining !== 1 ? 's' : ''}
                  </p>
                ) : (
                  <p className="text-xs text-red-400 mt-2">⚠️ Dispute window has expired</p>
                )}
              </div>

              {daysRemaining === 0 ? (
                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                  <p className="text-red-300 text-sm text-center">
                    The 7-day dispute window for this no-show has expired.
                  </p>
                </div>
              ) : (
                <>
                  {/* Reason Selection */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-zinc-300">
                      Reason for Dispute
                    </label>
                    <div className="space-y-2">
                      {DISPUTE_REASONS.map((reason) => (
                        <button
                          key={reason}
                          onClick={() => setSelectedReason(reason)}
                          className={`w-full text-left p-3 rounded-lg border text-sm transition-colors ${
                            selectedReason === reason
                              ? 'border-amber-500 bg-amber-500/10 text-amber-200'
                              : 'border-zinc-700 bg-zinc-800 text-zinc-300 hover:border-zinc-600'
                          }`}
                        >
                          {reason}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Additional Details */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-zinc-300">
                      {selectedReason === 'Other (please describe below)'
                        ? 'Describe your reason *'
                        : 'Additional Details (optional)'}
                    </label>
                    <textarea
                      value={customReason}
                      onChange={(e) => setCustomReason(e.target.value)}
                      placeholder={
                        selectedReason === 'Other (please describe below)'
                          ? 'Please describe why you believe this no-show was incorrect...'
                          : 'Any additional context or evidence...'
                      }
                      rows={3}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-amber-500 resize-none"
                    />
                  </div>

                  {/* Error */}
                  {error && (
                    <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                      <p className="text-red-300 text-sm">{error}</p>
                    </div>
                  )}

                  {/* Info Note */}
                  <div className="p-3 bg-zinc-800 rounded-lg">
                    <p className="text-xs text-zinc-400">
                      <strong className="text-zinc-300">Note:</strong> Your dispute will be
                      reviewed by the shop. If this is your first no-show, it may be automatically
                      approved. False disputes may affect your account standing.
                    </p>
                  </div>
                </>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {!result?.success && daysRemaining > 0 && (
          <div className="flex gap-3 p-6 pt-0">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 border border-zinc-700 text-zinc-300 hover:bg-zinc-800 rounded-lg text-sm transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!isValid || isSubmitting}
              className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:bg-zinc-700 disabled:text-zinc-500 text-black disabled:cursor-not-allowed font-medium rounded-lg text-sm transition-colors"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Dispute'}
            </button>
          </div>
        )}

        {!result?.success && daysRemaining === 0 && (
          <div className="p-6 pt-0">
            <button
              onClick={onClose}
              className="w-full py-2.5 border border-zinc-700 text-zinc-300 hover:bg-zinc-800 rounded-lg text-sm transition-colors"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
