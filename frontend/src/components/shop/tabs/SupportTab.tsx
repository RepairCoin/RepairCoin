// frontend/src/components/shop/tabs/SupportTab.tsx
"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  SupportTicket,
  SupportMessage,
  createTicket,
  getShopTickets,
  getTicketMessages,
  addMessage,
  markMessagesAsRead,
  getUnreadCount
} from '@/services/api/support';
import { ChatMessage } from '@/components/support/ChatMessage';
import { ChatInput } from '@/components/support/ChatInput';
import { TicketList } from '@/components/support/TicketList';
import { useAuthStore } from '@/stores/authStore';

export function SupportTab() {
  const { account, userProfile } = useAuthStore();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState<boolean>(false);
  const [showNewTicketForm, setShowNewTicketForm] = useState<boolean>(false);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  // New ticket form state
  const [newTicketSubject, setNewTicketSubject] = useState('');
  const [newTicketMessage, setNewTicketMessage] = useState('');
  const [newTicketPriority, setNewTicketPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [newTicketCategory, setNewTicketCategory] = useState<'billing' | 'technical' | 'account' | 'general' | 'feature_request'>('general');
  const [isCreatingTicket, setIsCreatingTicket] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load tickets
  const loadTickets = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await getShopTickets(statusFilter);
      console.log('Loaded tickets:', data);
      setTickets(data || []);
      const count = await getUnreadCount();
      setUnreadCount(count || 0);
    } catch (error) {
      console.error('Error loading tickets:', error);
      setError('Failed to load support tickets. Please try again later.');
      setTickets([]);
      setUnreadCount(0);
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter]);

  // Load messages for selected ticket
  const loadMessages = useCallback(async (ticketId: string) => {
    try {
      setIsLoadingMessages(true);
      setError(null);
      const data = await getTicketMessages(ticketId);
      setMessages(data || []);
      await markMessagesAsRead(ticketId);
      // Refresh tickets to update unread count
      await loadTickets();
    } catch (error) {
      console.error('Error loading messages:', error);
      setError('Failed to load messages. Please try again.');
      setMessages([]);
    } finally {
      setIsLoadingMessages(false);
    }
  }, [loadTickets]);

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
    setShowNewTicketForm(false);
  };

  // Handle new ticket creation
  const handleCreateTicket = async () => {
    if (!newTicketSubject.trim() || !newTicketMessage.trim()) {
      setError('Subject and message are required');
      return;
    }

    try {
      setIsCreatingTicket(true);
      setError(null);
      const result = await createTicket({
        subject: newTicketSubject,
        message: newTicketMessage,
        priority: newTicketPriority,
        category: newTicketCategory
      });

      // Reset form
      setNewTicketSubject('');
      setNewTicketMessage('');
      setNewTicketPriority('medium');
      setNewTicketCategory('general');
      setShowNewTicketForm(false);

      // Refresh tickets and select the new one
      await loadTickets();
      console.log('Created ticket:', result.ticket);
      setSelectedTicket(result.ticket);
    } catch (error) {
      console.error('Error creating ticket:', error);
      setError('Failed to create ticket. Please try again.');
    } finally {
      setIsCreatingTicket(false);
    }
  };

  // Handle sending message
  const handleSendMessage = async (messageText: string) => {
    if (!selectedTicket) return;

    try {
      setError(null);
      const newMessage = await addMessage(selectedTicket.id, {
        message: messageText
      });
      setMessages([...messages, newMessage]);
      await loadTickets(); // Refresh to update last message
    } catch (error) {
      console.error('Error sending message:', error);
      setError('Failed to send message. Please try again.');
      throw error;
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

      {/* Header */}
      <div className="bg-[#1A1A1A] rounded-lg p-6 border border-gray-800">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">Support Center</h2>
            <p className="text-gray-400">Get help from our support team</p>
          </div>
          <button
            onClick={() => {
              setShowNewTicketForm(true);
              setSelectedTicket(null);
            }}
            className="bg-[#FFCC00] text-black px-6 py-3 rounded-lg font-semibold hover:bg-yellow-500 transition-colors flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Ticket
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="text-2xl font-bold text-white">{tickets?.length || 0}</div>
            <div className="text-sm text-gray-400">Total Tickets</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="text-2xl font-bold text-[#FFCC00]">{unreadCount}</div>
            <div className="text-sm text-gray-400">Unread Messages</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="text-2xl font-bold text-green-400">
              {tickets?.filter(t => t.status === 'resolved').length || 0}
            </div>
            <div className="text-sm text-gray-400">Resolved</div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tickets list */}
        <div className="lg:col-span-1">
          <div className="bg-[#1A1A1A] rounded-lg p-4 border border-gray-800">
            {/* Filter */}
            <div className="mb-4">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full bg-gray-800 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#FFCC00]"
              >
                <option value="">All Tickets</option>
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="waiting_shop">Waiting for Response</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
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
            {showNewTicketForm ? (
              /* New ticket form */
              <div className="flex-1 overflow-y-auto p-6">
                <h3 className="text-xl font-bold text-white mb-6">Create New Ticket</h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Subject *
                    </label>
                    <input
                      type="text"
                      value={newTicketSubject}
                      onChange={(e) => setNewTicketSubject(e.target.value)}
                      placeholder="Brief description of your issue"
                      className="w-full bg-gray-800 text-white rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#FFCC00]"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Priority
                    </label>
                    <select
                      value={newTicketPriority}
                      onChange={(e) => setNewTicketPriority(e.target.value as any)}
                      className="w-full bg-gray-800 text-white rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#FFCC00]"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Category
                    </label>
                    <select
                      value={newTicketCategory}
                      onChange={(e) => setNewTicketCategory(e.target.value as any)}
                      className="w-full bg-gray-800 text-white rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#FFCC00]"
                    >
                      <option value="general">General</option>
                      <option value="technical">Technical</option>
                      <option value="billing">Billing</option>
                      <option value="account">Account</option>
                      <option value="feature_request">Feature Request</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Message *
                    </label>
                    <textarea
                      value={newTicketMessage}
                      onChange={(e) => setNewTicketMessage(e.target.value)}
                      placeholder="Describe your issue in detail..."
                      rows={6}
                      className="w-full bg-gray-800 text-white rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#FFCC00] resize-none"
                    />
                  </div>

                  <div className="flex gap-4">
                    <button
                      onClick={handleCreateTicket}
                      disabled={!newTicketSubject.trim() || !newTicketMessage.trim() || isCreatingTicket}
                      className="flex-1 bg-[#FFCC00] text-black px-6 py-3 rounded-lg font-semibold hover:bg-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {isCreatingTicket ? 'Creating...' : 'Create Ticket'}
                    </button>
                    <button
                      onClick={() => setShowNewTicketForm(false)}
                      className="px-6 py-3 rounded-lg font-semibold bg-gray-800 text-white hover:bg-gray-700 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            ) : selectedTicket ? (
              /* Chat view */
              <>
                {/* Header */}
                <div className="p-4 border-b border-gray-700">
                  <h3 className="font-semibold text-white mb-1">{selectedTicket.subject || 'Untitled Ticket'}</h3>
                  <div className="flex items-center gap-2 text-sm">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${
                      selectedTicket.status === 'open' ? 'bg-blue-500/20 text-blue-400' :
                      selectedTicket.status === 'in_progress' ? 'bg-yellow-500/20 text-yellow-400' :
                      selectedTicket.status === 'waiting_shop' ? 'bg-purple-500/20 text-purple-400' :
                      selectedTicket.status === 'resolved' ? 'bg-green-500/20 text-green-400' :
                      'bg-gray-500/20 text-gray-400'
                    }`}>
                      {selectedTicket.status?.replace('_', ' ') || 'unknown'}
                    </span>
                    <span className="text-gray-400">•</span>
                    <span className="text-gray-400">{selectedTicket.priority || 'medium'} priority</span>
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {isLoadingMessages ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FFCC00]"></div>
                    </div>
                  ) : (
                    <>
                      {messages.map((message) => (
                        <ChatMessage
                          key={message.id}
                          message={message}
                          isOwnMessage={message.senderType === 'shop' && message.senderId === userProfile?.shopId}
                        />
                      ))}
                      <div ref={messagesEndRef} />
                    </>
                  )}
                </div>

                {/* Input */}
                <ChatInput
                  onSend={handleSendMessage}
                  disabled={selectedTicket.status === 'closed'}
                  placeholder={
                    selectedTicket.status === 'closed'
                      ? 'This ticket is closed'
                      : 'Type your message...'
                  }
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
                  <p className="text-sm">Choose a ticket from the list to view the conversation</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
