import { useEffect, useRef } from "react";
import { View, Text, Animated, Easing } from "react-native";

type TypingIndicatorProps = {
  senderName?: string;
  senderInitial?: string;
};

export default function TypingIndicator({
  senderName,
  senderInitial = "?",
}: TypingIndicatorProps) {
  // Create animated values for the 3 dots
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animateDot = (dot: Animated.Value, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, {
            toValue: 1,
            duration: 300,
            easing: Easing.ease,
            useNativeDriver: true,
          }),
          Animated.timing(dot, {
            toValue: 0,
            duration: 300,
            easing: Easing.ease,
            useNativeDriver: true,
          }),
          Animated.delay(600 - delay),
        ])
      );
    };

    const animation1 = animateDot(dot1, 0);
    const animation2 = animateDot(dot2, 150);
    const animation3 = animateDot(dot3, 300);

    animation1.start();
    animation2.start();
    animation3.start();

    return () => {
      animation1.stop();
      animation2.stop();
      animation3.stop();
    };
  }, [dot1, dot2, dot3]);

  const dotStyle = (animatedValue: Animated.Value) => ({
    transform: [
      {
        translateY: animatedValue.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -4],
        }),
      },
    ],
    opacity: animatedValue.interpolate({
      inputRange: [0, 1],
      outputRange: [0.4, 1],
    }),
  });

  return (
    <View className="flex-row mb-2 px-4 justify-start">
      {/* Avatar */}
      <View className="w-8 h-8 rounded-full bg-zinc-700 items-center justify-center mr-2">
        <Text className="text-white text-xs font-bold">
          {senderInitial.toUpperCase()}
        </Text>
      </View>

      <View className="items-start">
        {/* Typing Bubble */}
        <View className="rounded-2xl px-4 py-3 bg-zinc-800 border border-zinc-700">
          <View className="flex-row items-center space-x-1">
            <Animated.View
              style={dotStyle(dot1)}
              className="w-2 h-2 rounded-full bg-zinc-400"
            />
            <Animated.View
              style={dotStyle(dot2)}
              className="w-2 h-2 rounded-full bg-zinc-400 mx-1"
            />
            <Animated.View
              style={dotStyle(dot3)}
              className="w-2 h-2 rounded-full bg-zinc-400"
            />
          </View>
        </View>

        {/* Label */}
        {senderName && (
          <Text className="text-xs text-zinc-500 mt-1">
            {senderName} is typing...
          </Text>
        )}
      </View>
    </View>
  );
}
