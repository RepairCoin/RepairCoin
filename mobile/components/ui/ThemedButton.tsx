import {
  type PressableProps,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { ThemedText } from "./ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";

export type ThemedButtonProps = {
  onPress?: PressableProps["onPress"];
  title: string;
  loading?: boolean;
  loadingTitle?: string;
  variant?: "primary" | "secondary";
};

export function ThemedButton(props: ThemedButtonProps) {
  const variant = props.variant ?? "primary";
  const theme = useThemeColor();
  const textColor = variant == "secondary" ? theme.text : theme.textInverted;
  
  return (
    <TouchableOpacity
      disabled={props.loading}
      activeOpacity={0.5}
      style={[
        styles.button,
        {
          borderColor: variant == "secondary" ? theme.tint : "transparent",
          borderWidth: variant == "secondary" ? 1 : 0,
          backgroundColor: variant == "secondary" ? "transparent" : theme.tint,
        },
      ]}
      onPress={(e) => {
        props.onPress?.(e);
      }}
    >
      {props.loading && (
        <ActivityIndicator animating={props.loading} color={textColor} />
      )}
      <ThemedText type="defaultSemiBold" style={{ color: textColor }}>
        {props.loading ? props.loadingTitle : props.title}
      </ThemedText>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    display: "flex",
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 4,
    borderRadius: 100,
    justifyContent: "center",
    alignItems: "center",
  },
});
