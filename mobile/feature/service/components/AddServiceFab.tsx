import React from "react";
import { TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface AddServiceFabProps {
  onPress: () => void;
}

export function AddServiceFab({ onPress }: AddServiceFabProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className="bg-[#FFCC00] w-14 h-14 rounded-full items-center justify-center"
      style={{
        position: "absolute",
        bottom: 26,
        right: 24,
        zIndex: 50,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 4.65,
        elevation: 8,
      }}
    >
      <Ionicons name="add" size={28} color="black" />
    </TouchableOpacity>
  );
}
