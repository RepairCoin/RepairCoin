import {
  getApiErrorCode,
  getApiErrorMessage,
  getApiErrorStatus,
} from "./apiError";

/**
 * Shop write endpoints (buy RCN, issue reward, …) sit behind the same stack of
 * gates, and every one of them answers 403 with the real reason in the body:
 *
 *   requireRole            -> code: INSUFFICIENT_PERMISSIONS
 *   requireShopOwnership   -> code: SHOP_ACCESS_DENIED
 *   requireShopPermission  -> "Permission denied. Required permission: <slug>"
 *   requireActiveSubscription -> code: SUBSCRIPTION_PAUSED | _CANCELLED | _REQUIRED | _OVERDUE
 *
 * Without this mapping the UI shows axios's "Request failed with status code 403",
 * which tells the shop nothing about what to fix.
 */
export interface ShopActionErrorOptions {
  /** Verb phrase describing the blocked action, e.g. "buy RCN", "issue rewards". */
  action: string;
  /** What the owner has to grant, e.g. "billing access", "Issue Rewards access". */
  permissionHint?: string;
  /** Message when nothing more specific is available. */
  fallback?: string;
}

export function getShopActionErrorMessage(
  error: any,
  { action, permissionHint, fallback }: ShopActionErrorOptions,
): string {
  const status = getApiErrorStatus(error);

  if (status === 401) {
    return "Your session expired. Please log in again.";
  }

  if (status === 403) {
    const code = getApiErrorCode(error);
    const backendMessage = getApiErrorMessage(error, "");

    switch (code) {
      case "SUBSCRIPTION_PAUSED":
        return `Your subscription is paused by the administrator. You can't ${action} until it's resumed.`;
      case "SUBSCRIPTION_CANCELLED":
        return `Your subscription was cancelled due to non-payment. Reactivate it to ${action}.`;
      case "SUBSCRIPTION_REQUIRED":
        return `An active subscription is required to ${action}.`;
      case "SUBSCRIPTION_OVERDUE":
        return `Your subscription payment is overdue. Settle it to ${action}.`;
      case "SHOP_ACCESS_DENIED":
        return "This account doesn't have access to that shop. Please log in with the right shop account.";
    }

    // The permission gate phrases its error for developers
    // ("Permission denied. Required permission: rewards:issue") — say what the
    // shop user can actually do about it.
    if (/permission denied|insufficient permissions/i.test(backendMessage)) {
      return permissionHint
        ? `Your account doesn't have permission to ${action}. Ask the shop owner for ${permissionHint}.`
        : `Your account doesn't have permission to ${action}.`;
    }

    return backendMessage || `You don't have permission to ${action}.`;
  }

  return getApiErrorMessage(error, fallback);
}
