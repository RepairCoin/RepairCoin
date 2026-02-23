"use client";

import React, { useState, useEffect } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { CustomerInfoCard } from "./CustomerInfoCard";
import { CustomerSnapshotPanel } from "./CustomerSnapshotPanel";
import { CustomerProfileTabs } from "./CustomerProfileTabs";
import { BookingDetailsPanel } from "./BookingDetailsPanel";

// --- Types ---

interface CustomerDetails {
  address: string;
  name?: string;
  email?: string;
  phone?: string;
  profile_image_url?: string;
  tier: "BRONZE" | "SILVER" | "GOLD";
  currentBalance: number;
  lifetimeEarnings: number;
  totalRedemptions: number;
  lastTransaction?: string;
  joinDate?: string;
  isActive: boolean;
  suspended?: boolean;
}

interface CustomerAnalytics {
  totalTransactions: number;
  totalEarnings: number;
  totalRedemptions: number;
  averageTransactionValue: number;
  monthlyActivity: { month: string; earnings: number; redemptions: number }[];
}

interface Transaction {
  id: string;
  type: string;
  amount: number;
  shopId?: string;
  shopName?: string;
  createdAt: string;
  description?: string;
  transactionHash?: string;
  status?: string;
}

interface BookingOrder {
  orderId: string;
  serviceName: string;
  serviceDescription?: string;
  serviceCategory?: string;
  status: string;
  totalPrice: number;
  rcnDiscount: number;
  finalPrice: number;
  rcnEarned: number;
  paymentMethod?: string;
  bookingTimeSlot?: string;
  bookingEndTime?: string;
  createdAt: string;
  completedAt?: string;
  shopName?: string;
}

interface CustomerProfileViewProps {
  customerAddress: string;
  shopId: string;
  onBack: () => void;
}

export const CustomerProfileView: React.FC<CustomerProfileViewProps> = ({
  customerAddress,
  shopId,
  onBack,
}) => {
  const [loading, setLoading] = useState(true);
  const [customer, setCustomer] = useState<CustomerDetails | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [analytics, setAnalytics] = useState<CustomerAnalytics | null>(null);
  const [bookings, setBookings] = useState<BookingOrder[]>([]);
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);

  useEffect(() => {
    loadAllData();
  }, [customerAddress]);

  const loadAllData = async () => {
    setLoading(true);
    setSelectedBookingId(null);

    try {
      const [detailsRes, balanceRes, transactionsRes, analyticsRes, bookingsRes] =
        await Promise.all([
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/customers/${customerAddress}`, {
            credentials: "include",
          }),
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/tokens/balance/${customerAddress}`, {
            credentials: "include",
          }),
          fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/customers/${customerAddress}/transactions?limit=20`,
            { credentials: "include" }
          ),
          fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/customers/${customerAddress}/analytics`,
            { credentials: "include" }
          ),
          fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/services/orders/shop?customerAddress=${encodeURIComponent(customerAddress)}&limit=50`,
            { credentials: "include" }
          ),
        ]);

      if (!detailsRes.ok) throw new Error("Failed to load customer details");

      const detailsData = await detailsRes.json();
      const balanceData = balanceRes.ok ? await balanceRes.json() : { data: null };
      const transactionsData = transactionsRes.ok ? await transactionsRes.json() : { data: [] };
      const analyticsData = analyticsRes.ok ? await analyticsRes.json() : { data: null };
      const bookingsData = bookingsRes.ok ? await bookingsRes.json() : { data: [] };

      // Extract customer from response
      const customerData = detailsData.data?.customer || detailsData.data;

      // Use accurate balance from /tokens/balance endpoint
      if (balanceData.data) {
        customerData.currentBalance = balanceData.data.availableBalance;
        customerData.lifetimeEarnings = balanceData.data.lifetimeEarned;
        customerData.totalRedemptions = balanceData.data.totalRedeemed;
      }

      setCustomer(customerData);
      setTransactions(transactionsData.data?.transactions || transactionsData.data || []);
      setAnalytics(analyticsData.data);

      // Map bookings from API response
      const orders = (bookingsData.data || []).map((o: any) => ({
        orderId: o.orderId || o.order_id,
        serviceName: o.serviceName || o.service_name || "Unknown Service",
        serviceDescription: o.serviceDescription || o.service_description,
        serviceCategory: o.serviceCategory || o.service_category,
        status: o.status,
        totalPrice: o.totalPrice || o.total_price || 0,
        rcnDiscount: o.rcnDiscount || o.rcn_discount || 0,
        finalPrice: o.finalPrice || o.final_price || 0,
        rcnEarned: o.rcnEarned || o.rcn_earned || 0,
        paymentMethod: o.paymentMethod || o.payment_method,
        bookingTimeSlot: o.bookingTimeSlot || o.booking_time_slot,
        bookingEndTime: o.bookingEndTime || o.booking_end_time,
        createdAt: o.createdAt || o.created_at,
        completedAt: o.completedAt || o.completed_at,
        shopName: o.shopName || o.shop_name,
      }));
      setBookings(orders);
    } catch (error) {
      console.error("Error loading customer profile data:", error);
    } finally {
      setLoading(false);
    }
  };

  // Compute derived data
  const selectedBooking = bookings.find((b) => b.orderId === selectedBookingId) || null;
  const activeBookingsCount = bookings.filter(
    (b) => b.status === "pending" || b.status === "paid"
  ).length;
  const memberDays = customer?.joinDate
    ? Math.floor(
        (Date.now() - new Date(customer.joinDate).getTime()) / (1000 * 60 * 60 * 24)
      )
    : 0;
  const lastCompletedBooking = bookings.find((b) => b.status === "completed");

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-[#FFCC00] animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading customer profile...</p>
        </div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="text-center py-20">
        <p className="text-white text-lg font-medium mb-2">Customer Not Found</p>
        <p className="text-gray-500 mb-4">Unable to load profile for this customer.</p>
        <button
          onClick={onBack}
          className="px-4 py-2 bg-[#FFCC00] text-[#101010] rounded-lg font-semibold hover:bg-[#e6b800] transition-colors"
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Customers Main Page
      </button>

      {/* Main Layout: 70/30 grid */}
      <div className="grid grid-cols-1 lg:grid-cols-10 gap-6">
        {/* Left Panel (70%) */}
        <div className="lg:col-span-7 space-y-6">
          <CustomerInfoCard
            customer={customer}
            bookingsCount={bookings.length}
            activeBookingsCount={activeBookingsCount}
          />
          <CustomerProfileTabs
            bookings={bookings}
            transactions={transactions}
            analytics={analytics}
            customerBalance={customer.currentBalance ?? 0}
            customerTier={customer.tier}
            shopId={shopId}
            customerAddress={customerAddress}
            selectedBookingId={selectedBookingId}
            onSelectBooking={setSelectedBookingId}
          />
        </div>

        {/* Right Panel (30%) */}
        <div className="lg:col-span-3 space-y-6">
          {selectedBooking ? (
            <BookingDetailsPanel booking={selectedBooking} />
          ) : (
            <CustomerSnapshotPanel
              joinDate={customer.joinDate}
              lastTransaction={customer.lastTransaction}
              lastServiceName={lastCompletedBooking?.serviceName}
              totalTransactions={analytics?.totalTransactions ?? 0}
              memberDays={memberDays}
            />
          )}
        </div>
      </div>
    </div>
  );
};
