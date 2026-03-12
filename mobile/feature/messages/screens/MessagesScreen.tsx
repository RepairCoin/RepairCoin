import { View, FlatList, RefreshControl, ActivityIndicator, Text, Pressable } from "react-native";
import { AppHeader } from "@/shared/components/ui/AppHeader";
import { useMessages, MessageFilter } from "../hooks";
import { EmptyConversations, ConversationItem } from "../components";
import { Conversation } from "../types";

function FilterTabs({
  filter,
  onFilterChange,
}: {
  filter: MessageFilter;
  onFilterChange: (filter: MessageFilter) => void;
}) {
  return (
    <View className="flex-row px-4 py-2 border-b border-zinc-800">
      <Pressable
        onPress={() => onFilterChange("active")}
        className={`flex-1 py-2 rounded-lg mr-2 ${
          filter === "active" ? "bg-[#FFCC00]" : "bg-zinc-800"
        }`}
      >
        <Text
          className={`text-center font-medium ${
            filter === "active" ? "text-black" : "text-zinc-400"
          }`}
        >
          Active
        </Text>
      </Pressable>
      <Pressable
        onPress={() => onFilterChange("archived")}
        className={`flex-1 py-2 rounded-lg ml-2 ${
          filter === "archived" ? "bg-[#FFCC00]" : "bg-zinc-800"
        }`}
      >
        <Text
          className={`text-center font-medium ${
            filter === "archived" ? "text-black" : "text-zinc-400"
          }`}
        >
          Archived
        </Text>
      </Pressable>
    </View>
  );
}

export default function MessagesScreen() {
  const {
    conversations,
    isLoading,
    isRefreshing,
    isCustomer,
    filter,
    handleRefresh,
    handleFilterChange,
    navigateToChat,
  } = useMessages();

  const renderConversation = ({ item }: { item: Conversation }) => (
    <ConversationItem
      conversation={item}
      isCustomer={isCustomer}
      onPress={() => navigateToChat(item.conversationId)}
    />
  );

  return (
    <View className="w-full h-full bg-zinc-950">
      <AppHeader title="Messages" />
      <FilterTabs filter={filter} onFilterChange={handleFilterChange} />

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#FFCC00" />
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.conversationId}
          renderItem={renderConversation}
          ListEmptyComponent={
            <EmptyConversations
              message={
                filter === "archived"
                  ? "No archived conversations"
                  : "No conversations yet"
              }
            />
          }
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
      )}
    </View>
  );
}
