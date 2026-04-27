import React from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  Image,
  TouchableOpacity,
  Modal,
} from "react-native";
import { router } from "expo-router";
import { Feather, Ionicons } from "@expo/vector-icons";
import { ThemedView } from "@/shared/components/ui/ThemedView";
import { AppHeader } from "@/shared/components/ui/AppHeader";
import {
  MarkNoShowModal,
  RescheduleModal,
  BookingTimeline,
  InfoRow,
  StatusBanner,
  ShopActions,
  CustomerActions,
} from "../components";
import { BookingStatus } from "@/shared/interfaces/booking.interfaces";
import { getCategoryLabel } from "@/shared/utilities/getCategoryLabel";
import { useBookingDetail } from "../hooks/ui/useBookingDetail";

// --- Formatters ---

const formatDate = (dateString: string) => {
  if (!dateString) return "N/A";
  return new Date(dateString).toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });
};

const formatTime = (dateString: string) => {
  if (!dateString) return "N/A";
  return new Date(dateString).toLocaleTimeString("en-US", {
    hour: "numeric", minute: "2-digit", hour12: true,
  });
};

const truncateAddress = (address: string) => {
  if (!address) return "N/A";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

const getStatusLabel = (status: BookingStatus, shopApproved?: boolean) => {
  switch (status) {
    case "pending": return "Pending Payment";
    case "paid": return shopApproved ? "Approved - In Progress" : "Paid - Awaiting Approval";
    case "completed": return "Completed";
    case "cancelled": return "Cancelled";
    case "refunded": return "Refunded";
    case "expired": return "Expired";
    default: return status;
  }
};

// --- Screen ---

export default function BookingDetailScreen() {
  const {
    booking, isLoading, error, isShopView, isApproved,
    isOrderExpired, isBookingExpired, imageSource,
    statusColor, bookingDateTime, hasShopActions, hasCustomerActions,
    isActionLoading,
    showCancelModal, setShowCancelModal,
    showNoShowModal, setShowNoShowModal,
    showRescheduleModal, setShowRescheduleModal,
    showCustomerRescheduleModal, setShowCustomerRescheduleModal,
    cancelIsPending, noShowIsPending, rescheduleIsPending, customerRescheduleIsPending,
    handleApprove, handleMarkComplete,
    handleCancelBooking, confirmCancel, handleMarkNoShow,
    handleReschedule, handleCustomerRescheduleRequest,
    handleWriteReview, handleBookAgain,
  } = useBookingDetail();

  if (isLoading) {
    return (
      <ThemedView className="flex-1">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#FFCC00" />
        </View>
      </ThemedView>
    );
  }

  if (error || !booking) {
    return (
      <ThemedView className="flex-1">
        <View className="flex-1 items-center justify-center px-4">
          <Ionicons name="alert-circle-outline" size={64} color="#ef4444" />
          <Text className="text-white text-lg font-semibold mt-4">Booking Not Found</Text>
          <Text className="text-gray-400 text-center mt-2">
            The booking you're looking for doesn't exist or has been removed.
          </Text>
          <TouchableOpacity onPress={() => router.back()} className="mt-6 bg-[#FFCC00] px-6 py-3 rounded-xl">
            <Text className="text-black font-semibold">Go Back</Text>
          </TouchableOpacity>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView className="flex-1">
      <AppHeader title="Booking Details" />
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>

        {/* Service Image Hero */}
        <View className="px-4 mb-4">
          {imageSource ? (
            <View className="relative">
              <Image source={imageSource} className="w-full h-52 rounded-2xl" resizeMode="cover" />
              {booking.rcnEarned > 0 && (
                <View className="absolute bottom-3 right-3 bg-black/70 px-3 py-1.5 rounded-full flex-row items-center">
                  <Ionicons name="sparkles" size={14} color="#FFCC00" />
                  <Text className="text-[#FFCC00] text-xs font-bold ml-1">+{booking.rcnEarned} RCN</Text>
                </View>
              )}
            </View>
          ) : (
            <View className="w-full h-36 rounded-2xl bg-[#1a1a1a] items-center justify-center">
              <Ionicons name="cube-outline" size={48} color="#333" />
            </View>
          )}
        </View>

        {/* Service Info */}
        <View className="mx-4 mb-2">
          <Text className="text-white text-2xl font-bold">{booking.serviceName}</Text>
          {booking.serviceCategory && (
            <Text className="text-gray-500 text-sm mt-1">
              {getCategoryLabel(booking.serviceCategory)}{booking.serviceDuration ? ` • ${booking.serviceDuration} min` : ""}
            </Text>
          )}
          {booking.serviceDescription && (
            <Text className="text-gray-400 text-sm leading-5 mt-2">{booking.serviceDescription}</Text>
          )}
        </View>

        {/* Timeline */}
        <View className="mx-4 mb-4">
          <BookingTimeline
            currentStatus={booking.status}
            shopApproved={booking.shopApproved}
            bookingDate={booking.bookingDate}
            completedAt={booking.completedAt}
            approvedAt={booking.approvedAt}
            createdAt={booking.createdAt}
          />
        </View>

        {/* Customer/Shop Info Card */}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => {
            if (isShopView) {
              router.push(`/shop/profile/customer-profile/${booking.customerAddress}` as any);
            }
          }}
          className="mx-4 mb-4 bg-[#1a1a1a] rounded-xl p-4"
        >
          <Text className="text-gray-500 text-xs uppercase tracking-wider mb-3 font-medium">
            {isShopView ? "Customer Information" : "Shop Information"}
          </Text>
          <View className="flex-row items-center">
            <View className="w-12 h-12 rounded-full bg-[#FFCC00]/10 items-center justify-center">
              <Feather name={isShopView ? "user" : "shopping-bag"} size={20} color="#FFCC00" />
            </View>
            <View className="ml-3 flex-1">
              {isShopView ? (
                <>
                  <Text className="text-white font-semibold text-base">{booking.customerName || "Anonymous Customer"}</Text>
                  <Text className="text-gray-500 text-xs font-mono mt-0.5">{truncateAddress(booking.customerAddress)}</Text>
                </>
              ) : (
                <>
                  <Text className="text-white font-semibold text-base">{booking.shopName || "Shop"}</Text>
                  {booking.shopAddress && <Text className="text-gray-400 text-xs mt-0.5" numberOfLines={1}>{booking.shopAddress}</Text>}
                  {booking.shopPhone && (
                    <View className="flex-row items-center mt-1">
                      <Feather name="phone" size={11} color="#6B7280" />
                      <Text className="text-gray-400 text-xs ml-1">{booking.shopPhone}</Text>
                    </View>
                  )}
                </>
              )}
            </View>
            {isShopView && (
              <Ionicons name="chevron-forward" size={18} color="#666" />
            )}
          </View>
        </TouchableOpacity>

        {/* Booking Details Card */}
        <View className="mx-4 mb-4 bg-[#1a1a1a] rounded-xl p-4">
          <Text className="text-gray-500 text-xs uppercase tracking-wider mb-2 font-medium">Booking Details</Text>
          <InfoRow icon={<Feather name="calendar" size={16} color="#FFCC00" />} label="Date" value={formatDate(bookingDateTime)} />
          <InfoRow icon={<Feather name="clock" size={16} color="#FFCC00" />} label="Time" value={formatTime(bookingDateTime)} />
          <InfoRow icon={<Feather name="hash" size={16} color="#6B7280" />} label="Booking ID" value={`BK-${booking.orderId.replace(/-/g, '').slice(-6).toUpperCase()}`} />
          <View className="flex-row items-center py-3.5">
            <View className="w-9 h-9 items-center justify-center">
              <Feather name="activity" size={16} color="#6B7280" />
            </View>
            <Text className="text-gray-400 flex-1 text-sm">Status</Text>
            <View className="flex-row items-center px-2.5 py-1 rounded-full" style={{ backgroundColor: statusColor + "20" }}>
              <View className="w-1.5 h-1.5 rounded-full mr-1.5" style={{ backgroundColor: statusColor }} />
              <Text className="text-xs font-semibold" style={{ color: statusColor }}>{getStatusLabel(booking.status, booking.shopApproved)}</Text>
            </View>
          </View>
          {booking.completedAt && <InfoRow icon={<Feather name="check-circle" size={16} color="#22c55e" />} label="Completed" value={formatDate(booking.completedAt)} valueColor="#22c55e" />}
        </View>

        {/* Payment Card */}
        <View className="mx-4 mb-4 bg-[#1a1a1a] rounded-xl p-4">
          <Text className="text-gray-500 text-xs uppercase tracking-wider mb-2 font-medium">Payment & Rewards</Text>
          <View className="flex-row items-center justify-between py-4 border-b border-gray-800/50">
            <Text className="text-gray-400 text-sm">Total Amount</Text>
            <Text className="text-[#FFCC00] text-2xl font-bold">${booking.totalAmount.toFixed(2)}</Text>
          </View>
          <InfoRow icon={<Ionicons name="sparkles" size={16} color="#FFCC00" />} label="RCN Earned" value={`+${booking.rcnEarned} RCN`} valueColor="#FFCC00" />
          {booking.stripePaymentIntentId && (
            <View className="flex-row items-center py-3.5">
              <View className="w-9 h-9 rounded-lg bg-gray-800/50 items-center justify-center mr-3">
                <Feather name="credit-card" size={16} color="#6B7280" />
              </View>
              <Text className="text-gray-400 flex-1 text-sm">Payment Method</Text>
              <View className="flex-row items-center bg-[#635bff]/15 px-2.5 py-1 rounded-full">
                <Ionicons name="card" size={14} color="#635bff" />
                <Text className="text-[#635bff] font-semibold text-xs ml-1">Stripe</Text>
              </View>
            </View>
          )}
        </View>

        {/* Notes Card */}
        {booking.notes && (
          <View className="mx-4 mb-4 bg-[#1a1a1a] rounded-xl p-4">
            <Text className="text-gray-500 text-xs uppercase tracking-wider mb-2 font-medium">Customer Notes</Text>
            <Text className="text-gray-300 text-sm leading-5">{booking.notes}</Text>
          </View>
        )}

        {/* Shop Actions */}
        {hasShopActions && (
          <View className="mx-4 mb-8">
            <ShopActions
              status={booking.status}
              isApproved={isApproved}
              isActionLoading={isActionLoading}
              onApprove={handleApprove}
              onMarkComplete={handleMarkComplete}
              onCancel={handleCancelBooking}
              onReschedule={() => setShowRescheduleModal(true)}
              onNoShow={() => setShowNoShowModal(true)}
            />
          </View>
        )}

        {/* Customer Actions */}
        {hasCustomerActions && (
          <View className="mx-4 mb-8">
            <CustomerActions
              status={booking.status}
              isApproved={isApproved}
              isActionLoading={isActionLoading}
              rcnEarned={booking.rcnEarned}
              hasReview={booking.hasReview}
              onReschedule={() => setShowCustomerRescheduleModal(true)}
              onCancel={handleCancelBooking}
              onWriteReview={handleWriteReview}
              onBookAgain={handleBookAgain}
            />
          </View>
        )}

        {/* Status Banners */}
        {booking.status === "completed" && isShopView && (
          <StatusBanner icon="check-circle" color="#22c55e" bgColor="rgba(34,197,94,0.08)" borderColor="rgba(34,197,94,0.3)" title="Service Completed" subtitle="RCN rewards have been issued to the customer." />
        )}
        {booking.status === "cancelled" && (
          <StatusBanner icon="x-circle" color="#ef4444" bgColor="rgba(239,68,68,0.08)" borderColor="rgba(239,68,68,0.3)" title="Booking Cancelled" subtitle={isShopView ? "This booking has been cancelled." : "Your booking has been cancelled."} />
        )}
        {isShopView && (isOrderExpired || isBookingExpired) && (
          <StatusBanner icon="alert-circle" color="#f97316" bgColor="rgba(249,115,22,0.08)" borderColor="rgba(249,115,22,0.3)" title="Appointment Expired" subtitle={isOrderExpired ? "Refunds have been processed automatically." : "Past the 24-hour completion window."} />
        )}
        {!isShopView && (isOrderExpired || isBookingExpired) && (
          <StatusBanner icon="alert-circle" color="#f97316" bgColor="rgba(249,115,22,0.08)" borderColor="rgba(249,115,22,0.3)" title="Appointment Expired" subtitle={isOrderExpired ? "Any payments have been refunded." : "Please contact the shop for assistance."} />
        )}
      </ScrollView>

      {/* Cancel Modal */}
      <Modal visible={showCancelModal} transparent animationType="fade" onRequestClose={() => setShowCancelModal(false)}>
        <View className="flex-1 bg-black/70 items-center justify-center px-4">
          <View className="bg-[#1a1a1a] rounded-2xl p-6 w-full max-w-sm">
            <View className="items-center mb-4">
              <View className="w-16 h-16 rounded-full bg-red-900/30 items-center justify-center mb-3">
                <Feather name="alert-triangle" size={32} color="#ef4444" />
              </View>
              <Text className="text-white text-xl font-bold">Cancel Booking?</Text>
            </View>
            <Text className="text-gray-400 text-center mb-6">Are you sure? This action cannot be undone.</Text>
            <View className="flex-row space-x-3">
              <TouchableOpacity onPress={() => setShowCancelModal(false)} className="flex-1 py-3 rounded-xl border border-gray-700">
                <Text className="text-gray-300 font-semibold text-center">Keep Booking</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={confirmCancel} disabled={cancelIsPending} className="flex-1 py-3 rounded-xl bg-red-600">
                {cancelIsPending ? <ActivityIndicator size="small" color="#fff" /> : <Text className="text-white font-semibold text-center">Yes, Cancel</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* No-Show Modal */}
      <MarkNoShowModal visible={showNoShowModal} onClose={() => setShowNoShowModal(false)} onConfirm={handleMarkNoShow} isLoading={noShowIsPending} customerName={booking?.customerName || undefined} />

      {/* Reschedule Modal - Shop */}
      {booking && (
        <RescheduleModal visible={showRescheduleModal} onClose={() => setShowRescheduleModal(false)} onConfirm={handleReschedule} isLoading={rescheduleIsPending} shopId={booking.shopId} serviceId={booking.serviceId} currentDate={booking.bookingDate || undefined} currentTime={booking.bookingDate ? new Date(booking.bookingDate).toTimeString().slice(0, 5) : undefined} />
      )}

      {/* Reschedule Modal - Customer */}
      {booking && (
        <RescheduleModal visible={showCustomerRescheduleModal} onClose={() => setShowCustomerRescheduleModal(false)} onConfirm={handleCustomerRescheduleRequest} isLoading={customerRescheduleIsPending} shopId={booking.shopId} serviceId={booking.serviceId} currentDate={booking.bookingDate || undefined} currentTime={booking.bookingDate ? new Date(booking.bookingDate).toTimeString().slice(0, 5) : undefined} />
      )}
    </ThemedView>
  );
}
