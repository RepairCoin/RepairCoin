import React from "react";
import {
  StyleSheet,
  TextInputProps,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { ThemedView } from "./ThemedView";
import { useTheme } from "@/shared/hooks/theme/useTheme";

export type ThemedInputProps = {
  onSubmit?: (value: string) => void;
  isSubmitting?: boolean;
} & TextInputProps;

export function ThemedInput(props: ThemedInputProps) {
  const { useThemeColor } = useTheme();
  const { theme } = useThemeColor();
  const [val, setVal] = React.useState("");
  const onSubmit = props.onSubmit;

  return (
    <ThemedView
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        borderRadius: 6,
        borderWidth: 1,
        borderStyle: "solid",
        borderColor: theme.border,
      }}
    >
      <TextInput
        placeholderTextColor={theme.icon}
        style={[styles.input, { color: theme.text, borderColor: theme.border }]}
        value={val}
        onChangeText={setVal}
        {...props}
      />
      {onSubmit && (
        <TouchableOpacity
          onPress={() => onSubmit(val)}
          disabled={props.isSubmitting}
          style={{
            paddingVertical: 12,
            paddingHorizontal: 16,
          }}
        >
          {props.isSubmitting ? (
            <ActivityIndicator size={32} />
          ) : (
            <Ionicons
              name="arrow-forward-circle-outline"
              size={32}
              color={theme.icon}
            />
          )}
        </TouchableOpacity>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  input: {
    flex: 1,
    flexDirection: "row",
    gap: 8,
    padding: 12,
    justifyContent: "center",
    alignItems: "center",
  },
});
