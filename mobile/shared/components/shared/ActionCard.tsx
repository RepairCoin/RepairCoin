import React from "react";
import { View, Text, TouchableOpacity, ImageSourcePropType } from "react-native";
import { Tier } from "@/shared/utilities/GlobalTypes";
import TierCard from "@/shared/components/ui/TierCard";

interface QuickAction {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
}

interface InlineAction {
  label: string;
  onPress: () => void;
}

interface ActionCardProps {
  // Balance mode props
  balance?: number;
  balanceLabel?: string;
  showBalanceToggle?: boolean;
  tier?: Tier;

  // Info mode props
  title?: string;
  subtitle?: string;
  inlineAction?: InlineAction;

  // Common props
  isLoading?: boolean;
  quickActions?: QuickAction[];
  backgroundImage?: ImageSourcePropType;
}

export const ActionCard: React.FC<ActionCardProps> = ({
  balance,
  balanceLabel = "Your Current RCN Balance",
  showBalanceToggle = true,
  tier,
  title,
  subtitle,
  inlineAction,
  isLoading = false,
  quickActions,
  backgroundImage = require("@/assets/images/customer_wallet_card.png"),
}) => {
  return (
    <View className="rounded-3xl bg-[#FFFFFF]">
      <TierCard
        balance={balance}
        balanceLabel={balanceLabel}
        showBalanceToggle={showBalanceToggle}
        tier={tier}
        title={title}
        subtitle={subtitle}
        inlineAction={inlineAction}
        isLoading={isLoading}
        backgroundImage={backgroundImage}
      />

      {/* Quick Actions inside card */}
      {quickActions && quickActions.length > 0 && (
        <View className="py-4 px-6">
          <View className="flex-row justify-around items-center">
            {quickActions.map((action, index) => (
              <TouchableOpacity
                key={index}
                onPress={action.onPress}
                className="items-center"
                activeOpacity={0.7}
              >
                <View className="bg-white border border-gray-200 rounded-full p-3 mb-2 shadow-sm">
                  {action.icon}
                </View>
                <Text className="text-black text-xs font-medium">
                  {action.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
    </View>
  );
};

export default ActionCard;
