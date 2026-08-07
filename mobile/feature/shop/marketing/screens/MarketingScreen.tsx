import { useState } from "react";
import { View, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { ThemedView } from "@/shared/components/ui/ThemedView";
import GradientHeader from "@/shared/components/ui/GradientHeader";
import { TabButtons } from "@/shared/components/ui/TabButtons";
import { TierGate } from "@/shared/components/shop/TierGate";
import { CampaignsTab } from "./CampaignsTab";
import { ContactsTab } from "./ContactsTab";

type MarketingTab = "campaigns" | "contacts";

export function MarketingScreen() {
  const [activeTab, setActiveTab] = useState<MarketingTab>("campaigns");

  return (
    <ThemedView className="w-full h-full">
      <GradientHeader
        variant="shop"
        showBack
        onBack={() => router.back()}
        title="Marketing"
        right={
          activeTab === "campaigns" ? (
            <TouchableOpacity
              onPress={() => router.push("/shop/marketing/campaign-composer" as never)}
              className="w-9 h-9 rounded-full bg-white/15 items-center justify-center"
              hitSlop={8}
            >
              <Ionicons name="add" size={22} color="#fff" />
            </TouchableOpacity>
          ) : undefined
        }
      />

      <TierGate
        feature="campaignBuilder"
        description="Build email and in-app campaigns, manage your contact list, and send offers to your customers."
      >
        <TabButtons
          tabs={[
            { key: "campaigns", label: "Campaigns" },
            { key: "contacts", label: "Contacts" },
          ]}
          activeTab={activeTab}
          onTabChange={(tab) => setActiveTab(tab as MarketingTab)}
          className="px-4 mt-4 mb-2"
        />

        <View className="flex-1">{activeTab === "campaigns" ? <CampaignsTab /> : <ContactsTab />}</View>
      </TierGate>
    </ThemedView>
  );
}
