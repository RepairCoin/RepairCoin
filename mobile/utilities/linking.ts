import { Linking } from "react-native";

export type LinkType = "call" | "email" | "website" | "social";

export const handleLink = (
  type: LinkType,
  value?: string,
  platform?: string
) => {
  if (!value) return;

  const urlMap: Record<LinkType, string> = {
    call: `tel:${value}`,
    email: `mailto:${value}`,
    website: value.startsWith("http") ? value : `https://${value}`,
    social: value.startsWith("http") ? value : `https://${platform}.com/${value}`,
  };

  Linking.openURL(urlMap[type]);
};