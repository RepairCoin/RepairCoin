"use client";

import React, { useState, useEffect } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { CustomerInfoCard } from "./CustomerInfoCard";
import { CustomerSnapshotPanel } from "./CustomerSnapshotPanel";
import { CustomerProfileTabs } from "./CustomerProfileTabs";
import { BookingDetailsPanel } from "./BookingDetailsPanel";
import { getOrCreateConversation } from "@/services/api/messaging";

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

interface PaginationMeta {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  hasMore: boolean;
}

interface Transaction {
  id: string;
  type: string;
  amount: number;
  shopId?: string;
  shopName?: string;
  createdAt: string;
  description?: string;
}

interface ProfileData {
  customer: CustomerDetails;
  analytics: CustomerAnalytics;
  bookings: { items: BookingOrder[]; pagination: PaginationMeta };
  transactions: { items: Transaction[]; pagination: PaginationMeta };
}

interface CustomerProfileViewProps {
  customerAddress: string;
  shopId: string;
  onBack: () => void;
}

const mapBookingOrder = (o: any): BookingOrder => ({
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
});

export const CustomerProfileView: React.FC<CustomerProfileViewProps> = ({
  customerAddress,
  shopId,
  onBack,
}) => {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  // Keep a flat list of all loaded bookings for the sidebar detail panel
  const [allBookings, setAllBookings] = useState<BookingOrder[]>([]);

  const handleSendMessage = async (address: string) => {
    setSendingMessage(true);
    try {
      const conversation = await getOrCreateConversation(address);
      router.push(`/shop?tab=messages&conversation=${conversation.conversationId}`);
    } catch (error) {
      console.error("Failed to open conversation:", error);
      toast.error("Failed to open conversation");
      setSendingMessage(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, [customerAddress]);

  const loadProfile = async () => {
    setLoading(true);
    setSelectedBookingId(null);

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/shops/${shopId}/customer-profile/${customerAddress}?bookingsPage=1&bookingsLimit=5&transactionsPage=1&transactionsLimit=5`,
        { credentials: "include" }
      );

      if (!res.ok) throw new Error("Failed to load customer profile");
      const json = await res.json();
      const d = json.data;

      const bookingItems = (d.bookings?.items || []).map(mapBookingOrder);

      const data: ProfileData = {
        customer: d.customer,
        analytics: d.analytics,
        bookings: {
          items: bookingItems,
          pagination: d.bookings?.pagination || { page: 1, limit: 5, totalItems: 0, totalPages: 1, hasMore: false },
        },
        transactions: {
          items: d.transactions?.items || [],
          pagination: d.transactions?.pagination || { page: 1, limit: 5, totalItems: 0, totalPages: 1, hasMore: false },
        },
      };

      setProfileData(data);
      setAllBookings(bookingItems);
    } catch (error) {
      console.error("Error loading customer profile:", error);
      toast.error("Failed to load customer profile");
    } finally {
      setLoading(false);
    }
  };

  // Callback for when tabs load a new page of bookings — accumulate for sidebar
  const handleBookingsLoaded = (bookings: BookingOrder[]) => {
    setAllBookings((prev) => {
      const ids = new Set(prev.map((b) => b.orderId));
      const newOnes = bookings.filter((b) => !ids.has(b.orderId));
      return [...prev, ...newOnes];
    });
  };

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

  if (!profileData) {
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

  const { customer, analytics } = profileData;

  // Derived data from accumulated bookings
  const selectedBooking = allBookings.find((b) => b.orderId === selectedBookingId) || null;
  const activeBookingsCount = allBookings.filter(
    (b) => b.status === "pending" || b.status === "paid"
  ).length;
  const memberDays = customer.joinDate
    ? Math.floor(
        (Date.now() - new Date(customer.joinDate).getTime()) / (1000 * 60 * 60 * 24)
      )
    : 0;
  const lastCompletedBooking = allBookings.find((b) => b.status === "completed");

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
            bookingsCount={profileData.bookings.pagination.totalItems}
            activeBookingsCount={activeBookingsCount}
            onSendMessage={handleSendMessage}
            sendingMessage={sendingMessage}
          />
          <CustomerProfileTabs
            shopId={shopId}
            customerAddress={customerAddress}
            analytics={analytics}
            customerBalance={customer.currentBalance ?? 0}
            customerTier={customer.tier}
            initialBookings={profileData.bookings}
            initialTransactions={profileData.transactions}
            selectedBookingId={selectedBookingId}
            onSelectBooking={setSelectedBookingId}
            onBookingsLoaded={handleBookingsLoaded}
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
