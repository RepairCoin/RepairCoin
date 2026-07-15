export type ShopAccessErrorCode =
  | 'SHOP_SUSPENDED'
  | 'SHOP_NOT_VERIFIED'
  | 'SHOP_INACTIVE'
  | 'SUBSCRIPTION_EXPIRED'
  | 'SUBSCRIPTION_INACTIVE';

export const SHOP_ACCESS_ERROR_CODES: readonly ShopAccessErrorCode[] = [
  'SHOP_SUSPENDED',
  'SHOP_NOT_VERIFIED',
  'SHOP_INACTIVE',
  'SUBSCRIPTION_EXPIRED',
  'SUBSCRIPTION_INACTIVE',
];

export function isShopAccessErrorCode(
  code: unknown
): code is ShopAccessErrorCode {
  return (
    typeof code === 'string' &&
    (SHOP_ACCESS_ERROR_CODES as readonly string[]).includes(code)
  );
}

export function getShopAccessMessage(code: ShopAccessErrorCode): {
  title: string;
  message: string;
} {
  switch (code) {
    case 'SHOP_SUSPENDED':
      return {
        title: 'Account suspended',
        message:
          'Your shop has been suspended. Contact support or submit an unsuspend request.',
      };
    case 'SHOP_NOT_VERIFIED':
      return {
        title: 'Pending verification',
        message:
          "Your shop is awaiting admin approval. You'll be notified once verified.",
      };
    case 'SHOP_INACTIVE':
      return {
        title: 'Account inactive',
        message: 'Your shop account is inactive. Please contact support.',
      };
    case 'SUBSCRIPTION_EXPIRED':
      return {
        title: 'Subscription expired',
        message:
          'Your subscription has expired. Renew your subscription to continue operations.',
      };
    case 'SUBSCRIPTION_INACTIVE':
      return {
        title: 'Subscription required',
        message:
          'An active FixFlow subscription is required to perform this action.',
      };
  }
}
