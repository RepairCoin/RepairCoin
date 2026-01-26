import { Image, View } from "react-native";
import Screen from "@/shared/components/ui/Screen";

export default function ShopSuccessScreen() {
  return (
    <Screen>
      <View className="px-8 py-20">
        <Image source={require("@/assets/images/bg_success.png")} />
      </View>
    </Screen>
  );
}
