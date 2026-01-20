import { View, Text, ScrollView, ActivityIndicator } from "react-native";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { AppHeader } from "@/components/ui/AppHeader";
import { SettingsItem, SettingsSection, Divider } from "../components";
import { useCustomerSettings } from "../hooks/ui/useCustomerSettings";
import { APP_VERSION } from "../constants";

export default function SettingsScreen() {
  const {
    walletDisplay,
    isLoggingOut,
    handleLogout,
    handleBack,
    handleEditProfile,
    handleReferFriends,
    handleHelp,
    handleTerms,
  } = useCustomerSettings();

  return (
    <View className="flex-1 bg-zinc-950">
      <AppHeader title="Settings" onBackPress={handleBack} />

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40, paddingTop: 16 }}
      >
        {/* Account Section */}
        <SettingsSection title="Account">
          <SettingsItem
            icon={<Ionicons name="person-outline" size={20} color="#FFCC00" />}
            title="Edit Profile"
            subtitle="Update your personal information"
            onPress={handleEditProfile}
          />
          <Divider />
          <SettingsItem
            icon={<Ionicons name="wallet-outline" size={20} color="#FFCC00" />}
            title="Wallet"
            subtitle={walletDisplay}
            onPress={() => {}}
            showArrow={false}
          />
        </SettingsSection>

        {/* Rewards Section */}
        <SettingsSection title="Rewards">
          <SettingsItem
            icon={<MaterialIcons name="group" size={20} color="#FFCC00" />}
            title="Refer Your Friends"
            subtitle="Earn RCN for every friend you refer"
            onPress={handleReferFriends}
          />
          <Divider />
        </SettingsSection>

        {/* Support Section */}
        <SettingsSection title="Support">
          <SettingsItem
            icon={<Ionicons name="help-circle-outline" size={20} color="#FFCC00" />}
            title="Help & Support"
            subtitle="Get help with your account"
            onPress={handleHelp}
          />
          <Divider />
          <SettingsItem
            icon={<Ionicons name="document-text-outline" size={20} color="#FFCC00" />}
            title="Terms & Privacy"
            subtitle="Read our policies"
            onPress={handleTerms}
          />
        </SettingsSection>

        {/* Logout Section */}
        <SettingsSection>
          <SettingsItem
            icon={
              isLoggingOut ? (
                <ActivityIndicator size="small" color="#EF4444" />
              ) : (
                <MaterialIcons name="logout" size={20} color="#EF4444" />
              )
            }
            title={isLoggingOut ? "Logging Out..." : "Log Out"}
            onPress={handleLogout}
            danger
            disabled={isLoggingOut}
            showArrow={false}
          />
        </SettingsSection>

        {/* App Version */}
        <Text className="text-gray-600 text-xs text-center mt-4">
          RepairCoin v{APP_VERSION}
        </Text>
      </ScrollView>
    </View>
  );
}
