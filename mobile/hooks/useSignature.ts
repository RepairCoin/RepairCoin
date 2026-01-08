import { useActiveAccount } from "thirdweb/react";

export interface SignatureParams {
  sessionId: string;
  customerAddress: string;
  shopId: string;
  amount: number;
  expiresAt: string;
}

export const useRedemptionSignature = () => {
  const account = useActiveAccount();

  const generateSignature = async (params: SignatureParams): Promise<string | null> => {
    const { sessionId, customerAddress, shopId, amount, expiresAt } = params;

    try {
      if (!account) {
        console.error("[useRedemptionSignature] No account connected");
        return null;
      }

      // Create the message to sign - MUST match backend format exactly
      const message = `RepairCoin Redemption Request

Session ID: ${sessionId}
Customer: ${customerAddress}
Shop: ${shopId}
Amount: ${amount} RCN
Expires: ${new Date(expiresAt).toISOString()}

By signing this message, I approve the redemption of ${amount} RCN tokens at the specified shop.`;

      console.log("[useRedemptionSignature] Message to sign:", message);

      // Try to sign the message using Thirdweb's account
      if (account.signMessage) {
        const signature = await account.signMessage({ message });
        console.log("[useRedemptionSignature] Signature generated:", signature);
        return signature;
      }

      console.error("[useRedemptionSignature] Account does not support signMessage");
      return null;
    } catch (error) {
      console.error("[useRedemptionSignature] Error:", error);
      return null;
    }
  };

  return {
    generateSignature,
    account,
    isConnected: !!account
  };
};
