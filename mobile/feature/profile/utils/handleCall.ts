import { Linking } from "react-native";

/**
 * Handle phone call
 */
export const handleCall = (phone?: string): void => {
  if (phone) {
    Linking.openURL(`tel:${phone}`);
  }
};
