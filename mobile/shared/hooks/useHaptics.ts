import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

export function useHaptics() {
  const isEnabled = Platform.OS === "ios" || Platform.OS === "android";

  const light = () => {
    if (isEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const medium = () => {
    if (isEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const success = () => {
    if (isEnabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const error = () => {
    if (isEnabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  };

  const warning = () => {
    if (isEnabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  };

  const selection = () => {
    if (isEnabled) Haptics.selectionAsync();
  };

  return { light, medium, success, error, warning, selection };
}
