import { createThirdwebClient } from "thirdweb";

// RCN Token Client (primary)
export const rcnClient = createThirdwebClient({
  clientId: process.env.NEXT_PUBLIC_RCN_THIRDWEB_CLIENT_ID || process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID || "1969ac335e07ba13ad0f8d1a1de4f6ab",
});

// RCG Token Client (governance - for future use)
export const rcgClient = createThirdwebClient({
  clientId: process.env.NEXT_PUBLIC_RCG_THIRDWEB_CLIENT_ID || "99f01d5781fadab9f6a42660090e824b",
});

// Default client for backward compatibility
export const client = rcnClient;