import { ReactNode } from "react";
import { ImageBackground, SafeAreaView, View, Image } from "react-native";

const bg = require('@/assets/images/background.jpg');

export default function Screen({ children }: { children: ReactNode }) {
  return (
    <SafeAreaView className="flex-1 bg-black">
      <ImageBackground
        source={bg}
        resizeMode="stretch"
        className="h-full w-full"
      >
        <View className="flex-1 h-full w-full">{children}</View>
      </ImageBackground>
    </SafeAreaView>
  );
}
