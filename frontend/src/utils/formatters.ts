/**
 * Formatting utilities for display purposes
 */

/**
 * Format a full order ID (UUID) to a short booking ID format
 * Example: ord_641a3283-da80-4ecc-83a2-553c79e1657a -> BK-E1657A
 */
export const formatBookingId = (orderId: string): string => {
  if (!orderId) return '';
  // Take last 6 characters of orderId (without dashes) and format as BK-XXXXXX
  const shortId = orderId.replace(/-/g, '').slice(-6).toUpperCase();
  return `BK-${shortId}`;
};
