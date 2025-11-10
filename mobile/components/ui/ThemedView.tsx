import { View, type ViewProps } from "react-native";
import { useThemeColor } from "@/hooks/useThemeColor";

export type ThemedViewProps = ViewProps & {
	lightColor?: string;
	darkColor?: string;
};

export function ThemedView({
	style,
	...otherProps
}: ThemedViewProps) {
	const theme = useThemeColor();

	return <View style={[{ backgroundColor: theme.background }, style]} {...otherProps} />;
}
