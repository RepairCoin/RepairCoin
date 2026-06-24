import "react-native-get-random-values";

import { StatusBar, Platform } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useFonts } from "expo-font";
import { SplashScreen, Stack } from "expo-router";
import { ThirdwebProvider, useAutoConnect } from "thirdweb/react";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { QueryClientProvider } from "@tanstack/react-query";
import { ToastProvider } from "react-native-toast-notifications";
import { createWallet, walletConnect } from "thirdweb/wallets";

import { ErrorBoundaryProvider } from "../shared/providers/ErrorBoundaryProvider";
import { PushNotificationProvider } from "../shared/providers/PushNotificationProvider";
import { AppBootSplash } from "../shared/components/AppBootSplash";
import { queryClient } from "../shared/config/queryClient";
import { client } from "../shared/constants/thirdweb";
import DevTools from "../shared/components/ui/ReactQueryDevtools";
import "../global.css";

SplashScreen.preventAutoHideAsync();

const wallets = [
  createWallet("inApp"),
  createWallet("io.metamask"),
  walletConnect(),
  createWallet("com.coinbase.wallet"),
  createWallet("me.rainbow"),
];

function WalletAutoConnect() {
  useAutoConnect({
    client,
    wallets,
    timeout: 15000,
    onConnect: (wallet) => {
      console.log("[WalletAutoConnect] Wallet reconnected:", wallet.id);
    },
  });

  return null;
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Poppins: require("../assets/fonts/Poppins-Regular.ttf"),
    "Poppins-ExtraBold": require("../assets/fonts/Poppins-ExtraBold.ttf"),
  });

  // The native splash is hidden by <AppBootSplash/> once that JS overlay has
  // painted — it then keeps the branded logo on screen until the screen the
  // user lands on has its data ready. We don't rely on the native splash icon:
  // Android only draws it on a launcher cold start, so opening from a push
  // showed the splash background with NO logo.
  if (!fontsLoaded) {
    return null;
  }

  return (
    <ErrorBoundaryProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
          <SafeAreaProvider>
            <QueryClientProvider client={queryClient}>
              <ThirdwebProvider>
                <WalletAutoConnect />
                <PushNotificationProvider>
                  <BottomSheetModalProvider>
                    <ToastProvider>
                      <StatusBar
                        barStyle={
                          Platform.OS === "ios" ? "light-content" : "default"
                        }
                        backgroundColor="transparent"
                        translucent
                      />
                      <Stack
                        screenOptions={{
                          headerShown: false,
                          animation: "slide_from_right",
                          gestureEnabled: true,
                        }}
                      />
                      {/* Rendered after Stack so it overlays every screen
                          during cold start until the landed screen is ready. */}
                      <AppBootSplash />
                      <DevTools />
                    </ToastProvider>
                  </BottomSheetModalProvider>
                </PushNotificationProvider>
              </ThirdwebProvider>
            </QueryClientProvider>
          </SafeAreaProvider>
        </GestureHandlerRootView>
    </ErrorBoundaryProvider>
  );
}
