import React, { useState, useRef, useCallback } from "react";
import { Text, View, ImageBackground, Image, Pressable } from "react-native";
import { useConnect } from "thirdweb/react";
import { client } from "@/shared/constants/thirdweb";
import { createWallet, walletConnect } from "thirdweb/wallets";
import { getUserEmail } from "thirdweb/wallets/in-app";
import { useAuthStore, AuthMethod } from "@/feature/auth/store/auth.store";
import { ThemedButton } from "@/shared/components/ui/ThemedButton";
import WalletSelectionModal from "@/shared/components/wallet/WalletSelectionModal";
import { useConnectWallet } from "@/feature/auth/hooks/useAuthQuery";
import Screen from "@/shared/components/ui/Screen";

export default function ConnectWalletScreen() {
  return (
    <Screen>
      <ImageBackground resizeMode="cover" className="h-full w-full px-8">
        <View className="px-6 pt-16 pb-20 w-full h-full items-center gap-16">
          <View className="w-full flex-1 items-center justify-center">
            <View className="items-center">
              <Image
                source={require("@/assets/images/logo2.png")}
                className="w-60 h-60"
                resizeMode="contain"
              />
              <Text className="text-[#ffffff] text-6xl italic font-bold">
                FixFlow
              </Text>
            </View>
            <Text className="text-[#ffffff] mt-10 text-center w-full">
              Discover, connect and earn RCN with trusted service providers, all
              in one platform
            </Text>
          </View>
          <View className="w-[90%]">
            <ConnectWithMetaMask />
          </View>
        </View>
      </ImageBackground>
    </Screen>
  );
}

const ConnectWithMetaMask = () => {
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

  return (
    <>
      <ThemedButton
        title="Connect"
        variant="primary"
        loading={showLoading}
        loadingTitle="Connecting..."
        onPress={() => setShowWalletModal(true)}
        customStyle={{ paddingVertical: 12, borderRadius: 12 }}
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
