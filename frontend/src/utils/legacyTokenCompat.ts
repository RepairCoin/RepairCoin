/**
 * TEMPORARY Legacy Token Compatibility Layer
 *
 * This file provides backward compatibility for components still using
 * localStorage.getItem('*AuthToken'). It returns null and logs warnings.
 *
 * ⚠️ THIS IS TEMPORARY - Components should be updated to use apiClient directly
 *
 * Migration Path:
 * 1. Replace localStorage.getItem calls with getLegacyTokenCompat
 * 2. Update component to use apiClient instead
 * 3. Remove getLegacyTokenCompat call
 */

let hasWarned = false;

/**
 * Temporary compatibility function for components still checking localStorage for tokens
 *
 * @deprecated Components should use apiClient directly - cookies are sent automatically
 * @returns null - tokens are in httpOnly cookies and cannot be accessed
 */
export const getLegacyTokenCompat = (
  type?: 'admin' | 'shop' | 'customer' | 'generic'
): string | null => {
  if (!hasWarned) {
    console.warn(
      '%c⚠️ MIGRATION NEEDED',
      'background: #FFA500; color: white; padding: 4px 8px; border-radius: 3px; font-weight: bold;',
      '\n\nThis component is using getLegacyTokenCompat().',
      '\n\n✅ FIX: Replace localStorage token access with apiClient:',
      '\n\nimport apiClient from \'@/services/api/client\';',
      '\nconst response = await apiClient.get(\'/your-endpoint\');',
      '\n\nCookies are sent automatically - no manual token management needed!',
      '\n\nSee: frontend/COOKIE_AUTH_MIGRATION_GUIDE.md'
    );
    hasWarned = true;
  }

  // Return null - tokens are in httpOnly cookies
  return null;
};

/**
 * Check if authenticated using authStore
 * Components should use this instead of checking localStorage
 */
export const useIsAuthenticated = (): boolean => {
  // This would need to be a hook, but for compatibility we return false
  console.warn('[COMPAT] Use useAuthStore hook instead');
  return false;
};

/**
 * Helper to show migration warning once per session
 */
export const showMigrationWarning = (componentName: string): void => {
  const key = `migration_warning_${componentName}`;

  if (!sessionStorage.getItem(key)) {
    console.warn(
      `[MIGRATION] ${componentName} needs updating to use cookie-based auth.`,
      '\nSee: frontend/COOKIE_AUTH_MIGRATION_GUIDE.md'
    );
    sessionStorage.setItem(key, 'shown');
  }
};
