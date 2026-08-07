import { useState } from "react";
import { View, Text, TouchableOpacity, FlatList, RefreshControl, Alert } from "react-native";
import { router } from "expo-router";
import { SearchInput } from "@/shared/components/ui/SearchInput";
import { FilterButton } from "@/shared/components/shared/FilterButton";
import { FilterModal } from "@/shared/components/shared/FilterModal";
import { SkeletonList } from "@/shared/components/ui/Skeleton";
import StatsRow from "@/shared/components/ui/StatsRow";
import PrimaryButton from "@/shared/components/ui/PrimaryButton";
import CalloutCard from "@/shared/components/ui/CalloutCard";
import { useDebounce } from "@/shared/hooks";
import { ContactCard, ContactFormModal, MarketingEmptyState } from "../components";
import { useShopContactsQuery, useContactStatsQuery, useDeleteContactMutation } from "../hooks";
import { Contact, ContactStatus } from "../services/marketing.interface";

const STATUS_FILTER_OPTIONS = [
  { key: "all", label: "All statuses", icon: "albums-outline" as const },
  { key: "active", label: "Active", icon: "checkmark-circle-outline" as const },
  { key: "unsubscribed", label: "Unsubscribed", icon: "remove-circle-outline" as const },
  { key: "bounced", label: "Bounced", icon: "alert-circle-outline" as const },
  { key: "invalid", label: "Invalid", icon: "close-circle-outline" as const },
];

export function ContactsTab() {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 400);
  const [statusFilter, setStatusFilter] = useState("all");
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  // undefined = modal closed, null = "add contact", Contact = "edit contact"
  const [formContact, setFormContact] = useState<Contact | null | undefined>(undefined);

  const status = statusFilter === "all" ? undefined : (statusFilter as ContactStatus);
  const { data, isLoading, refetch } = useShopContactsQuery(status, debouncedSearch || undefined);
  const { data: stats, isLoading: isStatsLoading } = useContactStatsQuery();
  const deleteMutation = useDeleteContactMutation();

  const contacts = data?.contacts ?? [];
  const canBlast = !!stats && stats.active > 0;

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  };

  const handleDelete = (contact: Contact) => {
    Alert.alert("Delete contact", `Remove ${contact.fullName} from your contact list?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteMutation.mutate(contact.id) },
    ]);
  };

  return (
    <View className="flex-1 px-4">
      {!isStatsLoading && stats && (
        <StatsRow
          items={[
            { value: stats.total, label: "Total" },
            { value: stats.active, label: "Active" },
            { value: stats.unsubscribed, label: "Unsub" },
            { value: stats.bounced, label: "Bounced" },
            { value: stats.invalid, label: "Invalid" },
          ]}
          className="flex-row bg-zinc-900 rounded-2xl p-4 mb-4"
        />
      )}

      <View className="mb-3">
        <SearchInput value={search} onChangeText={setSearch} placeholder="Search contacts…" />
      </View>

      <View className="flex-row mb-4">
        <FilterButton
          icon="filter-outline"
          label={STATUS_FILTER_OPTIONS.find((o) => o.key === statusFilter)?.label ?? "All statuses"}
          onPress={() => setShowStatusModal(true)}
        />
      </View>

      <FilterModal
        title="Status"
        icon="filter-outline"
        options={STATUS_FILTER_OPTIONS}
        selectedKey={statusFilter}
        onSelect={setStatusFilter}
        visible={showStatusModal}
        onClose={() => setShowStatusModal(false)}
      />

      <View className="flex-row gap-3 mb-4">
        <View className="flex-1">
          <PrimaryButton title="Add contact" onPress={() => setFormContact(null)} />
        </View>
        <TouchableOpacity
          onPress={() => router.push("/shop/marketing/contact-blast" as never)}
          disabled={!canBlast}
          className={`flex-1 rounded-2xl items-center justify-center border ${
            canBlast ? "border-[#FFCC00]" : "border-zinc-800 opacity-50"
          }`}
        >
          <Text className={`font-semibold ${canBlast ? "text-[#FFCC00]" : "text-gray-500"}`}>Email contacts</Text>
        </TouchableOpacity>
      </View>

      <CalloutCard
        tone="info"
        icon="cloud-upload-outline"
        title="Need to import a list?"
        description="CSV import is available from the web dashboard."
        className="mb-4"
      />

      {isLoading ? (
        <SkeletonList variant="customer" count={4} />
      ) : (
        <FlatList
          data={contacts}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ContactCard contact={item} onPress={() => setFormContact(item)} onDelete={() => handleDelete(item)} />
          )}
          contentContainerStyle={{ paddingBottom: 24, flexGrow: contacts.length === 0 ? 1 : undefined }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFCC00" colors={["#FFCC00"]} />
          }
          ListEmptyComponent={
            <MarketingEmptyState
              icon="people-outline"
              title="No contacts yet"
              description="Add contacts manually, or import a list from the web dashboard."
              actionLabel="Add contact"
              onAction={() => setFormContact(null)}
            />
          }
        />
      )}

      <ContactFormModal visible={formContact !== undefined} onClose={() => setFormContact(undefined)} existingContact={formContact} />
    </View>
  );
}
