import { EARTH_RADIUS_MILES } from "../constants";
import { ShopAvailability } from "@/shared/interfaces/appointment.interface";

/**
 * Calculate distance between two coordinates using Haversine formula
 * @returns Distance in miles
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_MILES * c;
}

/**
 * Build full address string from shop data
 */
export function buildFullAddress(
  address?: string,
  city?: string,
  state?: string
): string {
  let fullAddress = address || "";
  if (city) {
    fullAddress += ", " + city;
  }
  if (state) {
    fullAddress += ", " + state;
  }
  return fullAddress;
}

/**
 * Get today's availability from shop availability array
 */
export function getTodayAvailability(
  availability: ShopAvailability[]
): ShopAvailability | null {
  const today = new Date().getDay(); // 0 = Sunday, 6 = Saturday
  return availability.find((a) => a.dayOfWeek === today) || null;
}

/**
 * Format time from 24h to 12h format
 */
export function formatTime(time: string | null): string {
  if (!time) return "";
  const [hours, minutes] = time.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 || 12;
  return `${hour12}:${minutes.toString().padStart(2, "0")} ${period}`;
}

/**
 * Format shop hours for display
 */
export function formatShopHours(availability: ShopAvailability | null): string {
  if (!availability || !availability.isOpen) {
    return "Closed";
  }

  const open = formatTime(availability.openTime);
  const close = formatTime(availability.closeTime);

  if (availability.breakStartTime && availability.breakEndTime) {
    const breakStart = formatTime(availability.breakStartTime);
    const breakEnd = formatTime(availability.breakEndTime);
    return `${open} - ${breakStart}, ${breakEnd} - ${close}`;
  }

  return `${open} - ${close}`;
}

/**
 * Check if shop is currently open
 */
export function isShopOpen(availability: ShopAvailability | null): boolean {
  if (!availability || !availability.isOpen) {
    return false;
  }

  if (!availability.openTime || !availability.closeTime) {
    return false;
  }

  const now = new Date();
  const currentTime = now.getHours() * 60 + now.getMinutes();

  const [openHour, openMin] = availability.openTime.split(":").map(Number);
  const [closeHour, closeMin] = availability.closeTime.split(":").map(Number);
  const openTime = openHour * 60 + openMin;
  const closeTime = closeHour * 60 + closeMin;

  // Check if in break time
  if (availability.breakStartTime && availability.breakEndTime) {
    const [breakStartHour, breakStartMin] = availability.breakStartTime.split(":").map(Number);
    const [breakEndHour, breakEndMin] = availability.breakEndTime.split(":").map(Number);
    const breakStart = breakStartHour * 60 + breakStartMin;
    const breakEnd = breakEndHour * 60 + breakEndMin;

    if (currentTime >= breakStart && currentTime < breakEnd) {
      return false;
    }
  }

  return currentTime >= openTime && currentTime < closeTime;
}

/**
 * Get shop status text
 */
export function getShopStatus(availability: ShopAvailability | null): {
  isOpen: boolean;
  text: string;
  color: string;
} {
  if (!availability || !availability.isOpen) {
    return { isOpen: false, text: "Closed", color: "#EF4444" };
  }

  const open = isShopOpen(availability);

  if (open) {
    return { isOpen: true, text: "Open Now", color: "#22C55E" };
  }

  return { isOpen: false, text: "Closed", color: "#EF4444" };
}
