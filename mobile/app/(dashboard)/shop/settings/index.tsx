import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { goBack } from "expo-router/build/global-state/routing";
import { useAuthStore } from "@/store/auth.store";
import { useAuth } from "@/hooks/auth/useAuth";
import { useTheme } from "@/hooks/theme/useTheme";
import { AppHeader } from "@/components/ui/AppHeader";

interface SettingsItemProps {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  onPress: () => void;
  showArrow?: boolean;
  danger?: boolean;
  disabled?: boolean;
  rightElement?: React.ReactNode;
}

function SettingsItem({
  icon,
  title,
  subtitle,
  onPress,
  showArrow = true,
  danger = false,
  disabled = false,
  rightElement,
}: SettingsItemProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      className={`flex-row items-center px-4 py-4 ${disabled ? "opacity-50" : ""}`}
      activeOpacity={0.7}
    >
      <View
        className={`w-10 h-10 rounded-full items-center justify-center ${
          danger ? "bg-red-500/20" : "bg-zinc-800"
        }`}
      >
        {icon}
      </View>
      <View className="flex-1 ml-3">
        <Text
          className={`text-base font-medium ${
            danger ? "text-red-500" : "text-white"
          }`}
        >
          {title}
        </Text>
        {subtitle && (
          <Text className="text-gray-500 text-sm mt-0.5">{subtitle}</Text>
        )}
      </View>
      {rightElement}
      {showArrow && !rightElement && (
        <Ionicons name="chevron-forward" size={20} color="#666" />
      )}
    </TouchableOpacity>
  );
}

function SettingsSection({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <View className="mb-6">
      {title && (
        <Text className="text-gray-500 text-xs font-semibold uppercase tracking-wider px-4 mb-2">
          {title}
        </Text>
      )}
      <View className="bg-zinc-900 rounded-2xl overflow-hidden mx-4">
        {children}
      </View>
    </View>
  );
}

function Divider() {
  return <View className="h-px bg-zinc-800 ml-16" />;
}

export default function ShopSettingsScreen() {
  const { account } = useAuthStore();
  const { useLogout } = useAuth();
  const { logout, isLoggingOut } = useLogout();
  const { useThemeColor } = useTheme();
  const { toggleColorScheme, isDarkMode } = useThemeColor();

  const handleLogout = async () => {
    await logout();
  };

  return (
    <View className="flex-1 bg-zinc-950">
      <AppHeader title="Settings" onBackPress={goBack} />

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
            onPress={() => router.push("/shop/profile/edit-profile")}
          />
          <Divider />
          <SettingsItem
            icon={<Ionicons name="wallet-outline" size={20} color="#FFCC00" />}
            title="Wallet"
            subtitle={
              account?.address
                ? `${account.address.slice(0, 6)}...${account.address.slice(-4)}`
                : "Not connected"
            }
            onPress={() => {}}
            showArrow={false}
          />
        </SettingsSection>

        {/* Appearance Section */}
        {/* <SettingsSection title="Appearance">
          <SettingsItem
            icon={
              <Ionicons
                name={isDarkMode ? "moon" : "sunny"}
                size={20}
                color="#FFCC00"
              />
            }
            title="Theme"
            subtitle={isDarkMode ? "Dark mode" : "Light mode"}
            onPress={toggleColorScheme}
            showArrow={false}
            rightElement={
              <View className="flex-row items-center bg-zinc-800 rounded-full p-1">
                <TouchableOpacity
                  onPress={() => !isDarkMode && toggleColorScheme()}
                  className={`px-3 py-1.5 rounded-full ${isDarkMode ? "bg-zinc-700" : "bg-transparent"}`}
                >
                  <Ionicons name="moon" size={16} color={isDarkMode ? "#FFCC00" : "#666"} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => isDarkMode && toggleColorScheme()}
                  className={`px-3 py-1.5 rounded-full ${!isDarkMode ? "bg-zinc-700" : "bg-transparent"}`}
                >
                  <Ionicons name="sunny" size={16} color={!isDarkMode ? "#FFCC00" : "#666"} />
                </TouchableOpacity>
              </View>
            }
          />
        </SettingsSection> */}

        {/* Subscription & Tokens Section */}
        <SettingsSection title="Subscription & Tokens">
          <SettingsItem
            icon={<MaterialIcons name="card-membership" size={20} color="#FFCC00" />}
            title="Subscription"
            subtitle="Manage your plan"
            onPress={() => router.push("/shop/subscription")}
          />
          <Divider />
          <SettingsItem
            icon={<Ionicons name="wallet" size={20} color="#FFCC00" />}
            title="Buy RCN Tokens"
            subtitle="Purchase tokens for rewards"
            onPress={() => router.push("/shop/buy-token")}
          />
          <Divider />
          <SettingsItem
            icon={<Ionicons name="qr-code" size={20} color="#FFCC00" />}
            title="Redeem Tokens"
            subtitle="Process customer redemptions"
            onPress={() => router.push("/shop/redeem-token")}
          />
        </SettingsSection>

        {/* Support Section */}
        <SettingsSection title="Support">
          <SettingsItem
            icon={
              <Ionicons
                name="help-circle-outline"
                size={20}
                color="#FFCC00"
              />
            }
            title="Help & Support"
            subtitle="Get help with your account"
            onPress={() => {}}
          />
          <Divider />
          <SettingsItem
            icon={
              <Ionicons
                name="document-text-outline"
                size={20}
                color="#FFCC00"
              />
            }
            title="Terms & Privacy"
            subtitle="Read our policies"
            onPress={() => {}}
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
