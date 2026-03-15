// Libraries
import React from "react";
import { Pressable, Text } from "react-native";
import { Entypo } from "@expo/vector-icons";

type CopyableFieldProps = {
  value: string;
  isCopied: boolean;
  handleCopyValue: () => void;
};

export default function CopyableField({
  value,
  isCopied,
  handleCopyValue,
}: CopyableFieldProps) {
  const displayValue =
    value && value.length > 20 ? `${value.substring(0, 20)}...` : value || "";

  return (
    <Pressable
      onPress={handleCopyValue}
      className={`p-4 ${
        isCopied
          ? "bg-[#FFCC00] justify-center"
          : "border-dashed justify-between"
      } border-2 border-[#FFCC00] flex-row rounded-xl`}
    >
      {isCopied ? (
        <Text className="text-base text-white font-semibold">
          <Entypo name="check" color="#fff" size={18} />
          {"  "}Code copied to clipboard
        </Text>
      ) : (
        <React.Fragment>
          <Text className="text-base text-[#FFCC00] font-semibold">
            {displayValue}
          </Text>
          <Text className="text-base text-[#ffcc00a2] font-semibold">
            Tap to copy
          </Text>
        </React.Fragment>
      )}
    </Pressable>
  );
}
