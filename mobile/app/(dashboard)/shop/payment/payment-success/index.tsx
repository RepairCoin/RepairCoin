import { useEffect, useRef } from "react";
import { View, Text, Pressable, Animated, Easing } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import Screen from "@/components/ui/Screen";
import PrimaryButton from "@/components/ui/PrimaryButton";

export default function PaymentSuccessScreen() {
  const router = useRouter();
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const checkmarkAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Animate the success icon
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 1.2,
        duration: 300,
        easing: Easing.out(Easing.back(2)),
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();

    // Animate the checkmark
    Animated.timing(checkmarkAnim, {
      toValue: 1,
      duration: 400,
      delay: 200,
      useNativeDriver: true,
    }).start();

    // Fade in content
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      delay: 300,
      useNativeDriver: true,
    }).start();

    // Slide up content
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 500,
      delay: 300,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, []);

  const handleGoToDashboard = () => {
    router.replace("/shop/tabs/home");
  };

  return (
    <Screen>
      <View className="flex-1 px-6 justify-center items-center">
        {/* Success Icon with Animation */}
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

        {/* Success Message */}
        <Animated.View
          style={{
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          }}
          className="items-center"
        >
          <Text className="text-[#FFCC00] text-3xl font-bold text-center mb-2">
            Payment Successful!
          </Text>
          <Text className="text-gray-300 text-lg text-center mb-8">
            Your subscription has been activated
          </Text>

          {/* Action Button */}
          <PrimaryButton
            title="Go to Dashboard"
            onPress={handleGoToDashboard}
            className="w-full px-12"
          />
{/* 
          <Text className="text-gray-500 text-xs text-center mt-6">
            A confirmation email has been sent to your registered email address
          </Text> */}
        </Animated.View>
      </View>
    </Screen>
  );
}
