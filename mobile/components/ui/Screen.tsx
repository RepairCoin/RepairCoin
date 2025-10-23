import { ReactNode } from "react";
import { ImageBackground, SafeAreaView, View } from "react-native";

const bg = require('@/assets/images/background.jpg');

export default function Screen({ children }: { children: ReactNode }) {
  return (
    <SafeAreaView className="bg-black">
      <ImageBackground
        source={bg}
        resizeMode="stretch"
        className="h-full w-full"
      >
        <View className="h-full w-full">{children}</View>
      </ImageBackground>
    </SafeAreaView>
  );
}
