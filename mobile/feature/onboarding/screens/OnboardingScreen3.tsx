import React, { useState, useRef, useCallback } from "react";
import { Text, View, ImageBackground } from "react-native";
import { useConnect } from "thirdweb/react";
import { client } from "@/shared/constants/thirdweb";
import { createWallet, walletConnect } from "thirdweb/wallets";

import { useAuth } from "@/shared/hooks/auth/useAuth";
import { ThemedButton } from "@/shared/components/ui/ThemedButton";
import WalletSelectionModal from "@/shared/components/wallet/WalletSelectionModal";

const globe = require("@/assets/images/global_spin.png");

interface OnboardingStep3Props {
  slideIndex?: number;
}

export default function OnboardingScreen3({
  slideIndex = 2,
}: OnboardingStep3Props) {
  return (
    <ImageBackground
      source={globe}
      resizeMode="cover"
      className="h-full w-full px-8"
    >
      <View className="mt-auto mb-20 h-[28%] w-full bg-black rounded-3xl px-6 py-4">
        <Text className="text-white text-3xl font-bold">
          One Community,{"\n"}Endless Rewards
        </Text>
        <Text className="text-gray-400 mt-4">
          From phones to cars to salons — RepairCoin is{"\n"}changing how the
          world sees loyalty.
        </Text>

        <View className="flex-row justify-between mt-auto items-center pt-6">
          <View className="flex-row gap-2 items-center">
            <View
              className={`h-2 ${slideIndex === 0 ? "w-10" : "w-2"} rounded-full bg-[#FFCC00] ${slideIndex === 0 ? "" : "opacity-50"}`}
            />
            <View
              className={`h-2 ${slideIndex === 1 ? "w-10" : "w-2"} rounded-full bg-[#FFCC00] ${slideIndex === 1 ? "" : "opacity-50"}`}
            />
            <View
              className={`h-2 ${slideIndex === 2 ? "w-10" : "w-2"} rounded-full bg-[#FFCC00] ${slideIndex === 2 ? "" : "opacity-50"}`}
            />
          </View>

          <View className="flex-row gap-4 items-center">
            <ConnectWithMetaMask />
          </View>
        </View>
      </View>
    </ImageBackground>
  );
}

const ConnectWithMetaMask = () => {
  const { connect } = useConnect();
  const { useConnectWallet } = useAuth();
  const connectWalletMutation = useConnectWallet();
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [connectingWallet, setConnectingWallet] = useState<string>();
  const [isLocalConnecting, setIsLocalConnecting] = useState(false);
  const isCancelledRef = useRef(false);

  const handleCancel = useCallback(() => {
    isCancelledRef.current = true;
    setConnectingWallet(undefined);
    setIsLocalConnecting(false);
    setShowWalletModal(false);
  }, []);

  const handleWalletSelection = async (walletId: string) => {
    setConnectingWallet(walletId);
    setIsLocalConnecting(true);
    isCancelledRef.current = false;

    try {
      await connect(async () => {
        let w;
        switch (walletId) {
          // Social Login Options
          case "google":
            w = createWallet("inApp");
            await w.connect({
              client,
              strategy: "google",
            });
            break;

          // Wallet Apps
          case "metamask":
            w = createWallet("io.metamask");
            await w.connect({ client });
            break;

          case "walletconnect":
            w = walletConnect();
            await w.connect({ client });
            break;

          case "coinbase":
            w = createWallet("com.coinbase.wallet");
            await w.connect({ client });
            break;

          case "rainbow":
            w = createWallet("me.rainbow");
            await w.connect({ client });
            break;

          default:
            // Default to Google login
            w = createWallet("inApp");
            await w.connect({
              client,
              strategy: "google",
            });
        }

        // Check if cancelled while connecting
        if (isCancelledRef.current) {
          throw new Error("Connection cancelled");
        }

        // Get the wallet address after successful connection
        const account = w.getAccount();
        if (account) {
          const address = account.address;
          console.log(
            `[ConnectWallet] ${walletId} connected successfully:`,
            address
          );

          // Check customer data with the connected address
          connectWalletMutation.mutate(address);
          setShowWalletModal(false);
        }

        return w;
      });
    } catch (error) {
      if (!isCancelledRef.current) {
        console.error(`Failed to connect with ${walletId}:`, error);
      }
    } finally {
      setConnectingWallet(undefined);
      setIsLocalConnecting(false);
    }
  };

  // Use local state to control UI, so we can cancel and reset
  const showLoading = isLocalConnecting || connectWalletMutation.isPending;

  return (
    <>
      <ThemedButton
        title="Connect"
        variant="primary"
        loading={showLoading}
        loadingTitle="Connecting..."
        onPress={() => setShowWalletModal(true)}
      />

      <WalletSelectionModal
        visible={showWalletModal}
        onClose={handleCancel}
        onSelectWallet={handleWalletSelection}
        isConnecting={showLoading}
        connectingWallet={connectingWallet}
      />
    </>
  );
};