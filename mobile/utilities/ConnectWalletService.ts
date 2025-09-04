import { ThirdWebStrategy } from "./GlobalTypes";
import { createThirdwebClient } from "thirdweb";
import { inAppWallet } from "thirdweb/wallets";

export const ConnectWalletService = async (strategy: ThirdWebStrategy) => {
  const client = createThirdwebClient({
    clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID ||
      "1969ac335e07ba13ad0f8d1a1de4f6ab",
  });
  const wallet = inAppWallet();

  const account = await wallet.connect({
    client,
    strategy: strategy,
  });

  console.log("Connected as:", account?.address);
};