export const COMPANY_SIZE_OPTIONS = [
  { value: '1-10', label: '1-10 employees' },
  { value: '11-50', label: '11-50 employees' },
  { value: '51-100', label: '51-100 employees' },
  { value: '100+', label: '100+ employees' },
];

export const MONTHLY_REVENUE_OPTIONS = [
  { value: '<10k', label: 'Less than $10,000' },
  { value: '10k-50k', label: '$10,000 - $50,000' },
  { value: '50k-100k', label: '$50,000 - $100,000' },
  { value: '100k+', label: 'More than $100,000' },
];

export const SHOP_REGISTRATION_MESSAGES = {
  WALLET_NOT_CONNECTED: 'Please connect your wallet to register',
  CHECKING_STATUS: 'Checking registration status...',
  ALREADY_VERIFIED: 'Shop Already Verified',
  APPLICATION_PENDING: 'Application Pending',
  REGISTRATION_SUCCESS: 'Shop registration submitted successfully! Your application is pending approval.',
  REGISTRATION_FAILED: 'Failed to register shop',
};

export const DISABLE_CONTENT = {
  // Account verification
  VERIFY_ACCOUNT: "Awaiting admin verification before this feature can be used.",
  // Active
  INACTIVE_ACCOUNT: "This feature is not available for inactive accounts.",
  // Active
  UNSUBSCRIBE : "This feature requires an active account subscription."
} as const;