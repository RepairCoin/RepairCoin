import { View, FlatList, RefreshControl, ActivityIndicator, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AppHeader } from "@/shared/components/ui/AppHeader";
import { useNotifications } from "../hooks";
import {
  NotificationCard,
  EmptyNotifications,
  NotificationTabs,
  NotificationMenu,
  LoadingFooter,
} from "../components";
import { Notification } from "../types";

export default function NotificationScreen() {
  const {
    notifications,
    isLoading,
    isRefreshing,
    isLoadingMore,
    activeTab,
    setActiveTab,
    showMenu,
    setShowMenu,
    isRegistered,
    unreadCount,
    handleRefresh,
    handleLoadMore,
    handleNotificationPress,
    handleMarkAllAsRead,
    handleTurnOffNotifications,
    handleTurnOnNotifications,
  } = useNotifications();

  if (isLoading) {
    return (
      <View className="w-full h-full bg-zinc-950 items-center justify-center">
        <ActivityIndicator size="large" color="#FFCC00" />
      </View>
    );
  }

  return (
    <View className="w-full h-full bg-zinc-950">
      <AppHeader
        title="Notifications"
        rightElement={
          <TouchableOpacity onPress={() => setShowMenu(true)} className="p-2">
            <Ionicons name="ellipsis-vertical" size={20} color="white" />
          </TouchableOpacity>
        }
      />

      <NotificationMenu
        visible={showMenu}
        onClose={() => setShowMenu(false)}
        isRegistered={isRegistered}
        onTurnOff={handleTurnOffNotifications}
        onTurnOn={handleTurnOnNotifications}
      />

      <NotificationTabs
        activeTab={activeTab}
        onTabChange={setActiveTab}
        unreadCount={unreadCount}
        onMarkAllAsRead={handleMarkAllAsRead}
      />

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        renderItem={({ item }: { item: Notification }) => (
          <NotificationCard
            notification={item}
            onPress={() => handleNotificationPress(item)}
          />
        )}
        ListEmptyComponent={<EmptyNotifications activeTab={activeTab} />}
        ListFooterComponent={<LoadingFooter isLoading={isLoadingMore} />}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.3}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor="#FFCC00"
            colors={["#FFCC00"]}
          />
        }
        contentContainerStyle={{
          flexGrow: 1,
          paddingBottom: 20,
          marginTop: 10,
        }}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}
