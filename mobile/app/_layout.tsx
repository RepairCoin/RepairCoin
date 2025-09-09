import { useFonts } from "expo-font";
import { SplashScreen, Stack } from "expo-router";
import { useEffect } from "react";
import { ThirdwebProvider } from "thirdweb/react";
// import { createThirdwebClient } from "thirdweb";
import { StatusBar } from "react-native";
import "../global.css";

export default function RootLayout() {
  const [loaded] = useFonts({
    Poppins: require("../assets/fonts/Poppins-Regular.ttf"),
    "Poppins-ExtraBold": require("../assets/fonts/Poppins-ExtraBold.ttf"),
  });

  // const client = createThirdwebClient({
  //   clientId:
  //     process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID ||
  //     "1969ac335e07ba13ad0f8d1a1de4f6ab",
  // });

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  return (
    <ThirdwebProvider>
      <StatusBar barStyle="light-content" />
      <Stack screenOptions={{ headerShown: false }} />
    </ThirdwebProvider>
  );
}
