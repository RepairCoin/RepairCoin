// frontend/src/components/support/TicketList.tsx
"use client";

import React from 'react';
import { SupportTicket } from '@/services/api/support';
import { formatDistanceToNow } from 'date-fns';

interface TicketListProps {
  tickets: SupportTicket[];
  selectedTicketId?: string;
  onTicketSelect: (ticket: SupportTicket) => void;
  isLoading?: boolean;
}

export function TicketList({
  tickets,
  selectedTicketId,
  onTicketSelect,
  isLoading = false
}: TicketListProps) {
  const getStatusColor = (status: SupportTicket['status']) => {
    switch (status) {
      case 'open':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'in_progress':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'waiting_shop':
        return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      case 'resolved':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'closed':
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const getPriorityColor = (priority: SupportTicket['priority']) => {
    switch (priority) {
      case 'urgent':
        return 'text-red-400';
      case 'high':
        return 'text-orange-400';
      case 'medium':
        return 'text-yellow-400';
      case 'low':
        return 'text-gray-400';
      default:
        return 'text-gray-400';
    }
  };

  const formatTime = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch (error) {
      return dateString;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FFCC00]"></div>
      </div>
    );
  }

  if (tickets.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <svg
          className="w-16 h-16 mx-auto mb-4 text-gray-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
          />
        </svg>
        <p className="text-lg font-semibold mb-2">No support tickets</p>
        <p className="text-sm">Create your first ticket to get help from our support team</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {tickets.map((ticket) => {
        const isSelected = ticket.id === selectedTicketId;
        const hasUnread = (ticket.unreadCount || 0) > 0;

        return (
          <button
            key={ticket.id}
            onClick={() => onTicketSelect(ticket)}
            className={`w-full text-left p-4 rounded-lg border transition-all ${
              isSelected
                ? 'bg-gray-700 border-[#FFCC00]'
                : 'bg-[#1A1A1A] border-gray-700 hover:bg-gray-800 hover:border-gray-600'
            }`}
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-white truncate mb-1">
                  {ticket.subject}
                  {hasUnread && (
                    <span className="ml-2 inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-[#FFCC00] rounded-full">
                      {ticket.unreadCount}
                    </span>
                  )}
                </h3>
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full border ${getStatusColor(
                      ticket.status
                    )}`}
                  >
                    {ticket.status.replace('_', ' ')}
                  </span>
                  <span className={`text-xs font-semibold ${getPriorityColor(ticket.priority)}`}>
                    {ticket.priority.toUpperCase()}
                  </span>
                  {ticket.category && (
                    <span className="text-xs text-gray-400">
                      {ticket.category.replace('_', ' ')}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Last message preview */}
            {ticket.lastMessage && (
              <p className="text-sm text-gray-400 truncate mb-2">
                {ticket.lastMessage}
              </p>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>{formatTime(ticket.lastMessageAt)}</span>
              {ticket.shopName && (
                <span className="truncate ml-2">{ticket.shopName}</span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
