import React, { useState } from "react";
import { SafeAreaView, StatusBar, Dimensions, View } from "react-native";
import { PanGestureHandler } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedGestureHandler,
  withSpring,
  runOnJS,
} from "react-native-reanimated";
import OnboardingOne from "./onboarding1";
import OnboardingTwo from "./onboarding2";
import OnboardingThree from "./onboarding3";

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function OnboardingLayout() {
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
                flexDirection: 'row',
                flex: 1,
                width: SCREEN_WIDTH * 3, // 3 screens wide
              },
              animatedStyle
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