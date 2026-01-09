import {
  ShopAvailability,
  TimeSlotConfig,
} from "@/interfaces/appointment.interface";

export type ServiceStatusFilter = "all" | "active" | "inactive";
export type AvailabilityTab = "hours" | "settings";

export interface PendingAvailabilityChanges {
  availability: ShopAvailability[];
  timeSlotConfig: TimeSlotConfig | null;
  hasChanges: boolean;
}

export interface ServiceFormData {
  serviceName: string;
  category: string;
  description: string;
  priceUsd: string;
  imageUrl: string;
  tags: string;
  active: boolean;
}

export interface SubmitFormParams {
  isQualified: boolean;
  isEditMode: boolean;
  serviceId?: string;
  onNotQualified: () => void;
  onSuccess: () => void;
}
