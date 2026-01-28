// Libraries
import React from "react";
import { View, Text, ScrollView, ActivityIndicator } from "react-native";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";

// Components
import { AppHeader } from "@/shared/components/ui/AppHeader";
import { SettingsItem, SettingsSection, Divider } from "../components";

// Hooks
import {
  useSettingsUI,
  useLogoutUI,
  useSettingsNavigation,
} from "../hooks";

export default function ShopSettingsScreen() {
  // UI state
  const { walletDisplay } = useSettingsUI();

  // Logout UI
  const { handleLogout, isLoggingOut } = useLogoutUI();

  // Navigation
  const {
    handleBack,
    handleEditProfile,
    handleSubscription,
    handleBuyTokens,
    handleRedeemTokens,
    handleHelp,
    handleTerms,
  } = useSettingsNavigation();

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
            icon={<Ionicons name="storefront-outline" size={20} color="#FFCC00" />}
            title="Edit Profile"
            subtitle="Update your shop information"
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

        {/* Subscription & Tokens Section */}
        <SettingsSection title="Subscription & Tokens">
          <SettingsItem
            icon={<MaterialIcons name="card-membership" size={20} color="#FFCC00" />}
            title="Subscription"
            subtitle="Manage your plan"
            onPress={handleSubscription}
          />
          <Divider />
          <SettingsItem
            icon={<Ionicons name="wallet" size={20} color="#FFCC00" />}
            title="Buy RCN Tokens"
            subtitle="Purchase tokens for rewards"
            onPress={handleBuyTokens}
          />
          <Divider />
          <SettingsItem
            icon={<Ionicons name="qr-code" size={20} color="#FFCC00" />}
            title="Redeem Tokens"
            subtitle="Process customer redemptions"
            onPress={handleRedeemTokens}
          />
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
          RepairCoin v1.0.0
        </Text>
      </ScrollView>
    </View>
  );
}
