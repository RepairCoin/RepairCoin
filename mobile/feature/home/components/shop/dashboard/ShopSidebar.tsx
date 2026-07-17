import { useMemo, useState } from "react";
import {
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuthStore } from "@/feature/auth/store/auth.store";
import { useLogout } from "@/feature/auth/hooks/useLogout";

type Item = { label: string; route: string };
type Group = {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  items: Item[];
};

/*
 * Only routes that exist in app/(dashboard)/shop are included.
 * Excluded (named by request / no mobile screen): Purchase Orders, Inventory,
 * Staff & Time, Service Queue, Marketing, standalone Reviews, Reports.
 */
const HOME_ROUTE = "/shop/tabs/home";

const GROUPS: Group[] = [
  {
    key: "ops",
    label: "Business Operation",
    icon: "storefront-outline",
    items: [
      { label: "Services", route: "/shop/tabs/service" },
      { label: "Bookings", route: "/shop/tabs/service?tab=Booking" },
      { label: "Appointments", route: "/shop/availability" },
    ],
  },
  {
    key: "customers",
    label: "Customers",
    icon: "people-outline",
    items: [
      { label: "Customers", route: "/shop/tabs/customer" },
      { label: "Messages", route: "/shop/messages" },
      { label: "Affiliate Groups", route: "/shop/groups" },
      { label: "Loyalty & Rewards", route: "/shop/promo-code" },
    ],
  },
  {
    key: "account",
    label: "Account",
    icon: "settings-outline",
    items: [
      { label: "Wallet & Tools", route: "/shop/tools" },
      { label: "Redeem Token", route: "/shop/redeem-token" },
      { label: "Subscription", route: "/shop/subscription" },
      { label: "Settings", route: "/shop/settings" },
    ],
  },
];

/* One sub-item row with the Figma tree connector (└─) on the left. */
function TreeRow({
  label,
  isLast,
  onPress,
}: {
  label: string;
  isLast: boolean;
  onPress: () => void;
}) {
  return (
    <View className="flex-row items-stretch">
      <View style={{ width: 22 }}>
        {/* vertical line: full height, or top-half for the last row */}
        <View
          className="absolute left-0 w-px bg-[#333]"
          style={{ top: 0, bottom: isLast ? "50%" : 0 }}
        />
        {/* horizontal tick into the label */}
        <View
          className="absolute left-0 h-px bg-[#333]"
          style={{ top: "50%", width: 14 }}
        />
      </View>
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.7}
        className="flex-1 py-2.5"
      >
        <Text className="text-gray-300 text-sm">{label}</Text>
      </TouchableOpacity>
    </View>
  );
}

