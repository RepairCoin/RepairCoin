import React from "react";

// ---- useSettings types ----

export type SettingsRole = "customer" | "shop";

export interface SettingsConfig {
  editProfile: {
    icon: "person-outline" | "storefront-outline";
    subtitle: string;
    route: string;
  };
  notificationPreferencesRoute: string;
  roleSpecificHandlers: {
    // Customer-specific
    handleReferFriends?: () => void;
    // Shop-specific
    handleSubscription?: () => void;
    handleBuyTokens?: () => void;
    handleRedeemTokens?: () => void;
    handleGroups?: () => void;
  };
}

// ---- SettingsItem types ----

export interface SettingsItemProps {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  onPress: () => void;
  showArrow?: boolean;
  danger?: boolean;
  disabled?: boolean;
  rightElement?: React.ReactNode;
}

// ---- SettingsSection types ----

export interface SettingsSectionProps {
  title?: string;
  children: React.ReactNode;
}

// ---- SettingsScreen types ----

export interface SettingsScreenProps {
  role: SettingsRole;
}
