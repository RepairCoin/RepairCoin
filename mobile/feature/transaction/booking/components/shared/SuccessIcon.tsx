import { View, Animated } from "react-native";
import { Feather } from "@expo/vector-icons";

type SuccessIconProps = {
  scaleAnim: Animated.Value;
  checkmarkAnim: Animated.Value;
};

export default function SuccessIcon({ scaleAnim, checkmarkAnim }: SuccessIconProps) {
  return (
    <Animated.View
      style={{
        transform: [{ scale: scaleAnim }],
      }}
      className="w-32 h-32 rounded-full bg-green-500/20 items-center justify-center mb-8"
    >
      <View className="w-24 h-24 rounded-full bg-green-500/40 items-center justify-center">
        <Animated.View
          style={{
            opacity: checkmarkAnim,
            transform: [
              {
                scale: checkmarkAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.5, 1],
                }),
              },
            ],
          }}
          className="w-16 h-16 rounded-full bg-green-500 items-center justify-center"
        >
          <Feather name="check" size={40} color="white" />
        </Animated.View>
      </View>
    </Animated.View>
  );
}
