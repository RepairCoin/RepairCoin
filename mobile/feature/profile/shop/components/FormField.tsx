import { View, Text, TextInput, KeyboardTypeOptions } from "react-native";

type FormFieldProps = {
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (value: string) => void;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
};

export default function FormField({
  label,
  placeholder,
  value,
  onChangeText,
  keyboardType,
  autoCapitalize,
}: FormFieldProps) {
  return (
    <View className="mt-4">
      <Text className="text-sm text-gray-300 mb-1">{label}</Text>
      <TextInput
        className="w-full h-12 bg-white text-black rounded-xl px-3 py-2 text-base"
        placeholder={placeholder}
        placeholderTextColor="#999"
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
      />
    </View>
  );
}
