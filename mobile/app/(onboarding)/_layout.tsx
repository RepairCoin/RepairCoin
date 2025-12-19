import React, { useState } from "react";
import {
  SafeAreaView,
  StatusBar,
  Dimensions,
  View,
  ActivityIndicator,
  Text,
} from "react-native";
import { PanGestureHandler } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedGestureHandler,
  withSpring,
  runOnJS,
} from "react-native-reanimated";
import { useAuthStore } from "@/store/auth.store";
import OnboardingOne from "./onboarding1";
import OnboardingTwo from "./onboarding2";
import OnboardingThree from "./onboarding3";
import { Ionicons } from "@expo/vector-icons";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function OnboardingLayout() {
  const isLoading = useAuthStore((state) => state.isLoading);

  const [currentIndex, setCurrentIndex] = useState(0);
  const translateX = useSharedValue(0);

  const updateIndex = (newIndex: number) => {
    if (newIndex >= 0 && newIndex < 3) {
      setCurrentIndex(newIndex);
    }
  };

  const gestureHandler = useAnimatedGestureHandler({
    onStart: (_, context: any) => {
      context.startX = translateX.value;
    },
    onActive: (event, context) => {
      translateX.value = context.startX + event.translationX;
    },
    onEnd: (event) => {
      const shouldGoToNext = event.translationX < -SCREEN_WIDTH / 3;
      const shouldGoToPrevious = event.translationX > SCREEN_WIDTH / 3;

      if (shouldGoToNext && currentIndex < 2) {
        translateX.value = withSpring(-(currentIndex + 1) * SCREEN_WIDTH);
        runOnJS(updateIndex)(currentIndex + 1);
      } else if (shouldGoToPrevious && currentIndex > 0) {
        translateX.value = withSpring(-(currentIndex - 1) * SCREEN_WIDTH);
        runOnJS(updateIndex)(currentIndex - 1);
      } else {
        translateX.value = withSpring(-currentIndex * SCREEN_WIDTH);
      }
    },
  });

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: translateX.value }],
    };
  });

  if (isLoading) {
    return (
      <View className="h-full w-full bg-black items-center justify-center px-8">
        <View className="w-24 h-24 bg-[#FFCC00]/10 rounded-full items-center justify-center mb-8">
          <Ionicons name="home" size={48} color="#FFCC00" />
        </View>
        <Text className="text-white text-2xl font-bold text-center mb-2">
          Getting things ready
        </Text>
        <Text className="text-gray-400 text-base text-center mb-10">
          Opening your dashboard...
        </Text>
        <ActivityIndicator size="large" color="#FFCC00" />
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-black">
      <StatusBar
        barStyle="light-content"
        backgroundColor="transparent"
        translucent
      />

      <PanGestureHandler onGestureEvent={gestureHandler}>
        <Animated.View className="flex-1">
          <Animated.View
            style={[
              {
                flexDirection: "row",
                flex: 1,
                width: SCREEN_WIDTH * 3, // 3 screens wide
              },
              animatedStyle,
            ]}
          >
            <View style={{ width: SCREEN_WIDTH }}>
              <OnboardingOne slideIndex={currentIndex} />
            </View>
            <View style={{ width: SCREEN_WIDTH }}>
              <OnboardingTwo slideIndex={currentIndex} />
            </View>
            <View style={{ width: SCREEN_WIDTH }}>
              <OnboardingThree slideIndex={currentIndex} />
            </View>
          </Animated.View>
        </Animated.View>
      </PanGestureHandler>
    </SafeAreaView>
  );
}
