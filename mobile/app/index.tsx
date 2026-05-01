import { Image, Text, View } from "react-native";
import Screen from "@/shared/components/ui/Screen";
import { useEffect } from "react";
import { useSplashNavigation } from "@/feature/auth/hooks/useSplashNavigation";
import { useAppStore } from "@/shared/store/app.store";

const logo = require("@/assets/images/logo.png");

export default function Splash() {
  const { navigate, hasHydrated } = useSplashNavigation();
  const initApp = useAppStore((s) => s.initApp);
  const appHydrated = useAppStore((s) => s.hasHydrated);

  useEffect(() => {
    initApp();
  }, []);

  useEffect(() => {
    if (hasHydrated && appHydrated) {
      navigate();
    }
  }, [hasHydrated, appHydrated]);

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
