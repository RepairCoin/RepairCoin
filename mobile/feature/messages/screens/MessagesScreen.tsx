import { View, FlatList, RefreshControl, ActivityIndicator, Text, Pressable, TextInput } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AppHeader } from "@/shared/components/ui/AppHeader";
import { useMessages, MessageFilter } from "../hooks";
import { EmptyConversations, ConversationItem } from "../components";
import { Conversation } from "../types";

function SearchBar({
  value,
  onChangeText,
  onClear,
}: {
  value: string;
  onChangeText: (text: string) => void;
  onClear: () => void;
}) {
  return (
    <View className="flex-row items-center bg-zinc-800 rounded-lg mx-4 my-2 px-3">
      <Ionicons name="search" size={20} color="#71717A" />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder="Search conversations..."
        placeholderTextColor="#71717A"
        className="flex-1 text-white py-3 ml-2"
        autoCapitalize="none"
        autoCorrect={false}
      />
      {value.length > 0 && (
        <Pressable onPress={onClear} hitSlop={8}>
          <Ionicons name="close-circle" size={20} color="#71717A" />
        </Pressable>
      )}
    </View>
  );
}

function FilterTabs({
  filter,
  onFilterChange,
}: {
  filter: MessageFilter;
  onFilterChange: (filter: MessageFilter) => void;
}) {
  const tabs: { key: MessageFilter; label: string }[] = [
    { key: "active", label: "Active" },
    { key: "resolved", label: "Resolved" },
    { key: "archived", label: "Archived" },
  ];

  return (
    <View className="flex-row px-4 py-2 border-b border-zinc-800">
      {tabs.map((tab, index) => (
        <Pressable
          key={tab.key}
          onPress={() => onFilterChange(tab.key)}
          className={`flex-1 py-2 rounded-lg ${
            index > 0 ? "ml-2" : ""
          } ${filter === tab.key ? "bg-[#FFCC00]" : "bg-zinc-800"}`}
        >
          <Text
            className={`text-center font-medium ${
              filter === tab.key ? "text-black" : "text-zinc-400"
            }`}
          >
            {tab.label}
          </Text>
        </Pressable>
      ))}
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
    searchQuery,
    setSearchQuery,
    clearSearch,
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

  const getEmptyMessage = () => {
    if (searchQuery) {
      return `No results for "${searchQuery}"`;
    }
    switch (filter) {
      case "archived":
        return "No archived conversations";
      case "resolved":
        return "No resolved conversations";
      default:
        return "No active conversations";
    }
  };

  return (
    <View className="w-full h-full bg-zinc-950">
      <AppHeader title="Messages" />
      <SearchBar
        value={searchQuery}
        onChangeText={setSearchQuery}
        onClear={clearSearch}
      />
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
            <EmptyConversations message={getEmptyMessage()} />
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
