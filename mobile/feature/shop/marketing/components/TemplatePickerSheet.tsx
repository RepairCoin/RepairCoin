import { Modal, TouchableOpacity, View, Text, ScrollView, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useMarketingTemplatesQuery } from "../hooks";
import { MarketingTemplate } from "../services/marketing.interface";

const CATEGORY_ICON: Record<MarketingTemplate["category"], keyof typeof Ionicons.glyphMap> = {
  coupon: "pricetag-outline",
  announcement: "megaphone-outline",
  newsletter: "newspaper-outline",
  event: "calendar-outline",
};

interface TemplatePickerSheetProps {
  visible: boolean;
  onClose: () => void;
  onSelectTemplate: (template: MarketingTemplate) => void;
  onSelectBlank: () => void;
}

/** Shape mirrors shared/components/shared/FilterModal.tsx. */
export function TemplatePickerSheet({
  visible,
  onClose,
  onSelectTemplate,
  onSelectBlank,
}: TemplatePickerSheetProps) {
  const { data: templates, isLoading, isError } = useMarketingTemplatesQuery();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity activeOpacity={1} onPress={onClose} className="flex-1 bg-black/60 justify-end">
        <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
          <View className="bg-zinc-900 rounded-t-3xl max-h-[75%]">
            <View className="flex-row items-center justify-between px-5 py-4 border-b border-zinc-800">
              <View className="flex-row items-center">
                <Ionicons name="albums-outline" size={20} color="#FFCC00" />
                <Text className="text-white text-lg font-semibold ml-2">Choose a starting point</Text>
              </View>
              <TouchableOpacity onPress={onClose} className="p-1">
                <Ionicons name="close" size={24} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            <ScrollView className="px-4 py-3" showsVerticalScrollIndicator={false}>
              <TouchableOpacity
                onPress={onSelectBlank}
                className="flex-row items-center px-4 py-4 rounded-xl mb-2 bg-zinc-800"
              >
                <Ionicons name="document-outline" size={20} color="#FFCC00" style={{ marginRight: 12 }} />
                <View className="flex-1">
                  <Text className="text-white text-base font-semibold">Start from blank</Text>
                  <Text className="text-gray-400 text-xs mt-0.5">A simple headline and message</Text>
                </View>
              </TouchableOpacity>

              {isLoading && (
                <View className="py-8 items-center">
                  <ActivityIndicator color="#FFCC00" />
                </View>
              )}

              {isError && (
                <Text className="text-gray-400 text-sm text-center py-4">
                  {"Couldn't load templates. You can still start from blank."}
                </Text>
              )}

              {templates?.map((template) => (
                <TouchableOpacity
                  key={template.id}
                  onPress={() => onSelectTemplate(template)}
                  className="flex-row items-center px-4 py-4 rounded-xl mb-2"
                >
                  <Ionicons
                    name={CATEGORY_ICON[template.category] ?? "document-text-outline"}
                    size={20}
                    color="#9CA3AF"
                    style={{ marginRight: 12 }}
                  />
                  <View className="flex-1">
                    <Text className="text-white text-base font-medium">{template.name}</Text>
                    {template.description && (
                      <Text className="text-gray-400 text-xs mt-0.5" numberOfLines={2}>
                        {template.description}
                      </Text>
                    )}
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#6B7280" />
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View className="h-8" />
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}
