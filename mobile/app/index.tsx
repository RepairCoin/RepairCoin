import { Image, Text, View } from "react-native";
import Screen from "@/components/Screen";
import { useEffect, useState } from "react";
import { router } from "expo-router";
import { useAuthStore } from "@/store/authStore";

const logo = require("@/assets/images/logo.png");

export default function Splash() {
  const { isAuthenticated, isAdmin, isCustomer, isShop } = useAuthStore(
    (state) => state
  );
  const [hasHydrated, setHasHydrated] = useState<boolean>(false);

  useEffect(() => {
    if (useAuthStore.persist.hasHydrated()) {
      setHasHydrated(true);
    } else {
      const unsub = useAuthStore.persist.onFinishHydration(() => {
        setHasHydrated(true);
      });
      return () => unsub();
    }
  }, []);

  useEffect(() => {
    if (!hasHydrated) return;

    if (isAuthenticated) {
      if (isCustomer) {
        router.push("/dashboard/customer");
      }
    } else {
      router.push("/onboarding");
    }
  }, [hasHydrated, isAuthenticated, isCustomer]);

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
