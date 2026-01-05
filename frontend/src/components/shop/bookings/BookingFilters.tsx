"use client";

import React from "react";
import { Search, MessageSquare } from "lucide-react";
import { BookingStatus, MockBooking } from "./mockData";

interface BookingFiltersProps {
  activeFilter: string;
  onFilterChange: (filter: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  bookings: MockBooking[];
  activeTab: 'bookings' | 'messages';
  onTabChange: (tab: 'bookings' | 'messages') => void;
  unreadMessagesCount: number;
}

export const BookingFilters: React.FC<BookingFiltersProps> = ({
  activeFilter,
  onFilterChange,
  searchQuery,
  onSearchChange,
  bookings,
  activeTab,
  onTabChange,
  unreadMessagesCount
}) => {
  const filterCounts = {
    all: bookings.length,
    pending: bookings.filter(b => b.status === 'requested' || b.status === 'paid').length,
    paid: bookings.filter(b => b.status === 'paid').length,
    completed: bookings.filter(b => b.status === 'completed').length,
    cancelled: bookings.filter(b => b.status === 'cancelled').length
  };

  const filters = [
    { key: 'all', label: 'All' },
    { key: 'pending', label: 'Pending' },
    { key: 'paid', label: 'Paid' },
    { key: 'completed', label: 'Completed' },
    { key: 'cancelled', label: 'Cancelled' }
  ];

  return (
    <div className="space-y-4">
      {/* Main Tabs: Bookings / Messages */}
      <div className="flex items-center gap-2 border-b border-gray-800 pb-4">
        <button
          onClick={() => onTabChange('bookings')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === 'bookings'
              ? 'bg-[#1A1A1A] text-white border border-gray-700'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <Search className="w-4 h-4" />
          Bookings
        </button>
        <button
          onClick={() => onTabChange('messages')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors relative ${
            activeTab === 'messages'
              ? 'bg-[#1A1A1A] text-white border border-gray-700'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          Messages
          {unreadMessagesCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
              {unreadMessagesCount}
            </span>
          )}
        </button>
      </div>

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
          <div className="flex flex-wrap gap-2">
            {filters.map((filter) => (
              <button
                key={filter.key}
                onClick={() => onFilterChange(filter.key)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  activeFilter === filter.key
                    ? 'bg-white text-black'
                    : 'bg-[#1A1A1A] text-gray-400 border border-gray-800 hover:border-gray-600'
                }`}
              >
                {filter.label} ({filterCounts[filter.key as keyof typeof filterCounts]})
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
