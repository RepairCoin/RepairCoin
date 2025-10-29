import Screen from "@/components/ui/Screen";
import { Text, View } from "react-native";
import { AntDesign } from "@expo/vector-icons";
import { goBack } from "expo-router/build/global-state/routing";
import LoginButton from "@/components/ui/LoginButton";
import { router } from "expo-router";
import { externalWalletConnectService } from "@/services/RegisterServices";
import { WalletType } from "@/utilities/GlobalTypes";
import { useAuthStore } from "@/store/authStore";

export default function ConnectWalletPage() {
  const { account, setAccount, checkUserExists, login, isCustomer } =
    useAuthStore((state) => state);

  const loginOptions = [
    {
      title: "Social Login",
      icon: require("@/assets/icons/icons8-at-sign-100.png"),
      className: "h-6 w-6",
      onPress: () => router.push("/wallet/Social"),
    },
    {
      title: "MetaMask",
      icon: require("@/assets/icons/icons8-metamask-100.png"),
      className: "h-6 w-6",
      onPress: () => handleConnectExternalWallet("io.metamask")
    },
    {
      title: "Coinbase Wallet",
      icon: require("@/assets/icons/icons8-coinbase-100.png"),
      className: "h-6 w-6",
      onPress: () => handleConnectExternalWallet("com.coinbase.wallet")
    },
    {
      title: "Rainbow",
      icon: require("@/assets/icons/icons8-rainbow-100.png"),
      className: "h-6 w-6",
      onPress: () => handleConnectExternalWallet("me.rainbow")
    },
    {
      title: "Rabby",
      icon: require("@/assets/icons/Rabby.png"),
      className: "h-6 w-6",
      onPress: () => handleConnectExternalWallet("io.rabby")
    },
    {
      title: "Zerion",
      icon: require("@/assets/icons/zerion.jpeg"),
      className: "h-6 w-6",
      onPress: () => handleConnectExternalWallet("io.zerion.wallet")
    },
    {
      title: "All Wallets 500+",
      icon: require("@/assets/icons/icons8-wallet-100.png"),
      className: "h-6 w-6",
    },
  ];

  const handleConnectExternalWallet = async (wallet: WalletType) => {
    const connectedAccount = await externalWalletConnectService(wallet);
    if (connectedAccount.address) {
      setAccount({
        ...account,
        address: connectedAccount.address,
      });
      const userCheck = await checkUserExists(connectedAccount.address);
      if (!userCheck.exists) {
        router.push("/register");
      } else {
        await login().then(() => {
          console.log(isCustomer);
          if (isCustomer) {
            router.push("/customer");
          }
        });
      }
    }
  };

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
