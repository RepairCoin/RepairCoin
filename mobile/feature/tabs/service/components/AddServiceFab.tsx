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
      className="absolute bottom-6 right-6 bg-[#FFCC00] w-14 h-14 rounded-full items-center justify-center"
      style={{
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
      }}
    >
      <Ionicons name="add" size={28} color="black" />
    </TouchableOpacity>
  );
}
