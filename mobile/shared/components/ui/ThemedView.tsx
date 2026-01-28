import { View, type ViewProps } from "react-native";
import { useTheme } from "@/shared/hooks/theme/useTheme";

export type ThemedViewProps = ViewProps & {
  lightColor?: string;
  darkColor?: string;
};

export function ThemedView({ style, ...otherProps }: ThemedViewProps) {
  const { useThemeColor } = useTheme();
  const { theme } = useThemeColor();

  return (
    <View
      style={[{ backgroundColor: theme.background }, style]}
      {...otherProps}
    />
  );
}
