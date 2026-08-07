import { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, Linking } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AppHeader } from "@/shared/components/ui/AppHeader";
import { FaqItem } from "../components";
import { CUSTOMER_FAQS, SHOP_FAQS } from "../constants/faqs";

export type FaqRole = "customer" | "shop";

interface FaqScreenProps {
  role: FaqRole;
}

const SUPPORT_EMAIL = "support@repaircoin.com";

export default function FaqScreen({ role }: FaqScreenProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs = role === "shop" ? SHOP_FAQS : CUSTOMER_FAQS;
  const subtitle =
    role === "shop"
      ? "Frequently asked questions about managing your RepairCoin shop."
      : "Find answers to the most common questions about RepairCoin.";

  return (
    <View className="flex-1 bg-zinc-950">
      <AppHeader title="FAQ & Help" />

      <ScrollView
        className="flex-1 px-4"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: 16, paddingBottom: 40 }}
      >
        <Text className="text-gray-400 text-sm mb-5">{subtitle}</Text>

        <View className="gap-3">
          {faqs.map((faq, index) => (
            <FaqItem
              key={index}
              faq={faq}
              isOpen={openIndex === index}
              onToggle={() => setOpenIndex(openIndex === index ? null : index)}
            />
          ))}
        </View>

        {/* Contact Support */}
        <View className="mt-8 p-5 bg-[#FFCC00]/10 border border-[#FFCC00]/20 rounded-xl">
          <Text className="text-lg font-semibold text-[#FFCC00] mb-1">
            Still need help?
          </Text>
          <Text className="text-sm text-gray-400 mb-4">
            Can't find the answer you're looking for? Our support team is here to
            help.
          </Text>
          <TouchableOpacity
            onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}
            activeOpacity={0.8}
            className="flex-row items-center justify-center gap-2 px-5 py-3 bg-[#FFCC00] rounded-lg"
          >
            <Ionicons name="mail-outline" size={18} color="#000" />
            <Text className="text-black font-semibold">Contact Support</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}
