import { View, SectionList, RefreshControl, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import GradientHeader from "@/shared/components/ui/GradientHeader";
import { SkeletonList } from "@/shared/components/ui/Skeleton";
import { useNotifications } from "../hooks";
import {
  NotificationCard,
  NotificationDetailModal,
  EmptyNotifications,
  NotificationTabs,
  NotificationMenu,
  LoadingFooter,
  NotificationSectionHeader,
} from "../components";
import { Notification } from "../types";

export default function NotificationScreen() {
  const {
    sections,
    isLoading,
    isRefreshing,
    isLoadingMore,
    activeTab,
    setActiveTab,
    showMenu,
    setShowMenu,
    selectedNotification,
    isRegistered,
    isConnected,
    unreadCount,
    totalCount,
    handleRefresh,
    handleLoadMore,
    handleNotificationPress,
    handleCloseDetail,
    handleDeleteNotification,
    handleMarkAllAsRead,
    handleTurnOffNotifications,
    handleTurnOnNotifications,
  } = useNotifications();

  if (isLoading) {
    return (
      <View className="w-full h-full bg-zinc-950">
        <GradientHeader title="Notifications" showBack onBack={() => router.back()} />
        <SkeletonList count={6} variant="notification" />
      </View>
    );
  }

  return (
    <View className="w-full h-full bg-zinc-950">
      <GradientHeader
        title="Notifications"
        showBack
        onBack={() => router.back()}
        right={
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
        totalCount={totalCount}
        unreadCount={unreadCount}
        onMarkAllAsRead={handleMarkAllAsRead}
        isConnected={isConnected}
      />

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={({ item }: { item: Notification }) => (
          <NotificationCard
            notification={item}
            onPress={() => handleNotificationPress(item)}
          />
        )}
        renderSectionHeader={({ section }) => (
          <NotificationSectionHeader title={section.title} />
        )}
        stickySectionHeadersEnabled={false}
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

      <NotificationDetailModal
        notification={selectedNotification}
        onClose={handleCloseDetail}
        onDelete={handleDeleteNotification}
      />
    </View>
  );
}
