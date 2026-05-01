"use client";

import React from "react";
import { Search, MessageSquare, AlertTriangle } from "lucide-react";
import { PageTabs, type PageTab } from "@/components/ui/PageTabs";
import { BookingStatus, MockBooking } from "./mockData";

interface FilterCounts {
  all: number;
  pending: number;
  paid: number;
  completed: number;
  cancelled: number;
}

type MainTabKey = 'bookings' | 'messages' | 'expired';

interface BookingFiltersProps {
  activeFilter: string;
  onFilterChange: (filter: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  bookings: MockBooking[];
  activeTab: MainTabKey;
  onTabChange: (tab: MainTabKey) => void;
  unreadMessagesCount: number;
  filterCounts?: FilterCounts;
}

export const BookingFilters: React.FC<BookingFiltersProps> = ({
  activeFilter,
  onFilterChange,
  searchQuery,
  onSearchChange,
  bookings,
  activeTab,
  onTabChange,
  unreadMessagesCount,
  filterCounts: filterCountsProp
}) => {
  const filterCounts = filterCountsProp || {
    all: bookings.length,
    pending: bookings.filter(b => b.status === 'requested').length,
    paid: bookings.filter(b => b.status === 'paid' || b.status === 'approved' || b.status === 'scheduled').length,
    completed: bookings.filter(b => b.status === 'completed').length,
    cancelled: bookings.filter(b => b.status === 'cancelled').length
  };

  const mainTabs: PageTab<MainTabKey>[] = [
    { key: 'bookings', label: 'Bookings', icon: Search },
    { key: 'messages', label: 'Messages', icon: MessageSquare, hasBadge: unreadMessagesCount > 0 },
    { key: 'expired', label: 'Expired', icon: AlertTriangle },
  ];

  const filterTabs: PageTab[] = [
    { key: 'all', label: `All (${filterCounts.all})` },
    { key: 'pending', label: `Pending (${filterCounts.pending})` },
    { key: 'paid', label: `Paid (${filterCounts.paid})` },
    { key: 'completed', label: `Completed (${filterCounts.completed})` },
    { key: 'cancelled', label: `Cancelled (${filterCounts.cancelled})` },
  ];

  return (
    <div className="space-y-4">
      {/* Main Tabs: Bookings / Messages / Expired */}
      <PageTabs
        tabs={mainTabs}
        activeTab={activeTab}
        onTabChange={onTabChange}
        className="border-b border-gray-800 pb-4"
      />

      {activeTab === 'bookings' && (
        <>
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              type="text"
              placeholder="Search booking ID, Customer Name"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-[#1A1A1A] border border-gray-800 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#FFCC00]/50 transition-colors"
            />
          </div>

          {/* Filter Pills */}
          <PageTabs
            tabs={filterTabs}
            activeTab={activeFilter}
            onTabChange={onFilterChange}
          />
        </>
      )}
    </div>
  );
};
