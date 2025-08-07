// Redemption authorization types

export interface RedemptionRequest {
  customerAddress: string;
  shopId: string;
  amount: number;
  timestamp: string;
  nonce: string; // Prevent replay attacks
}

export interface SignedRedemptionRequest extends RedemptionRequest {
  signature: string; // Customer's signature of the request
}

export interface RedemptionSession {
  sessionId: string;
  customerAddress: string;
  shopId: string;
  maxAmount: number;
  expiresAt: Date;
  used: boolean;
}

// Example of how customer would sign a redemption request:
/*
const message = JSON.stringify({
  customerAddress,
  shopId,
  amount,
  timestamp: new Date().toISOString(),
  nonce: crypto.randomUUID()
});

const signature = await wallet.signMessage(message);
*/