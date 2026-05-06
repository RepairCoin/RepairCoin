import { Linking } from "react-native";

/**
 * Handle email
 */
export const handleEmail = (email?: string): void => {
  if (email) {
    Linking.openURL(`mailto:${email}`);
  }
};
