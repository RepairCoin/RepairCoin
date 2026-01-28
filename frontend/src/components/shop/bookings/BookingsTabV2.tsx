"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Home, ChevronRight, Loader2, RefreshCw } from "lucide-react";
import { mockBookings, MockBooking, Message, transformApiOrder, formatTime12Hour } from "./mockData";
import { BookingStatsCards } from "./BookingStatsCards";
import { BookingFilters } from "./BookingFilters";
import { BookingCard } from "./BookingCard";
import { BookingDetailsPanel } from "./BookingDetailsPanel";
import { CancelBookingModal } from "./CancelBookingModal";
import { toast } from "react-hot-toast";
import { getShopOrders, updateOrderStatus, approveBooking, ServiceOrderWithDetails } from "@/services/api/services";
import { appointmentsApi } from "@/services/api/appointments";
import { RescheduleModal } from "../modals/RescheduleModal";

interface BookingsTabV2Props {
  shopId: string;
  isBlocked?: boolean;
  blockReason?: string;
}

export const BookingsTabV2: React.FC<BookingsTabV2Props> = ({ shopId, isBlocked = false, blockReason = "Action blocked" }) => {
  const searchParams = useSearchParams();

  // State
  const [bookings, setBookings] = useState<MockBooking[]>([]);
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'bookings' | 'messages'>('bookings');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelModalBooking, setCancelModalBooking] = useState<MockBooking | null>(null);
  const [rescheduleModalBooking, setRescheduleModalBooking] = useState<MockBooking | null>(null);
  const [isRescheduling, setIsRescheduling] = useState(false);

  // Load bookings from API
  const loadBookings = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getShopOrders({ limit: 100 });
      if (response && response.data) {
        // Transform API data to UI format
        const transformedBookings = response.data.map(transformApiOrder);
        setBookings(transformedBookings);
        // Select first booking if none selected
        if (!selectedBookingId && transformedBookings.length > 0) {
          setSelectedBookingId(transformedBookings[0].bookingId);
        }
      }
    } catch (err) {
      console.error('Error loading bookings:', err);
      setError('Failed to load bookings');
      // Fall back to mock data for demo
      setBookings(mockBookings);
      if (!selectedBookingId && mockBookings.length > 0) {
        setSelectedBookingId(mockBookings[0].bookingId);
      }
    } finally {
      setLoading(false);
    }
  };

  // Load bookings on mount
  useEffect(() => {
    loadBookings();
  }, [shopId]);

  // Handle URL search parameter for filtering and selecting booking
  useEffect(() => {
    const searchParam = searchParams.get('search');

    if (searchParam && searchParam !== searchQuery) {
      // Set the search query to filter bookings
      setSearchQuery(searchParam);

      // Clear the URL param after handling
      const url = new URL(window.location.href);
      url.searchParams.delete('search');
      window.history.replaceState({}, '', url.toString());
    }
  }, [searchParams, searchQuery]);

  // Auto-select the booking when search query matches exactly one booking
  useEffect(() => {
    if (bookings.length === 0 || !searchQuery) return;

    // Find booking that matches the search query (by bookingId)
    const matchingBooking = bookings.find(b =>
      b.bookingId.toLowerCase() === searchQuery.toLowerCase()
    );

    if (matchingBooking) {
      setSelectedBookingId(matchingBooking.bookingId);
    }
  }, [bookings, searchQuery]);

  // Calculate unread messages count
  const unreadMessagesCount = useMemo(() => {
    return bookings.reduce((sum, b) => sum + b.unreadCount, 0);
  }, [bookings]);

  // Filter bookings based on filter and search
  const filteredBookings = useMemo(() => {
    let filtered = [...bookings];

    // Apply status filter
    if (activeFilter !== 'all') {
      if (activeFilter === 'pending') {
        filtered = filtered.filter(b => b.status === 'requested' || b.status === 'paid');
      } else {
        filtered = filtered.filter(b => b.status === activeFilter);
      }
    }

    // Apply search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(b =>
        b.bookingId.toLowerCase().includes(query) ||
        b.customerName.toLowerCase().includes(query) ||
        b.serviceName.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [bookings, activeFilter, searchQuery]);

  // Get selected booking
  const selectedBooking = useMemo(() => {
    return bookings.find(b => b.bookingId === selectedBookingId) || null;
  }, [bookings, selectedBookingId]);

  // Handlers
  const handleApprove = async (bookingId: string) => {
    // Find the original order ID from the booking
    const booking = bookings.find(b => b.bookingId === bookingId);
    if (!booking) return;

    try {
      // Call the API to approve the booking
      await approveBooking(booking.orderId);

      // Update local state after successful API call
      setBookings(prev => prev.map(b => {
        if (b.bookingId === bookingId) {
          const newTimeline = [
            ...b.timeline,
            {
              id: `tl-${Date.now()}`,
              type: 'approved' as const,
              timestamp: new Date().toISOString(),
              description: 'Booking approved by shop'
            }
          ];
          return { ...b, status: 'approved' as const, timeline: newTimeline };
        }
        return b;
      }));
      toast.success(`Booking ${bookingId} approved!`);
    } catch (error: unknown) {
      console.error('Error approving booking:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Failed to approve booking: ${errorMessage}`);
    }
  };

  const handleReschedule = (bookingId: string) => {
    const booking = bookings.find(b => b.bookingId === bookingId);
    if (booking) {
      setRescheduleModalBooking(booking);
    }
  };

  const handleRescheduleComplete = async (newDate: string, newTime: string, reason?: string) => {
    if (!rescheduleModalBooking) return;

    setIsRescheduling(true);
    try {
      await appointmentsApi.directRescheduleOrder(
        rescheduleModalBooking.orderId,
        newDate,
        newTime,
        reason
      );

      // Update local state
      setBookings(prev => prev.map(b => {
        if (b.bookingId === rescheduleModalBooking.bookingId) {
          const newTimeline = [
            ...b.timeline,
            {
              id: `tl-${Date.now()}`,
              type: 'scheduled' as const,
              timestamp: new Date().toISOString(),
              description: `Appointment rescheduled to ${newDate} at ${newTime}`
            }
          ];
          return {
            ...b,
            serviceDate: newDate,
            serviceTime: newTime,
            timeline: newTimeline
          };
        }
        return b;
      }));

      toast.success('Appointment rescheduled successfully! Customer has been notified.');
      setRescheduleModalBooking(null);
    } catch (error: unknown) {
      console.error('Error rescheduling booking:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Failed to reschedule: ${errorMessage}`);
    } finally {
      setIsRescheduling(false);
    }
  };

  const handleSchedule = (bookingId: string) => {
    setBookings(prev => prev.map(b => {
      if (b.bookingId === bookingId) {
        const newTimeline = [
          ...b.timeline,
          {
            id: `tl-${Date.now()}`,
            type: 'scheduled' as const,
            timestamp: new Date().toISOString(),
            description: `Service scheduled for ${b.serviceDate} at ${formatTime12Hour(b.serviceTime)}`
          }
        ];
        return { ...b, status: 'scheduled' as const, timeline: newTimeline };
      }
      return b;
    }));
    toast.success(`Booking ${bookingId} marked as scheduled!`);
  };

  const handleComplete = async (bookingId: string) => {
    // Find the original order ID from the booking
    const booking = bookings.find(b => b.bookingId === bookingId);
    if (!booking || !booking.orderId) {
      toast.error('Could not find order to complete');
      return;
    }

    // Update local state optimistically
    setBookings(prev => prev.map(b => {
      if (b.bookingId === bookingId) {
        const newTimeline = [
          ...b.timeline,
          {
            id: `tl-${Date.now()}`,
            type: 'completed' as const,
            timestamp: new Date().toISOString(),
            description: 'Service completed successfully. RCN rewards issued.'
          }
        ];
        return { ...b, status: 'completed' as const, timeline: newTimeline };
      }
      return b;
    }));

    try {
      // Call the API to persist the status change
      const result = await updateOrderStatus(booking.orderId, 'completed');
      if (result) {
        toast.success(`Booking ${bookingId} marked as completed! Customer will receive their RCN rewards.`);
      } else {
        // Revert optimistic update on failure
        setBookings(prev => prev.map(b => {
          if (b.bookingId === bookingId) {
            return { ...b, status: 'scheduled' as const };
          }
          return b;
        }));
        toast.error('Failed to mark order as complete. Please try again.');
      }
    } catch (error) {
      console.error('Error completing order:', error);
      // Revert optimistic update on error
      setBookings(prev => prev.map(b => {
        if (b.bookingId === bookingId) {
          return { ...b, status: 'scheduled' as const };
        }
        return b;
      }));
      toast.error('Failed to mark order as complete. Please try again.');
    }
  };

  const handleSendMessage = (bookingId: string, content: string) => {
    setBookings(prev => prev.map(b => {
      if (b.bookingId === bookingId) {
        const newMessage: Message = {
          id: `msg-${Date.now()}`,
          sender: 'shop',
          content,
          timestamp: new Date().toISOString()
        };
        return {
          ...b,
          messages: [...b.messages, newMessage],
          unreadCount: 0
        };
      }
      return b;
    }));
    toast.success('Message sent!');
  };

  const handleCancel = (bookingId: string) => {
    const booking = bookings.find(b => b.bookingId === bookingId);
    if (booking) {
      setCancelModalBooking(booking);
    }
  };

  const handleCancelComplete = () => {
    if (cancelModalBooking) {
      setBookings(prev => prev.map(b => {
        if (b.bookingId === cancelModalBooking.bookingId) {
          const newTimeline = [
            ...b.timeline,
            {
              id: `tl-${Date.now()}`,
              type: 'cancelled' as const,
              timestamp: new Date().toISOString(),
              description: 'Booking cancelled by shop'
            }
          ];
          return { ...b, status: 'cancelled' as const, timeline: newTimeline };
        }
        return b;
      }));
    }
    setCancelModalBooking(null);
  };

  return (
    <div className="space-y-6">

      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Bookings</h1>
          <p className="text-gray-400">View and manage your bookings</p>
        </div>
        <button
          onClick={loadBookings}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-[#1A1A1A] border border-gray-800 rounded-lg text-gray-300 hover:border-gray-600 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Loading State */}
      {loading && bookings.length === 0 && (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <Loader2 className="w-12 h-12 text-[#FFCC00] animate-spin mx-auto mb-4" />
            <p className="text-white">Loading bookings...</p>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-900/20 border border-red-500/50 rounded-xl p-4 mb-4">
          <p className="text-red-400">{error}</p>
          <p className="text-gray-400 text-sm mt-1">Showing demo data instead.</p>
        </div>
      )}

      {/* Stats Cards */}
      <BookingStatsCards bookings={bookings} />

      {/* Filters */}
      <BookingFilters
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        bookings={bookings}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        unreadMessagesCount={unreadMessagesCount}
      />

      {/* Main Content - Split Panel Layout */}
      {activeTab === 'bookings' && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Left Panel - Booking Cards */}
          <div className="lg:col-span-2 space-y-4">
            {filteredBookings.length === 0 ? (
              <div className="bg-[#1A1A1A] border border-gray-800 rounded-xl p-8 text-center">
                <div className="text-5xl mb-4">📦</div>
                <h3 className="text-white font-medium mb-2">No Bookings Found</h3>
                <p className="text-gray-500 text-sm">
                  {searchQuery
                    ? 'Try adjusting your search query'
                    : 'No bookings match the current filter'}
                </p>
              </div>
            ) : (
              filteredBookings.map((booking) => (
                <BookingCard
                  key={booking.bookingId}
                  booking={booking}
                  isSelected={selectedBookingId === booking.bookingId}
                  onSelect={() => setSelectedBookingId(booking.bookingId)}
                  onApprove={() => handleApprove(booking.bookingId)}
                  onReschedule={() => handleReschedule(booking.bookingId)}
                  onSchedule={() => handleSchedule(booking.bookingId)}
                  onComplete={() => handleComplete(booking.bookingId)}
                  onCancel={() => handleCancel(booking.bookingId)}
                  isBlocked={isBlocked}
                  blockReason={blockReason}
                />
              ))
            )}
          </div>

          {/* Right Panel - Booking Details */}
          <div className="lg:col-span-3 lg:sticky lg:top-4 lg:h-[calc(100vh-200px)]">
            <BookingDetailsPanel
              booking={selectedBooking}
              onClose={() => setSelectedBookingId(null)}
              onSendMessage={handleSendMessage}
              isBlocked={isBlocked}
              blockReason={blockReason}
            />
          </div>
        </div>
      )}

      {/* Messages Tab Content */}
      {activeTab === 'messages' && (
        <div className="bg-[#1A1A1A] border border-gray-800 rounded-xl p-8">
          <div className="text-center">
            <div className="text-5xl mb-4">💬</div>
            <h3 className="text-white font-medium mb-2">All Messages</h3>
            <p className="text-gray-500 text-sm mb-6">
              View all customer conversations in one place
            </p>
            {/* Messages list view */}
            <div className="space-y-3 max-w-2xl mx-auto">
              {bookings
                .filter(b => b.messages.length > 0)
                .sort((a, b) => {
                  const aLast = a.messages[a.messages.length - 1]?.timestamp || '';
                  const bLast = b.messages[b.messages.length - 1]?.timestamp || '';
                  return new Date(bLast).getTime() - new Date(aLast).getTime();
                })
                .map((booking) => {
                  const lastMessage = booking.messages[booking.messages.length - 1];
                  return (
                    <button
                      key={booking.bookingId}
                      onClick={() => {
                        setSelectedBookingId(booking.bookingId);
                        setActiveTab('bookings');
                      }}
                      className="w-full p-4 bg-[#0D0D0D] border border-gray-800 rounded-xl hover:border-[#FFCC00]/50 transition-colors text-left"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center text-white font-medium">
                          {booking.customerName.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-white font-medium">{booking.customerName}</span>
                            {booking.unreadCount > 0 && (
                              <span className="w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                                {booking.unreadCount}
                              </span>
                            )}
                          </div>
                          <p className="text-gray-400 text-sm truncate">{lastMessage?.content}</p>
                          <p className="text-gray-600 text-xs mt-1">
                            {booking.serviceName} • {booking.bookingId}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* Cancel Booking Modal */}
      {cancelModalBooking && (
        <CancelBookingModal
          bookingId={cancelModalBooking.bookingId}
          orderId={cancelModalBooking.orderId}
          serviceName={cancelModalBooking.serviceName}
          customerName={cancelModalBooking.customerName}
          onClose={() => setCancelModalBooking(null)}
          onCancelled={handleCancelComplete}
        />
      )}

      {/* Reschedule Booking Modal */}
      {rescheduleModalBooking && (
        <RescheduleModal
          order={{
            orderId: rescheduleModalBooking.orderId,
            serviceId: rescheduleModalBooking.serviceId,
            bookingDate: rescheduleModalBooking.serviceDate,
            bookingTime: rescheduleModalBooking.serviceTime,
            bookingTimeSlot: rescheduleModalBooking.serviceTime,
          } as ServiceOrderWithDetails}
          shopId={shopId}
          onReschedule={handleRescheduleComplete}
          onClose={() => setRescheduleModalBooking(null)}
          isProcessing={isRescheduling}
        />
      )}
    </div>
  );
};
