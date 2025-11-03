import { Image, Text, View } from "react-native";
import Screen from "@/components/ui/Screen";
import { useEffect } from "react";
import { router } from "expo-router";
import { useSplashNavigation } from "@/hooks/useAuthQueries";

const logo = require("@/assets/images/logo.png");

export default function Splash() {
  const { checkAuth, isLoading, navigationRoute } = useSplashNavigation();

  useEffect(() => {
    // Check authentication status on mount
    checkAuth();
  }, []);

  useEffect(() => {
    // Wait a minimum of 3 seconds for splash screen
    const timer = setTimeout(() => {
      if (!isLoading && navigationRoute) {
        router.replace(navigationRoute as any);
      }
    }, 3000);

    return () => {
      clearTimeout(timer);
    };
  }, [isLoading, navigationRoute]);

  return (
    <Screen>
      <View className="items-center h-full">
        <View className="h-[36%]" />
        <Image
          source={logo}
          className="w-[70%] h-[110px]"
          resizeMode="contain"
        />
        <Text className="text-center text-[15px] text-neutral-300 top-[-20]">
          The Repair Industry’s Loyalty Token
        </Text>
      </View>
    </Screen>
  );
}
