"use client";

import { useState } from "react";
import { X } from "lucide-react";

interface JoinGroupModalProps {
  onClose: () => void;
  onSubmit: (inviteCode: string, message?: string) => Promise<void>;
}

export default function JoinGroupModal({ onClose, onSubmit }: JoinGroupModalProps) {
  const [inviteCode, setInviteCode] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      await onSubmit(inviteCode.trim(), message.trim() || undefined);
    } catch (error) {
      // Error handled by parent
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-lg max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <h2 className="text-2xl font-bold text-white">Join Shop Group</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Invite Code */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Invite Code *
            </label>
            <input
              type="text"
              required
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              placeholder="Enter invite code"
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-[#FFCC00] uppercase"
            />
            <p className="mt-2 text-xs text-gray-400">
              Ask the group admin for the invite code
            </p>
          </div>

          {/* Optional Message */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Message (optional)
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Introduce yourself to the group..."
              rows={3}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-[#FFCC00]"
            />
          </div>

          {/* Info */}
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
            <p className="text-sm text-blue-300">
              For private groups, your request will need admin approval.
              Public groups will accept you automatically.
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-6 py-3 bg-[#FFCC00] text-black rounded-lg hover:bg-[#FFD700] transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? "Joining..." : "Join Group"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
