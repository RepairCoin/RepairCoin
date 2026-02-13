// frontend/src/components/admin/tabs/AdminSupportTab.tsx
"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  SupportTicket,
  SupportMessage,
  AdminStats,
  getAllTickets,
  getTicketMessages,
  addMessage,
  markMessagesAsRead,
  getAdminStats,
  updateTicketStatus,
  assignTicket
} from '@/services/api/support';
import { ChatMessage } from '@/components/support/ChatMessage';
import { ChatInput } from '@/components/support/ChatInput';
import { TicketList } from '@/components/support/TicketList';
import { useAuthStore } from '@/stores/authStore';

export function AdminSupportTab() {
  const { account } = useAuthStore();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [totalTickets, setTotalTickets] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [priorityFilter, setPriorityFilter] = useState<string>('');

  // Admin actions
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [newStatus, setNewStatus] = useState<string>('');
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignToAddress, setAssignToAddress] = useState('');
  const [isInternal, setIsInternal] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load tickets
  const loadTickets = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const filters = {
        status: statusFilter || undefined,
        priority: priorityFilter || undefined
      };
      const data = await getAllTickets(filters);
      setTickets(data?.tickets || []);
      setTotalTickets(data?.total || 0);

      const statsData = await getAdminStats();
      setStats(statsData);
    } catch (error) {
      console.error('Error loading tickets:', error);
      setError('Failed to load support tickets. Please try again later.');
      setTickets([]);
      setTotalTickets(0);
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, priorityFilter]);

  // Load messages for selected ticket
  const loadMessages = useCallback(async (ticketId: string) => {
    try {
      setIsLoadingMessages(true);
      setError(null);
      const data = await getTicketMessages(ticketId);
      setMessages(data || []);
      await markMessagesAsRead(ticketId);
    } catch (error) {
      console.error('Error loading messages:', error);
      setError('Failed to load messages. Please try again.');
      setMessages([]);
    } finally {
      setIsLoadingMessages(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  // Load messages when ticket is selected
  useEffect(() => {
    if (selectedTicket?.id) {
      loadMessages(selectedTicket.id);
    } else {
      // Clear messages when no ticket is selected
      setMessages([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTicket?.id]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle ticket selection
  const handleTicketSelect = (ticket: SupportTicket) => {
    setSelectedTicket(ticket);
    setNewStatus(ticket.status);
    setAssignToAddress(ticket.assignedTo || '');
  };

  // Handle sending message
  const handleSendMessage = async (messageText: string) => {
    if (!selectedTicket) return;

    try {
      setError(null);
      const newMessage = await addMessage(selectedTicket.id, {
        message: messageText,
        isInternal
      });
      setMessages([...messages, newMessage]);
      await loadTickets(); // Refresh to update last message
    } catch (error) {
      console.error('Error sending message:', error);
      setError('Failed to send message. Please try again.');
      throw error;
    }
  };

  // Handle status update
  const handleUpdateStatus = async () => {
    if (!selectedTicket) return;

    try {
      setError(null);
      await updateTicketStatus(selectedTicket.id, {
        status: newStatus as any,
        assignedTo: assignToAddress || undefined
      });
      setShowStatusModal(false);
      await loadTickets();
      // Update selected ticket
      const updatedTicket = tickets.find(t => t.id === selectedTicket.id);
      if (updatedTicket) {
        setSelectedTicket(updatedTicket);
      }
    } catch (error) {
      console.error('Error updating status:', error);
      setError('Failed to update ticket status. Please try again.');
    }
  };

  // Handle assign ticket
  const handleAssignTicket = async () => {
    if (!selectedTicket || !assignToAddress.trim()) {
      setError('Admin address is required');
      return;
    }

    try {
      setError(null);
      await assignTicket(selectedTicket.id, {
        assignedTo: assignToAddress.toLowerCase()
      });
      setShowAssignModal(false);
      await loadTickets();
      // Update selected ticket
      const updatedTicket = tickets.find(t => t.id === selectedTicket.id);
      if (updatedTicket) {
        setSelectedTicket(updatedTicket);
      }
    } catch (error) {
      console.error('Error assigning ticket:', error);
      setError('Failed to assign ticket. Please try again.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Error Alert */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4 flex items-start gap-3">
          <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="flex-1">
            <p className="text-red-500 font-medium">{error}</p>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-red-500 hover:text-red-400 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Header & Stats */}
      <div className="bg-[#1A1A1A] rounded-lg p-6 border border-gray-800">
        <h2 className="text-2xl font-bold text-white mb-6">Support Management</h2>

        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            <div className="bg-gray-800 rounded-lg p-4">
              <div className="text-2xl font-bold text-white">{stats.total || 0}</div>
              <div className="text-sm text-gray-400">Total Active</div>
            </div>
            <div className="bg-gray-800 rounded-lg p-4">
              <div className="text-2xl font-bold text-blue-400">{stats.open || 0}</div>
              <div className="text-sm text-gray-400">Open</div>
            </div>
            <div className="bg-gray-800 rounded-lg p-4">
              <div className="text-2xl font-bold text-yellow-400">{stats.inProgress || 0}</div>
              <div className="text-sm text-gray-400">In Progress</div>
            </div>
            <div className="bg-gray-800 rounded-lg p-4">
              <div className="text-2xl font-bold text-purple-400">{stats.waitingShop || 0}</div>
              <div className="text-sm text-gray-400">Waiting Shop</div>
            </div>
            <div className="bg-gray-800 rounded-lg p-4">
              <div className="text-2xl font-bold text-green-400">{stats.resolved || 0}</div>
              <div className="text-sm text-gray-400">Resolved</div>
            </div>
            <div className="bg-gray-800 rounded-lg p-4">
              <div className="text-2xl font-bold text-red-400">{stats.unassigned || 0}</div>
              <div className="text-sm text-gray-400">Unassigned</div>
            </div>
          </div>
        )}
      </div>

      {/* Main content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tickets list */}
        <div className="lg:col-span-1">
          <div className="bg-[#1A1A1A] rounded-lg p-4 border border-gray-800">
            {/* Filters */}
            <div className="space-y-3 mb-4">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full bg-gray-800 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#FFCC00]"
              >
                <option value="">All Statuses</option>
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="waiting_shop">Waiting for Shop</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>

              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="w-full bg-gray-800 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#FFCC00]"
              >
                <option value="">All Priorities</option>
                <option value="urgent">Urgent</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>

            <TicketList
              tickets={tickets}
              selectedTicketId={selectedTicket?.id}
              onTicketSelect={handleTicketSelect}
              isLoading={isLoading}
            />
          </div>
        </div>

        {/* Chat area */}
        <div className="lg:col-span-2">
          <div className="bg-[#1A1A1A] rounded-lg border border-gray-800 flex flex-col h-[600px]">
            {selectedTicket ? (
              <>
                {/* Header with admin controls */}
                <div className="p-4 border-b border-gray-700">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="font-semibold text-white mb-1">{selectedTicket.subject || 'Untitled Ticket'}</h3>
                      <div className="text-sm text-gray-400">
                        {selectedTicket.shopName && (
                          <span className="mr-4">Shop: {selectedTicket.shopName}</span>
                        )}
                        {selectedTicket.category && (
                          <span>Category: {selectedTicket.category?.replace('_', ' ')}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Status badge */}
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      selectedTicket.status === 'open' ? 'bg-blue-500/20 text-blue-400' :
                      selectedTicket.status === 'in_progress' ? 'bg-yellow-500/20 text-yellow-400' :
                      selectedTicket.status === 'waiting_shop' ? 'bg-purple-500/20 text-purple-400' :
                      selectedTicket.status === 'resolved' ? 'bg-green-500/20 text-green-400' :
                      'bg-gray-500/20 text-gray-400'
                    }`}>
                      {selectedTicket.status?.replace('_', ' ') || 'unknown'}
                    </span>

                    {/* Priority badge */}
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      selectedTicket.priority === 'urgent' ? 'bg-red-500/20 text-red-400' :
                      selectedTicket.priority === 'high' ? 'bg-orange-500/20 text-orange-400' :
                      selectedTicket.priority === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                      'bg-gray-500/20 text-gray-400'
                    }`}>
                      {selectedTicket.priority?.toUpperCase() || 'MEDIUM'}
                    </span>

                    {/* Action buttons */}
                    <button
                      onClick={() => setShowStatusModal(true)}
                      className="ml-auto px-3 py-1 bg-gray-700 text-white text-xs rounded hover:bg-gray-600 transition-colors"
                    >
                      Update Status
                    </button>
                    <button
                      onClick={() => setShowAssignModal(true)}
                      className="px-3 py-1 bg-gray-700 text-white text-xs rounded hover:bg-gray-600 transition-colors"
                    >
                      {selectedTicket.assignedTo ? 'Reassign' : 'Assign'}
                    </button>
                  </div>

                  {selectedTicket.assignedTo && (
                    <div className="mt-2 text-xs text-gray-400">
                      Assigned to: {selectedTicket.assignedTo}
                    </div>
                  )}
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {isLoadingMessages ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FFCC00]"></div>
                    </div>
                  ) : (
                    <>
                      {messages.map((message) => {
                        const isOwn = message.senderType === 'admin' &&
                          message.senderId?.toLowerCase() === account?.address?.toLowerCase();
                        return (
                          <ChatMessage
                            key={message.id}
                            message={message}
                            isOwnMessage={isOwn}
                          />
                        );
                      })}
                      <div ref={messagesEndRef} />
                    </>
                  )}
                </div>

                {/* Input with internal note option */}
                <ChatInput
                  onSend={handleSendMessage}
                  disabled={selectedTicket.status === 'closed'}
                  placeholder={
                    selectedTicket.status === 'closed'
                      ? 'This ticket is closed'
                      : 'Type your message...'
                  }
                  showInternalCheckbox={true}
                  onInternalChange={setIsInternal}
                />
              </>
            ) : (
              /* Empty state */
              <div className="flex items-center justify-center h-full text-gray-400">
                <div className="text-center">
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
                      d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                    />
                  </svg>
                  <p className="text-lg font-semibold mb-2">Select a ticket</p>
                  <p className="text-sm">Choose a ticket from the list to view and respond</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Status Update Modal */}
      {showStatusModal && selectedTicket && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-[#1A1A1A] rounded-lg p-6 max-w-md w-full mx-4 border border-gray-800">
            <h3 className="text-xl font-bold text-white mb-4">Update Ticket Status</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Status
                </label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="w-full bg-gray-800 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#FFCC00]"
                >
                  <option value="open">Open</option>
                  <option value="in_progress">In Progress</option>
                  <option value="waiting_shop">Waiting for Shop</option>
                  <option value="resolved">Resolved</option>
                  <option value="closed">Closed</option>
                </select>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={handleUpdateStatus}
                  className="flex-1 bg-[#FFCC00] text-black px-4 py-2 rounded-lg font-semibold hover:bg-yellow-500 transition-colors"
                >
                  Update
                </button>
                <button
                  onClick={() => setShowStatusModal(false)}
                  className="px-4 py-2 rounded-lg font-semibold bg-gray-800 text-white hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Assign Modal */}
      {showAssignModal && selectedTicket && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-[#1A1A1A] rounded-lg p-6 max-w-md w-full mx-4 border border-gray-800">
            <h3 className="text-xl font-bold text-white mb-4">Assign Ticket</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Admin Wallet Address
                </label>
                <input
                  type="text"
                  value={assignToAddress}
                  onChange={(e) => setAssignToAddress(e.target.value)}
                  placeholder="0x..."
                  className="w-full bg-gray-800 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#FFCC00]"
                />
              </div>

              <div className="flex gap-4">
                <button
                  onClick={handleAssignTicket}
                  disabled={!assignToAddress.trim()}
                  className="flex-1 bg-[#FFCC00] text-black px-4 py-2 rounded-lg font-semibold hover:bg-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Assign
                </button>
                <button
                  onClick={() => setShowAssignModal(false)}
                  className="px-4 py-2 rounded-lg font-semibold bg-gray-800 text-white hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
