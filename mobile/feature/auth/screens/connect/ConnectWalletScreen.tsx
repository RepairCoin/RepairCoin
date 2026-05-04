import React, { useState, useRef, useCallback } from "react";
import { Text, View, ActivityIndicator } from "react-native";
import { useConnect } from "thirdweb/react";
import { createWallet, walletConnect } from "thirdweb/wallets";
import { getUserEmail } from "thirdweb/wallets/in-app";
import { useAuthStore, AuthMethod } from "@/feature/auth/store/auth.store";
import { useConnectWallet } from "@/feature/auth/hooks/useAuthQuery";
import { ThemedButton } from "@/shared/components/ui/ThemedButton";
import VideoBackground from "@/shared/components/ui/VideoBackground";
import WalletSelectionModal from "@/shared/components/wallet/WalletSelectionModal";
import { client } from "@/shared/constants/thirdweb";

const video = require("@/assets/clips/onboarding1.mp4");

export default function ConnectWalletScreen() {
  const { isLoading } = useAuthStore();
  const { connect } = useConnect();
  const connectWalletMutation = useConnectWallet();
  const setAuthMethod = useAuthStore((state) => state.setAuthMethod);
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
          case "google":
            w = createWallet("inApp");
            await w.connect({
              client,
              strategy: "google",
            });
            break;
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
            w = createWallet("inApp");
            await w.connect({
              client,
              strategy: "google",
            });
        }

        if (isCancelledRef.current) {
          throw new Error("Connection cancelled");
        }

        const account = w.getAccount();
        if (account) {
          const address = account.address;

          let email: string | undefined;
          if (walletId === "google") {
            try {
              email = await getUserEmail({ client });
            } catch (err) {
              console.log("[ConnectWallet] Could not get email:", err);
            }
          }

          setAuthMethod(walletId as AuthMethod);
          connectWalletMutation.mutate({ address, email });
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

  const showLoading = isLocalConnecting || connectWalletMutation.isPending;

  if (isLoading) {
    return (
      <View className="h-full w-full bg-black items-center justify-center px-8">
        <ActivityIndicator size="large" color="#FFCC00" />
      </View>
    );
  }

  return (
    <VideoBackground source={video}>
      <View className="h-full w-full px-8">
        <View className="mt-auto mb-20 h-[28%] w-full bg-black rounded-3xl p-6 flex flex-col justify-between">
          <View>
            <Text className="text-white text-2xl font-bold">
              Ready to Earn?{"\n"}Connect and Explore
            </Text>
            <Text className="text-gray-400 mt-4">
              Tap to connect, earn, and use your rewards across all your favorite
              services.
            </Text>
          </View>

          <View className="flex-row justify-end items-center">
            <ThemedButton
              title="Connect"
              variant="primary"
              loading={showLoading}
              loadingTitle="Connecting..."
              onPress={() => setShowWalletModal(true)}
            />
          </View>
        </View>
      </View>

      <WalletSelectionModal
        visible={showWalletModal}
        onClose={handleCancel}
        onSelectWallet={handleWalletSelection}
        isConnecting={showLoading}
        connectingWallet={connectingWallet}
      />
    </VideoBackground>
  );
}