export function ShopSidebar({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    ops: true,
    customers: true,
    account: false,
  });
  const userProfile = useAuthStore((s) => s.userProfile);
  const { logout, isLoggingOut } = useLogout();

  const go = (route: string) => {
    onClose();
    router.push(route as never);
  };

  const confirmLogout = () => {
    Alert.alert("Logout", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: () => {
          onClose();
          logout();
        },
      },
    ]);
  };

  const toggle = (key: string) =>
    setExpanded((e) => ({ ...e, [key]: !e[key] }));

  const q = query.trim().toLowerCase();
  const filteredGroups = useMemo(() => {
    if (!q) return GROUPS;
    return GROUPS.map((g) => ({
      ...g,
      items: g.items.filter((i) => i.label.toLowerCase().includes(q)),
    })).filter((g) => g.items.length > 0);
  }, [q]);

  return (
    <Modal
      visible={visible}
      transparent
      statusBarTranslucent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable className="flex-1 flex-row bg-black/60" onPress={onClose}>
        <Pressable
          className="w-[80%] max-w-[320px] h-full bg-[#0A0A0A]"
          onPress={(e) => e.stopPropagation()}
        >
          {/* Logo — padded below the status bar (panel draws behind it) */}
          <View
            className="px-5 pb-4 flex-row items-center justify-between"
            style={{ paddingTop: insets.top + 16 }}
          >
            <Image
              source={require("@/assets/images/logo.png")}
              className="w-36 h-9"
              resizeMode="contain"
            />
            <TouchableOpacity
              onPress={onClose}
              hitSlop={10}
              className="w-8 h-8 rounded-lg bg-[#1E1E1E] items-center justify-center"
            >
              <Ionicons name="chevron-back" size={18} color="#E5E7EB" />
            </TouchableOpacity>
          </View>

          {/* Search */}
          <View className="px-4 mb-3">
            <View className="flex-row items-center bg-[#1A1A1A] rounded-xl px-3 py-2.5">
              <Ionicons name="search" size={16} color="#6B7280" />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search"
                placeholderTextColor="#6B7280"
                className="flex-1 ml-2 text-white text-sm p-0"
              />
              {query.length > 0 && (
                <TouchableOpacity onPress={() => setQuery("")}>
                  <Ionicons name="close-circle" size={16} color="#6B7280" />
                </TouchableOpacity>
              )}
            </View>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 40 }}
          >
            {/* Home — gold pill */}
            {(!q || "home".includes(q)) && (
              <View className="px-4">
                <TouchableOpacity
                  onPress={() => go(HOME_ROUTE)}
                  activeOpacity={0.85}
                  className="flex-row items-center bg-[#FFCC00] rounded-xl px-4 py-3 mb-3"
                >
                  <Ionicons name="home-outline" size={18} color="#000" />
                  <Text className="text-black font-bold text-sm ml-3">Home</Text>
                </TouchableOpacity>
              </View>
            )}

            {filteredGroups.map((group) => {
              const isOpen = q ? true : expanded[group.key];
              return (
                <View key={group.key} className="px-4 mb-1.5">
                  <TouchableOpacity
                    onPress={() => toggle(group.key)}
                    activeOpacity={0.7}
                    className="flex-row items-center bg-[#1E1E1E] rounded-xl px-4 py-3"
                  >
                    <Ionicons name={group.icon} size={18} color="#E5E7EB" />
                    <Text className="text-gray-100 font-semibold text-sm ml-3 flex-1">
                      {group.label}
                    </Text>
                    <Ionicons
                      name={isOpen ? "chevron-up" : "chevron-down"}
                      size={16}
                      color="#9CA3AF"
                    />
                  </TouchableOpacity>

                  {isOpen && (
                    <View className="mt-1 pl-3">
                      {group.items.map((item, idx) => (
                        <TreeRow
                          key={item.route}
                          label={item.label}
                          isLast={idx === group.items.length - 1}
                          onPress={() => go(item.route)}
                        />
                      ))}
                    </View>
                  )}
                </View>
              );
            })}
          </ScrollView>

          {/* Bottom — logout + account */}
          <View className="px-4 pb-10 pt-3 border-t border-[#222]">
            <TouchableOpacity
              onPress={confirmLogout}
              disabled={isLoggingOut}
              activeOpacity={0.7}
              className="flex-row items-center py-2.5"
            >
              <Ionicons name="log-out-outline" size={20} color="#FFFFFF" />
              <Text className="text-white text-sm font-semibold ml-3">
                {isLoggingOut ? "Logging out..." : "Logout Account"}
              </Text>
            </TouchableOpacity>

            <View className="flex-row items-center mt-2">
              {userProfile?.logoUrl ? (
                <Image
                  source={{ uri: userProfile.logoUrl }}
                  style={{ width: 40, height: 40, borderRadius: 20 }}
                />
              ) : (
                <View
                  style={{ width: 40, height: 40, borderRadius: 20 }}
                  className="bg-[#1E1E1E] items-center justify-center"
                >
                  <Text className="text-white font-bold text-sm">
                    {userProfile?.name?.charAt(0).toUpperCase() ?? "?"}
                  </Text>
                </View>
              )}
              <View className="ml-3 flex-1">
                <Text className="text-white text-sm font-bold" numberOfLines={1}>
                  {userProfile?.name ?? ""}
                </Text>
                <Text className="text-gray-500 text-xs" numberOfLines={1}>
                  {userProfile?.email ?? ""}
                </Text>
              </View>
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
