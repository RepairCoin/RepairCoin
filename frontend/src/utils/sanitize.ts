/**
 * Utility functions for sanitizing user input to prevent XSS attacks
 */

/**
 * Strips all HTML tags from a string to prevent XSS attacks
 * Preserves line breaks by keeping the text content
 * @param text - The text to sanitize
 * @returns Sanitized text with HTML tags removed
 */
export function stripHtmlTags(text: string | null | undefined): string {
  if (!text) return '';
  // Remove all HTML tags
  return text.replace(/<[^>]*>/g, '');
}

/**
 * Sanitizes description text for safe display
 * - Strips HTML tags to prevent XSS
 * - Returns empty string for null/undefined
 * @param description - The description to sanitize
 * @returns Sanitized description safe for display
 */
export function sanitizeDescription(description: string | null | undefined): string {
  return stripHtmlTags(description);
}
