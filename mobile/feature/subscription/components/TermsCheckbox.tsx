import { View, Text } from "react-native";
import { Checkbox } from "expo-checkbox";

type TermsCheckboxProps = {
  value: boolean;
  onValueChange: (value: boolean) => void;
};

export default function TermsCheckbox({ value, onValueChange }: TermsCheckboxProps) {
  return (
    <View className="flex-row items-start mt-8">
      <Checkbox
        value={value}
        onValueChange={onValueChange}
        style={{
          borderRadius: 4,
          backgroundColor: value ? "#c8f7c5" : "#f5f5f5",
          marginTop: 2,
        }}
      />
      <Text className="ml-3 text-white text-sm flex-1">
        I agree to the{" "}
        <Text className="text-[#FFCC00] underline">Terms of Service</Text> and{" "}
        <Text className="text-[#FFCC00] underline">Privacy Policy</Text>
      </Text>
    </View>
  );
}
