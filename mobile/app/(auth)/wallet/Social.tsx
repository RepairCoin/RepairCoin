import { Text, TextInput, View } from "react-native";
import { goBack } from "expo-router/build/global-state/routing";
import { LinearGradient } from "expo-linear-gradient";
import { AntDesign, Ionicons } from "@expo/vector-icons";
import LoginButton from "@/components/ui/LoginButton";
import Screen from "@/components/ui/Screen";
import { useState } from "react";
import { router } from "expo-router";
import {
  SendCodeViaEmailService,
  SocialConnectWalletService,
} from "@/services/RegisterServices";
import { ThirdWebStrategy } from "@/utilities/GlobalTypes";
import { useAuthStore } from "@/store/authStore";
import { EmailValidation } from "@/utilities/Validation";

export default function ConnectWalletWithSocialPage() {
  const [email, setEmail] = useState<string>("");
  const { account, setAccount, checkUserExists, login, isCustomer } =
    useAuthStore((state) => state);

  const SocialOptions: {
    title: string;
    icon: any;
    className: string;
    strategy: ThirdWebStrategy;
  }[] = [
    {
      title: "Continue with Google",
      icon: require("@/assets/icons/icons8-google-100.png"),
      className: "h-6 w-6",
      strategy: "google",
    },
    {
      title: "Continue with Apple",
      icon: require("@/assets/icons/icons8-apple-100.png"),
      className: "h-6 w-6",
      strategy: "apple",
    },
    {
      title: "Continue with Facebook",
      icon: require("@/assets/icons/icons8-facebook-100.png"),
      className: "h-6 w-6",
      strategy: "facebook",
    },
  ];

  const OtherOptions = [
    {
      title: "Phone Number",
      icon: require("@/assets/icons/icons8-phone-100.png"),
      className: "h-6 w-6",
    },
    {
      title: "Passkey",
      icon: require("@/assets/icons/icons8-fingerprint-100.png"),
      className: "h-6 w-6",
    },
  ];

  const handleSendCode = async () => {
    const response = await SendCodeViaEmailService(email);

    if (response.success) {
      setAccount({
        ...account,
        email,
      });
      router.push("/wallet/VerifyEmail");
    }
  };

  const handleSocialWalletConnect = async (strategy: ThirdWebStrategy) => {
    const connectedAccount = await SocialConnectWalletService(strategy);
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
          {SocialOptions.map((option, index) => (
            <LoginButton
              key={index}
              title={option.title}
              icon={option.icon}
              className={option.className}
              onPress={() => handleSocialWalletConnect(option.strategy)}
            />
          ))}
        </View>

        <View className="flex-row items-center justify-center my-4">
          <LinearGradient
            colors={["transparent", "#aaa"]}
            className="h-0.5 w-40"
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          />
          <Text className="font-poppins text-white mx-2">or</Text>
          <LinearGradient
            colors={["#aaa", "transparent"]}
            className="h-0.5 w-40"
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          />
        </View>

        <View className="items-center">
          <View className="flex-row items-center justify-between my-4 w-[95%] py-2 px-4 rounded-2xl border border-white">
            <TextInput
              placeholder="Email Address"
              placeholderTextColor="#666"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              className="color-[#666]"
            />
            <Ionicons
              name="arrow-forward"
              color="#666"
              size={25}
              onPress={handleSendCode}
              disabled={!EmailValidation(email)}
            />
          </View>
        </View>

        <View className="flex-col items-center">
          {OtherOptions.map((option, index) => (
            <LoginButton
              key={index}
              title={option.title}
              icon={option.icon}
              className={option.className}
              onPress={() => {}}
            />
          ))}
        </View>
      </View>
    </Screen>
  );
}
