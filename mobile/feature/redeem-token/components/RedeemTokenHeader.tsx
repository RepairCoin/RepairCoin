import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { AntDesign, Feather } from "@expo/vector-icons";

interface RedeemTokenHeaderProps {
  onBack: () => void;
  onInfoPress: () => void;
}

export const RedeemTokenHeader: React.FC<RedeemTokenHeaderProps> = ({
  onBack,
  onInfoPress,
}) => {
  return (
    <View className="pt-14 pb-4 px-5">
      <View className="flex-row items-center justify-between">
        <TouchableOpacity onPress={onBack} className="p-2 -ml-2">
          <AntDesign name="arrowleft" color="white" size={24} />
        </TouchableOpacity>
        <Text className="text-white text-xl font-bold">Process Redemption</Text>
        <TouchableOpacity onPress={onInfoPress} className="p-2 -mr-2">
          <Feather name="info" color="#FFCC00" size={20} />
        </TouchableOpacity>
      </View>
    </View>
  );
};
