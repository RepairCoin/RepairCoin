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
import { useCustomer } from "@/hooks/customer/useCustomer";
import { useAuth } from "@/hooks/auth/useAuth";
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

export default function SettingScreen() {
  const { account } = useAuthStore();
  const { useGetCustomerByWalletAddress } = useCustomer();
  const { useLogout } = useAuth();
  const { logout, isLoggingOut } = useLogout();

  const { data: customerData } = useGetCustomerByWalletAddress(
    account?.address
  );

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
            icon={<Ionicons name="person-outline" size={20} color="#FFCC00" />}
            title="Edit Profile"
            subtitle="Update your personal information"
            onPress={() => router.push("/customer/profile")}
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

        {/* Rewards Section */}
        <SettingsSection title="Rewards">
          <SettingsItem
            icon={<MaterialIcons name="group" size={20} color="#FFCC00" />}
            title="Refer Your Friends"
            subtitle="Earn RCN for every friend you refer"
            onPress={() => router.push("/customer/referral")}
          />
          <Divider />
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
