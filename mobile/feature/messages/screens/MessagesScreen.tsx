import { View, FlatList, RefreshControl, ActivityIndicator } from "react-native";
import { AppHeader } from "@/components/ui/AppHeader";
import { useMessages } from "../hooks";
import { EmptyConversations, ConversationItem } from "../components";
import { Conversation } from "../types";

export default function MessagesScreen() {
  const {
    conversations,
    isLoading,
    isRefreshing,
    isCustomer,
    handleRefresh,
    navigateToChat,
  } = useMessages();

  const renderConversation = ({ item }: { item: Conversation }) => (
    <ConversationItem
      conversation={item}
      isCustomer={isCustomer}
      onPress={() => navigateToChat(item.conversationId)}
    />
  );

  if (isLoading) {
    return (
      <View className="w-full h-full bg-zinc-950 items-center justify-center">
        <ActivityIndicator size="large" color="#FFCC00" />
      </View>
    );
  }

  return (
    <View className="w-full h-full bg-zinc-950">
      <AppHeader title="Messages" />

      <FlatList
        data={conversations}
        keyExtractor={(item) => item.conversationId}
        renderItem={renderConversation}
        ListEmptyComponent={EmptyConversations}
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
        }}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}
