"use client";

import React from "react";
import { Clock, CheckCircle, DollarSign, Receipt } from "lucide-react";
import { MockBooking } from "./mockData";

interface BookingStatsCardsProps {
  bookings: MockBooking[];
}

export const BookingStatsCards: React.FC<BookingStatsCardsProps> = ({ bookings }) => {
  const pendingCount = bookings.filter(b => b.status === 'requested' || b.status === 'paid').length;
  const paidCount = bookings.filter(b => b.status === 'paid').length;
  const completedCount = bookings.filter(b => b.status === 'completed').length;
  const totalRevenue = bookings
    .filter(b => b.status === 'paid' || b.status === 'approved' || b.status === 'scheduled' || b.status === 'completed')
    .reduce((sum, b) => sum + b.amount, 0);

  const stats = [
    {
      label: 'Pending Booking',
      value: pendingCount,
      icon: Clock,
      bgColor: 'bg-yellow-500/20',
      iconColor: 'text-yellow-400'
    },
    {
      label: 'Paid',
      value: paidCount,
      icon: Receipt,
      bgColor: 'bg-yellow-500/20',
      iconColor: 'text-yellow-400'
    },
    {
      label: 'Completed',
      value: completedCount,
      icon: CheckCircle,
      bgColor: 'bg-yellow-500/20',
      iconColor: 'text-yellow-400'
    },
    {
      label: 'Total Revenue',
      value: `$${totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
      icon: DollarSign,
      bgColor: 'bg-yellow-500/20',
      iconColor: 'text-yellow-400'
    }
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat, index) => (
        <div
          key={index}
          className="bg-[#1A1A1A] border border-gray-800 rounded-xl p-4 hover:border-gray-700 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-xl ${stat.bgColor}`}>
              <stat.icon className={`w-6 h-6 ${stat.iconColor}`} />
            </div>
            <div>
              <p className="text-sm text-gray-400">{stat.label}</p>
              <p className="text-2xl font-bold text-white">{stat.value}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
