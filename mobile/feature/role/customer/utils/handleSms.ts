import { Linking } from "react-native";

/**
 * Handle SMS
 */
export const handleSms = (phone?: string): void => {
  if (phone) {
    Linking.openURL(`sms:${phone}`);
  }
};
