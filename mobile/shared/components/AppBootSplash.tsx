import { useEffect } from "react";
import { View, Image, StyleSheet } from "react-native";
import * as SplashScreen from "expo-splash-screen";
import { useBootStore } from "@/shared/store/boot.store";

// Same asset and look as the native splash (gold logo on black) so the handoff
// from the OS splash to this JS overlay is visually seamless.
const splashLogo = require("@/assets/images/splash-icon.png");

// Hard cap so the splash can never hang if a landed screen never reports ready
// (e.g. an unwired screen or a failed data load).
const SAFETY_TIMEOUT_MS = 8000;

/**
 * Full-screen branded splash shown during cold start. Unlike the native splash
 * — whose icon Android only draws on a launcher cold start, not when opening
 * from a notification — this is a plain JS <Image>, so the logo is visible on
 * every launch path and outlives navigation to cover the destination's data
 * load. Dismissed by useEndBootWhenReady() (target screen ready) or the timeout.
 */
export function AppBootSplash() {
  const isBooting = useBootStore((state) => state.isBooting);
  const endBoot = useBootStore((state) => state.endBoot);

  // Hide the native splash as soon as this overlay has mounted/painted, so the
  // OS splash lifts onto an identical-looking JS splash instead of an empty,
  // still-loading screen.
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  useEffect(() => {
    const timer = setTimeout(endBoot, SAFETY_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [endBoot]);

  if (!isBooting) {
    return null;
  }

  // No pointerEvents="none": the overlay should swallow taps so the user can't
  // interact with the still-loading screens underneath it.
  return (
    <View style={styles.container}>
      <Image source={splashLogo} style={styles.logo} resizeMode="contain" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000000",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
    elevation: 9999,
  },
  logo: {
    width: 200,
    height: 200,
  },
});
