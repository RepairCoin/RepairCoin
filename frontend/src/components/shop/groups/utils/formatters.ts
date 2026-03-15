/**
 * Formatting utility functions for the Groups feature
 */

export interface DateFormatOptions {
  includeTime?: boolean;
  shortFormat?: boolean;
}

/**
 * Format a date string for display
 * @param dateString - ISO date string
 * @param options - Formatting options
 * @returns Formatted date string
 */
export function formatDate(dateString: string | null | undefined, options: DateFormatOptions = {}): string {
  if (!dateString) return "Never";

  const date = new Date(dateString);

  if (options.shortFormat) {
    return date.toLocaleDateString("en-US", {
      month: "numeric",
      day: "numeric",
      year: "numeric",
    });
  }

  if (options.includeTime) {
    return `${date.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    })}, ${date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "short",
    })}`;
  }

  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Format a date string to locale string (date and time)
 * @param dateString - ISO date string
 * @returns Formatted locale string
 */
export function formatDateTime(dateString: string): string {
  return new Date(dateString).toLocaleString();
}

/**
 * Format a wallet address for display (truncated)
 * @param address - Full wallet address
 * @param startChars - Number of characters to show at start (default: 6)
 * @param endChars - Number of characters to show at end (default: 4)
 * @returns Truncated address string
 */
export function formatAddress(address: string, startChars = 6, endChars = 4): string {
  if (!address) return "";
  if (address.length <= startChars + endChars) return address;
  return `${address.slice(0, startChars)}...${address.slice(-endChars)}`;
}

/**
 * Format a number with locale-aware formatting
 * @param value - Number to format
 * @param decimals - Number of decimal places (optional)
 * @returns Formatted number string
 */
export function formatNumber(value: number, decimals?: number): string {
  if (decimals !== undefined) {
    return value.toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  }
  return value.toLocaleString();
}

/**
 * Format a currency value
 * @param value - Number to format
 * @param currency - Currency code (default: "USD")
 * @returns Formatted currency string
 */
export function formatCurrency(value: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(value);
}

/**
 * Format a percentage value
 * @param value - Number to format (0-100)
 * @param decimals - Number of decimal places (default: 1)
 * @returns Formatted percentage string
 */
export function formatPercentage(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`;
}

/**
 * Format a transaction ID for display (truncated)
 * @param id - Full transaction ID
 * @param length - Number of characters to show (default: 12)
 * @returns Truncated ID string
 */
export function formatTransactionId(id: string, length = 12): string {
  if (!id) return "";
  if (id.length <= length) return id;
  return `${id.slice(0, length)}...`;
}
