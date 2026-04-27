import { View, Text } from "react-native";
import { ContactInfoCard } from "./ContactInfoCard";
import { handleEmail, handleCall, copyToClipboard } from "../utils";

interface CustomerContactInfoProps {
  email?: string;
  phone?: string;
  walletAddress?: string;
}

export function CustomerContactInfo({
  email,
  phone,
  walletAddress
}: CustomerContactInfoProps) {
  return (
    <View className="px-4 mb-6">
      <Text className="text-white text-lg font-semibold mb-4">
        Contact Information
      </Text>

      {email && (
        <ContactInfoCard
          label="Email"
          value={email}
          iconName="mail-outline"
          onPress={() => handleEmail(email)}
        />
      )}

      {phone && (
        <ContactInfoCard
          label="Phone"
          value={phone}
          iconName="call-outline"
          onPress={() => handleCall(phone)}
        />
      )}

      {walletAddress && (
        <ContactInfoCard
          label="Wallet Address"
          value={walletAddress}
          iconName="wallet-outline"
          onPress={() => copyToClipboard(walletAddress, "Wallet address")}
          actionIcon="copy-outline"
          truncate
        />
      )}
    </View>
  );
}
