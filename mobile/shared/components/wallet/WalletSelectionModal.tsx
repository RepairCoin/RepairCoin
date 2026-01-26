import React from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface WalletOption {
  id: string;
  name: string;
  icon: any;
  type: "wallet" | "social";
  available: boolean;
}

interface WalletSelectionModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectWallet: (walletId: string) => void;
  isConnecting: boolean;
  connectingWallet?: string;
}

const walletOptions: WalletOption[] = [
  {
    id: "google",
    name: "Google",
    icon: require("@/assets/icons/icons8-google-100.png"),
    type: "social",
    available: true,
  },
  {
    id: "metamask",
    name: "MetaMask",
    icon: require("@/assets/icons/icons8-metamask-100.png"),
    type: "wallet",
    available: true,
  },
];

export default function WalletSelectionModal({
  visible,
  onClose,
  onSelectWallet,
  isConnecting,
  connectingWallet,
}: WalletSelectionModalProps) {
  const socialOptions = walletOptions.filter((w) => w.type === "social");
  const walletAppOptions = walletOptions.filter((w) => w.type === "wallet");

  const renderWalletOption = (option: WalletOption) => {
    const isCurrentlyConnecting = isConnecting && connectingWallet === option.id;
    const isDisabled = !option.available || (isConnecting && connectingWallet !== option.id);

    return (
      <TouchableOpacity
        key={option.id}
        onPress={() => !isDisabled && onSelectWallet(option.id)}
        disabled={isDisabled}
        className={`bg-gray-800 rounded-xl p-4 mb-3 flex-row items-center justify-between ${
          isDisabled ? "opacity-50" : ""
        }`}
      >
        <View className="flex-row items-center">
          <Image source={option.icon} className="w-8 h-8 mr-3" />
          <View>
            <Text className="text-white font-semibold">{option.name}</Text>
            {!option.available && (
              <Text className="text-gray-500 text-xs">Not available in simulator</Text>
            )}
          </View>
        </View>
        {isCurrentlyConnecting ? (
          <ActivityIndicator size="small" color="#FFCC00" />
        ) : (
          <Ionicons name="chevron-forward" size={20} color="#666" />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-black/50 justify-end">
        <View className="bg-gray-900 rounded-t-3xl p-6 max-h-[80%]">
          <View className="flex-row justify-between items-center mb-6">
            <Text className="text-white text-2xl font-bold">Connect Wallet</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <Text className="text-gray-400 text-sm font-semibold mb-3 uppercase">
              Social Login
            </Text>
            {socialOptions.map(renderWalletOption)}

            <Text className="text-gray-400 text-sm font-semibold mb-3 mt-4 uppercase">
              Wallet Apps
            </Text>
            {walletAppOptions.map(renderWalletOption)}

            <Text className="text-gray-500 text-xs text-center mt-4">
              By connecting, you agree to RepairCoin's Terms of Service and Privacy Policy
            </Text>

            {isConnecting && (
              <TouchableOpacity
                onPress={onClose}
                className="bg-gray-700 rounded-xl py-3 mt-4"
              >
                <Text className="text-white text-center font-semibold">Cancel</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}


// import React, { useState } from "react";
// import { Text, View, ImageBackground } from "react-native";
// import { useConnect } from "thirdweb/react";
// import { client } from "@/shared/constants/thirdweb";
// import { createWallet, walletConnect } from "thirdweb/wallets";

// import { ThemedButton } from "@/shared/components/ui/ThemedButton";
// import { useConnectWallet } from "@/shared/useAuthQueries";
// import WalletSelectionModal from "@/shared/components/wallet/WalletSelectionModal";

// const globe = require("@/assets/images/global_spin.png");

// interface OnboardingStep3Props {
//   slideIndex?: number;
// }

// export default function OnboardingStep3({
//   slideIndex = 2,
// }: OnboardingStep3Props) {
//   return (
//     <ImageBackground
//       source={globe}
//       resizeMode="cover"
//       className="h-full w-full px-8"
//     >
//       <View className="mt-auto mb-20 h-[28%] w-full bg-black rounded-3xl px-6 py-4">
//         <Text className="text-white text-3xl font-bold">
//           One Community,{"\n"}Endless Rewards
//         </Text>
//         <Text className="text-gray-400 mt-4">
//           From phones to cars to salons — RepairCoin is{"\n"}changing how the
//           world sees loyalty.
//         </Text>

//         <View className="flex-row justify-between mt-auto items-center pt-6">
//           <View className="flex-row gap-2 items-center">
//             <View
//               className={`h-2 ${slideIndex === 0 ? "w-10" : "w-2"} rounded-full bg-[#FFCC00] ${slideIndex === 0 ? "" : "opacity-50"}`}
//             />
//             <View
//               className={`h-2 ${slideIndex === 1 ? "w-10" : "w-2"} rounded-full bg-[#FFCC00] ${slideIndex === 1 ? "" : "opacity-50"}`}
//             />
//             <View
//               className={`h-2 ${slideIndex === 2 ? "w-10" : "w-2"} rounded-full bg-[#FFCC00] ${slideIndex === 2 ? "" : "opacity-50"}`}
//             />
//           </View>

//           <View className="flex-row gap-4 items-center">
//             <ConnectWithMetaMask />
//           </View>
//         </View>
//       </View>
//     </ImageBackground>
//   );
// }

// const ConnectWithMetaMask = () => {
//   const { connect, isConnecting } = useConnect();
//   const connectWalletMutation = useConnectWallet();
//   const [showWalletModal, setShowWalletModal] = useState(false);
//   const [connectingWallet, setConnectingWallet] = useState<string>();

//   const handleWalletSelection = async (walletId: string) => {
//     setConnectingWallet(walletId);

//     try {
//       await connect(async () => {
//         let w;
//         switch (walletId) {
//           // Social Login Options
//           case "google":
//             w = createWallet("inApp");
//             await w.connect({
//               client,
//               strategy: "google",
//             });
//             break;

//           // Wallet Apps
//           case "metamask":
//             w = createWallet("io.metamask");
//             await w.connect({ client });
//             break;

//           case "walletconnect":
//             w = walletConnect();
//             await w.connect({ client });
//             break;

//           case "coinbase":
//             w = createWallet("com.coinbase.wallet");
//             await w.connect({ client });
//             break;

//           case "rainbow":
//             w = createWallet("me.rainbow");
//             await w.connect({ client });
//             break;

//           default:
//             // Default to Google login
//             w = createWallet("inApp");
//             await w.connect({
//               client,
//               strategy: "google",
//             });
//         }

//         // Get the wallet address after successful connection
//         const account = w.getAccount();
//         if (account) {
//           const address = account.address;
//           console.log(
//             `[ConnectWallet] ${walletId} connected successfully:`,
//             address
//           );

//           // Check customer data with the connected address
//           connectWalletMutation.mutate(address);
//           setShowWalletModal(false);
//         }

//         return w;
//       });
//     } catch (error) {
//       console.error(`Failed to connect with ${walletId}:`, error);
//     } finally {
//       setConnectingWallet(undefined);
//     }
//   };

//   return (
//     <>
//       <ThemedButton
//         title="Connect"
//         variant="primary"
//         loading={isConnecting || connectWalletMutation.isPending}
//         loadingTitle="Connecting..."
//         onPress={() => setShowWalletModal(true)}
//       />

//       <WalletSelectionModal
//         visible={showWalletModal}
//         onClose={() => !isConnecting && setShowWalletModal(false)}
//         onSelectWallet={handleWalletSelection}
//         isConnecting={isConnecting || connectWalletMutation.isPending}
//         connectingWallet={connectingWallet}
//       />
//     </>
//   );
// };
