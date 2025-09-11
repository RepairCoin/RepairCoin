import Screen from "@/components/Screen";
import { Text, View } from "react-native";
import { AntDesign } from "@expo/vector-icons";
import { goBack } from "expo-router/build/global-state/routing";
import LoginButton from "@/components/LoginButton";
import { router } from "expo-router";

export default function ConnectWalletPage() {
  const loginOptions = [
    {
      title: "Social Login",
      icon: require('@/assets/icons/icons8-at-sign-100.png'),
      className: "h-6 w-6",
      onPress: () => router.push("/auth/wallet/Social")
    },
    {
      title: "MetaMask",
      icon: require('@/assets/icons/icons8-metamask-100.png'),
      className: "h-6 w-6"
    },
    {
      title: "Coinbase Wallet",
      icon: require('@/assets/icons/icons8-coinbase-100.png'),
      className: "h-6 w-6"
    },
    {
      title: "Rainbow",
      icon: require('@/assets/icons/icons8-rainbow-100.png'),
      className: "h-6 w-6"
    },
    {
      title: "Rabby",
      icon: require('@/assets/icons/Rabby.png'),
      className: "h-6 w-6"
    },
    {
      title: "Zerion",
      icon: require('@/assets/icons/zerion.jpeg'),
      className: "h-6 w-6"
    },
    {
      title: "All Wallets 500+",
      icon: require('@/assets/icons/icons8-wallet-100.png'),
      className: "h-6 w-6"
    },
  ];

  return (
    <Screen>
      <View className="w-full h-full px-4">
        <View className="h-20" />
        <View className="mx-6 flex-row justify-between items-center">
          <AntDesign name="left" color="white" size={25} onPress={goBack} />
          <Text className="text-white text-[22px] font-extrabold">Sign In</Text>
          <View className="w-[25px]" />
        </View>

        <Text className="text-white text-[14px] text-center mt-8 mb-4">
          Access your account and unlock more benefits from{"\n"}
          every repair — sign in now to continue.
        </Text>

        <View className="flex-col items-center">
          {loginOptions.map((option, index) => (
            <LoginButton
              key={index}
              title={option.title}
              icon={option.icon}
              className={option.className}
              onPress={option.onPress}
            />
          ))}
        </View>
      </View>
    </Screen>
  );
}