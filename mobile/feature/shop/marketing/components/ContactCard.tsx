import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Badge, { BadgeTone } from "@/shared/components/ui/Badge";
import { CONTACT_STATUS_OPTIONS } from "../constants/marketingConstants";
import { Contact } from "../services/marketing.interface";

const STATUS_TONE: Record<Contact["status"], BadgeTone> = {
  active: "success",
  unsubscribed: "neutral",
  bounced: "warning",
  invalid: "danger",
};

const STATUS_LABEL = Object.fromEntries(
  CONTACT_STATUS_OPTIONS.map((o) => [o.value, o.label])
) as Record<Contact["status"], string>;

export function ContactCard({
  contact,
  onPress,
  onDelete,
}: {
  contact: Contact;
  onPress: () => void;
  onDelete: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      className="bg-[#1A1A1A] rounded-2xl p-4 mb-3 border border-[#222]"
    >
      <View className="flex-row items-start justify-between mb-2">
        <View className="flex-1 mr-3">
          <Text className="text-white text-base font-bold" numberOfLines={1}>
            {contact.fullName}
          </Text>
          {(contact.email || contact.phone) && (
            <Text className="text-gray-400 text-xs mt-0.5" numberOfLines={1}>
              {contact.email ?? contact.phone}
            </Text>
          )}
        </View>
        <View className="flex-row items-center gap-2">
          <Badge label={STATUS_LABEL[contact.status]} tone={STATUS_TONE[contact.status]} icon={null} />
          <TouchableOpacity onPress={onDelete} hitSlop={8} className="p-1">
            <Ionicons name="trash-outline" size={16} color="#EF4444" />
          </TouchableOpacity>
        </View>
      </View>

      {contact.tags.length > 0 && (
        <View className="flex-row flex-wrap gap-1.5 mt-1">
          {contact.tags.map((tag) => (
            <View key={tag} className="bg-zinc-800 rounded-full px-2 py-0.5">
              <Text className="text-gray-300 text-[10px]">{tag}</Text>
            </View>
          ))}
        </View>
      )}
    </TouchableOpacity>
  );
}
