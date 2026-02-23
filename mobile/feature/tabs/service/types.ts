import { BookingStatus } from "@/shared/interfaces/booking.interfaces";
import { ServiceData } from "@/shared/interfaces/service.interface";
import { MyAppointment } from "@/shared/interfaces/appointment.interface";

// Shop types
export type BookingFilterStatus = "all" | BookingStatus;

// Customer types
export type CustomerServiceTab = "Services" | "Favorites" | "Bookings";
export type ServiceStatusFilter = "all" | "available" | "unavailable";
export type BookingFilterTab = "upcoming" | "past" | "all";
export type BookingStatusFilter = "all" | "pending" | "paid" | "approved" | "completed" | "cancelled";

// Sorting options
export type ServiceSortOption =
  | "default"
  | "price_low"
  | "price_high"
  | "duration_short"
  | "duration_long"
  | "newest";

// Price range filter
export interface PriceRange {
  min: number | null;
  max: number | null;
}

// Customer component props
export interface CustomerServiceTabContainerProps {
  activeTab: CustomerServiceTab;
  onTabChange: (tab: CustomerServiceTab) => void;
}

export interface CustomerTabButtonProps {
  tab: CustomerServiceTab;
  isActive: boolean;
  onPress: () => void;
  isFirst: boolean;
  isLast: boolean;
}

export interface FilterChipProps {
  label: string;
  onRemove: () => void;
}

export interface AppointmentCardProps {
  appointment: MyAppointment;
  onPress: () => void;
  onCancel: () => void;
  onReview: () => void;
}

export interface CancelModalProps {
  visible: boolean;
  appointment: MyAppointment | null;
  isPending: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export interface BookingsEmptyStateProps {
  filterTab: BookingFilterTab;
}

export interface ServiceCardData {
  serviceId: string;
  serviceName: string;
  description: string;
  category?: string;
  priceUsd: number;
  durationMinutes?: number;
  imageUrl?: string;
  active: boolean;
}
