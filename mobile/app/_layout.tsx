import { useEffect } from "react";
import { StatusBar, Platform } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useFonts } from "expo-font";
import { SplashScreen, Stack } from "expo-router";
import { ThirdwebProvider } from "thirdweb/react";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { QueryClientProvider } from "@tanstack/react-query";
import { ToastProvider } from "react-native-toast-notifications";

import { ErrorBoundaryProvider } from "../providers/ErrorBoundaryProvider";
import { StripeProvider } from "../providers/StripeProvider";
import { queryClient } from "../config/queryClient";
import DevTools from "../components/ui/ReactQueryDevtools";
import "../global.css";
import "react-native-get-random-values";

SplashScreen.preventAutoHideAsync();


export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Poppins: require("../assets/fonts/Poppins-Regular.ttf"),
    "Poppins-ExtraBold": require("../assets/fonts/Poppins-ExtraBold.ttf"),
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <ErrorBoundaryProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <QueryClientProvider client={queryClient}>
            <ThirdwebProvider>
              <StripeProvider>
                <BottomSheetModalProvider>
                  <ToastProvider>
                    <StatusBar
                      barStyle={Platform.OS === 'ios' ? 'light-content' : 'default'}
                      backgroundColor="transparent"
                      translucent
                    />
                    <Stack
                      screenOptions={{
                        headerShown: false,
                        animation: 'slide_from_right',
                        gestureEnabled: true,
                      }}
                    />
                    <DevTools />
                  </ToastProvider>
                </BottomSheetModalProvider>
              </StripeProvider>
            </ThirdwebProvider>
          </QueryClientProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundaryProvider>
  );
}
