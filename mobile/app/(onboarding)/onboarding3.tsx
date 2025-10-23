import React from "react";
import { Text, View, ImageBackground } from "react-native";
import { useConnect, useActiveAccount } from "thirdweb/react";
import { client } from "@/constants/thirdweb";
import { createWallet } from "thirdweb/wallets";

import { ThemedButton } from "@/components/ui/ThemedButton";
import { useCustomer } from "@/hooks/useCustomerQueries";
import { useConnectWallet } from "@/hooks/useConnectWallet";

const globe = require("@/assets/images/global_spin.png");

interface OnboardingStep3Props {
  slideIndex?: number;
}

export default function OnboardingStep3({
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
	const { connect, isConnecting } = useConnect();
	const { checkWalletConnection } = useConnectWallet();
	
	return (
		<ThemedButton
			title="Connect"
			variant="primary"
			loading={isConnecting}
			loadingTitle="Connecting..."
			onPress={() => {
				connect(async () => {
					const w = createWallet("io.metamask");
					await w.connect({
						client,
					});
					
					// Get the wallet address after successful connection
					const account = w.getAccount();
					if (account) {
						const address = account.address;
						console.log('[ConnectWithMetaMask] Wallet connected successfully:', address);
						
						// Check customer data with the connected address
						await checkWalletConnection(address);
					}
					
					return w;
				});
			}}
		/>
	);
};
