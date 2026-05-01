import { useActiveAccount, useConnect } from "thirdweb/react";
import { createWallet } from "thirdweb/wallets";
import { client } from "@/shared/constants/thirdweb";
import { useAuthStore, AuthMethod } from "@/feature/auth/store/auth.store";

export interface SignatureParams {
  sessionId: string;
  customerAddress: string;
  shopId: string;
  amount: number;
  expiresAt: string;
}

// Maps auth method to the wallet strategy needed for reconnection
const AUTH_METHOD_STRATEGIES: Record<string, string> = {
  google: "google",
};

export const useRedemptionSignature = () => {
  const activeAccount = useActiveAccount();
  const { connect } = useConnect();
  const authMethod = useAuthStore((state) => state.authMethod);

  const reconnectWallet = async (): Promise<any> => {
    if (!authMethod) return null;

    const strategy = AUTH_METHOD_STRATEGIES[authMethod];
    if (!strategy) {
      // External wallets (metamask, walletconnect, etc.) — can't silently reconnect
      console.log("[useRedemptionSignature] External wallet, cannot auto-reconnect");
      return null;
    }

    try {
      console.log("[useRedemptionSignature] Attempting wallet reconnection via", authMethod);
      const wallet = createWallet("inApp");
      await connect(async () => {
        await wallet.connect({
          client,
          strategy: strategy as any,
        });
        return wallet;
      });
      const account = wallet.getAccount();
      console.log("[useRedemptionSignature] Wallet reconnected:", account?.address);
      return account;
    } catch (error) {
      console.error("[useRedemptionSignature] Reconnection failed:", error);
      return null;
    }
  };

  const generateSignature = async (params: SignatureParams): Promise<string | null> => {
    const { sessionId, customerAddress, shopId, amount, expiresAt } = params;

    try {
      // Use active account, or try to reconnect if null
      let account = activeAccount;
      if (!account) {
        console.log("[useRedemptionSignature] No active account, attempting reconnection...");
        account = await reconnectWallet();
      }

      if (!account) {
        console.error("[useRedemptionSignature] No account connected");
        return null;
      }

      // Create the message to sign - MUST match backend format exactly
      const message = `FixFlow Redemption Request

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
    account: activeAccount,
    isConnected: !!activeAccount
  };
};
