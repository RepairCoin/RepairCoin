import { useEffect } from "react";
import { StatusBar, Platform } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useFonts } from "expo-font";
import { SplashScreen, Stack } from "expo-router";
import { ThirdwebProvider } from "thirdweb/react";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ToastProvider } from "react-native-toast-notifications";

import { ErrorBoundaryProvider } from "../providers/ErrorBoundaryProvider";
import "../global.css";
import "react-native-get-random-values";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 1,
    },
  },
});


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
                </ToastProvider>
              </BottomSheetModalProvider>
            </ThirdwebProvider>
          </QueryClientProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundaryProvider>
  );
}
