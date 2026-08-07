import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import FormInput from "@/shared/components/ui/FormInput";
import { DesignContent, EditableField, isMobileEditable } from "../utils/designContent";

const BLOCK_LABEL: Record<string, string> = {
  headline: "Headline",
  text: "Text",
  button: "Button label",
  image: "Image",
  coupon: "Coupon",
  service_card: "Featured service",
  divider: "Divider",
  spacer: "Spacer",
};

const LOCKED_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  image: "image-outline",
  coupon: "pricetag-outline",
  service_card: "construct-outline",
  divider: "remove-outline",
  spacer: "resize-outline",
  text: "document-text-outline",
};

interface BlockEditorListProps {
  design: DesignContent;
  editableFields: EditableField[];
  edits: Record<number, string>;
  onChangeField: (index: number, value: string) => void;
}

/**
 * Only headline/text/button render as FormInputs (index-keyed — see utils/designContent.ts).
 * Everything else, plus richly-formatted text blocks, shows as a locked chip so it survives
 * round-tripping through mobile byte-identical.
 */
export function BlockEditorList({ design, editableFields, edits, onChangeField }: BlockEditorListProps) {
  const editableIndexes = new Set(editableFields.map((f) => f.index));
  const hasLockedBlocks = design.blocks.some((_, index) => !editableIndexes.has(index));

  return (
    <View>
      {editableFields.map((field) => (
        <FormInput
          key={field.index}
          label={BLOCK_LABEL[field.type]}
          value={edits[field.index] ?? field.value}
          onChangeText={(text) => onChangeField(field.index, text)}
          placeholder={`Enter ${BLOCK_LABEL[field.type].toLowerCase()}`}
          multiline={field.type === "text"}
          numberOfLines={field.type === "text" ? 4 : 1}
          iconAlign={field.type === "text" ? "top" : "center"}
        />
      ))}

      {hasLockedBlocks && (
        <View className="mb-2">
          <Text className="text-sm font-medium text-gray-200 mb-2 ml-1">Locked content (edit on web)</Text>
          <View className="flex-row flex-wrap gap-2">
            {design.blocks.map((block, index) => {
              if (editableIndexes.has(index)) return null;
              const isRichText = block.type === "text" && !isMobileEditable(block);
              return (
                <View
                  key={block.id ?? index}
                  className="flex-row items-center bg-zinc-800 rounded-full px-3 py-2"
                >
                  <Ionicons
                    name={LOCKED_ICON[block.type] ?? "lock-closed-outline"}
                    size={14}
                    color="#9CA3AF"
                  />
                  <Text className="text-gray-300 text-xs ml-1.5">
                    {isRichText ? "Formatted on web" : BLOCK_LABEL[block.type] ?? block.type}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      )}
    </View>
  );
}
