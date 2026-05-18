import { Alert } from "react-native";
import * as Clipboard from "expo-clipboard";

/**
 * Copy text to clipboard with alert
 */
export const copyToClipboard = async (
  text?: string,
  label?: string
): Promise<void> => {
  if (text) {
    await Clipboard.setStringAsync(text);
    Alert.alert("Copied", `${label || "Text"} copied to clipboard`);
  }
};
