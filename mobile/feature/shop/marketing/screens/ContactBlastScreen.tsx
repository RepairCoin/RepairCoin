import { useState } from "react";
import { View, Text, TouchableOpacity, FlatList, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { AppHeader } from "@/shared/components/ui/AppHeader";
import FormInput from "@/shared/components/ui/FormInput";
import PrimaryButton from "@/shared/components/ui/PrimaryButton";
import CalloutCard from "@/shared/components/ui/CalloutCard";
import { useAuthStore } from "@/feature/auth/store/auth.store";
import { useAppToast } from "@/shared/hooks";
import { plainTextToHtml } from "../utils/designContent";
import { CONTACT_BLAST_MAX } from "../constants/marketingConstants";
import {
  useContactStatsQuery,
  useShopContactsQuery,
  useSendContactBlastMutation,
  useSendTestEmailMutation,
} from "../hooks";
import { Contact } from "../services/marketing.interface";

type RecipientMode = "all" | "choose";

export function ContactBlastScreen() {
  const userProfile = useAuthStore((s) => s.userProfile);
  const { showError } = useAppToast();

  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [mode, setMode] = useState<RecipientMode>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [testEmail, setTestEmail] = useState(userProfile?.email ?? "");
  // Session-scoped gate: a real send is blocked until a test has gone out this visit, so
  // reopening the screen later always requires a fresh test — see plan's "test-email gate".
  const [testSent, setTestSent] = useState(false);

  const { data: stats } = useContactStatsQuery();
  const { data: activeContactsPage, isLoading: isLoadingContacts } = useShopContactsQuery("active");
  const activeContacts = activeContactsPage?.contacts ?? [];

  const sendTestMutation = useSendTestEmailMutation();
  const blastMutation = useSendContactBlastMutation();

  // No scheduler equivalent for contact blasts (a direct, synchronous send loop server-side),
  // so "all active" is hard-capped rather than routed through anything — see CONTACT_BLAST_MAX.
  const overCap = mode === "all" && (stats?.active ?? 0) > CONTACT_BLAST_MAX;
  const selectedCount = mode === "all" ? stats?.active ?? 0 : selectedIds.size;
  const canSend = testSent && !overCap && !blastMutation.isPending;

  function toggleContact(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleSendTest() {
    if (!subject.trim() || !body.trim()) {
      showError("Write a subject and message first");
      return;
    }
    if (!testEmail.trim()) {
      showError("Enter a test email address");
      return;
    }
    sendTestMutation.mutate(
      { subject: subject.trim(), htmlContent: plainTextToHtml(body), testEmail: testEmail.trim() },
      { onSuccess: () => setTestSent(true) }
    );
  }

  function handleSend() {
    if (!subject.trim() || !body.trim()) {
      showError("Write a subject and message first");
      return;
    }
    if (mode === "choose" && selectedIds.size === 0) {
      showError("Select at least one contact");
      return;
    }
    if (overCap) {
      showError(`Select up to ${CONTACT_BLAST_MAX} contacts, or send larger blasts from the web dashboard`);
      return;
    }

    blastMutation.mutate(
      {
        subject: subject.trim(),
        htmlContent: plainTextToHtml(body),
        contactIds: mode === "choose" ? Array.from(selectedIds) : undefined,
      },
      { onSuccess: () => router.back() }
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} className="flex-1 bg-zinc-950">
      <AppHeader title="Email contacts" />
      <ScrollView
        className="flex-1 px-4"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        <FormInput label="Subject" value={subject} onChangeText={setSubject} placeholder="Email subject" />
        <FormInput
          label="Message"
          value={body}
          onChangeText={setBody}
          placeholder="Write your message…"
          multiline
          numberOfLines={6}
          iconAlign="top"
        />

        <Text className="text-sm font-medium text-gray-200 mb-2 ml-1">Recipients</Text>
        <View className="flex-row bg-zinc-900 rounded-xl p-1 mb-3">
          <TouchableOpacity
            onPress={() => setMode("all")}
            className={`flex-1 py-2.5 rounded-lg items-center ${mode === "all" ? "bg-[#FFCC00]" : ""}`}
          >
            <Text className={mode === "all" ? "text-black font-semibold" : "text-gray-400"}>All active</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setMode("choose")}
            className={`flex-1 py-2.5 rounded-lg items-center ${mode === "choose" ? "bg-[#FFCC00]" : ""}`}
          >
            <Text className={mode === "choose" ? "text-black font-semibold" : "text-gray-400"}>Choose contacts</Text>
          </TouchableOpacity>
        </View>

        {overCap && (
          <CalloutCard
            tone="danger"
            icon="warning-outline"
            title="Too many active contacts"
            description={`You have ${stats?.active} active contacts. Sending to more than ${CONTACT_BLAST_MAX} at once isn't supported on mobile — use the web dashboard, or switch to "Choose contacts".`}
            className="mb-4"
          />
        )}

        {mode === "all" ? (
          <Text className="text-gray-400 text-sm mb-4">
            Sending to all {stats?.active ?? 0} active contact{stats?.active === 1 ? "" : "s"}.
          </Text>
        ) : (
          <View className="mb-4">
            {isLoadingContacts ? (
              <Text className="text-gray-500 text-sm">Loading contacts…</Text>
            ) : (
              <FlatList
                data={activeContacts}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
                renderItem={({ item }: { item: Contact }) => {
                  const isSelected = selectedIds.has(item.id);
                  return (
                    <TouchableOpacity
                      onPress={() => toggleContact(item.id)}
                      className="flex-row items-center justify-between px-3 py-3 border-b border-zinc-800"
                    >
                      <Text className="text-white text-sm flex-1 mr-3" numberOfLines={1}>
                        {item.fullName}
                      </Text>
                      <Ionicons
                        name={isSelected ? "checkbox" : "square-outline"}
                        size={20}
                        color={isSelected ? "#FFCC00" : "#6B7280"}
                      />
                    </TouchableOpacity>
                  );
                }}
                ListEmptyComponent={<Text className="text-gray-500 text-sm py-4">No active contacts</Text>}
              />
            )}
          </View>
        )}

        <View className="bg-[#1A1A1A] border border-[#222] rounded-2xl p-4 mb-4">
          <Text className="text-white text-sm font-semibold mb-1">Send yourself a test first</Text>
          <Text className="text-gray-400 text-xs mb-3">
            Required before sending to contacts — check the message looks right.
          </Text>
          <FormInput
            label="Test email"
            value={testEmail}
            onChangeText={setTestEmail}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <TouchableOpacity
            onPress={handleSendTest}
            disabled={sendTestMutation.isPending}
            className="bg-zinc-800 rounded-xl py-3 items-center"
          >
            <Text className="text-white font-semibold">
              {sendTestMutation.isPending ? "Sending…" : testSent ? "Send another test" : "Send test"}
            </Text>
          </TouchableOpacity>
          {testSent && (
            <View className="flex-row items-center mt-2">
              <Ionicons name="checkmark-circle" size={14} color="#4CAF50" />
              <Text className="text-green-400 text-xs ml-1">Test sent</Text>
            </View>
          )}
        </View>

        <PrimaryButton
          title={`Send to ${selectedCount} contact${selectedCount === 1 ? "" : "s"}`}
          onPress={handleSend}
          disabled={!canSend}
          loading={blastMutation.isPending}
        />
        {!testSent && (
          <Text className="text-gray-500 text-xs text-center mt-2">
            Send a test email to yourself to unlock sending
          </Text>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
